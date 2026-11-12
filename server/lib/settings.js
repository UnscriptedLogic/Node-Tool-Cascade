'use strict';
// Settings store (settings.json) and provider resolution. Keys never leave this process:
// publicSettings() only exposes the last four characters.
const fs = require('fs'), path = require('path');
const { HttpError, str, DATA_DIR } = require('./util');
const chatgpt = require('./chatgpt');
const claudecode = require('./claudecode');

const FILE = path.join(DATA_DIR,'settings.json');
const NAMES = ['chatgpt','claudecode','openrouter','anthropic','openai','custom','demo'];
const DEFAULT_BASE = { anthropic:'https://api.anthropic.com', openai:'https://api.openai.com/v1', openrouter:'https://openrouter.ai/api/v1', custom:'' };
const DEFAULT_MODEL = { anthropic:'claude-haiku-5-5', claudecode:'haiku' };
const ENV = {
  anthropic:{ key:process.env.ANTHROPIC_API_KEY, base:process.env.ANTHROPIC_BASE_URL, model:process.env.CASCADE_MODEL },
  openai:{ key:process.env.OPENAI_API_KEY, base:process.env.OPENAI_BASE_URL, model:process.env.OPENAI_MODEL },
  openrouter:{ key:process.env.OPENROUTER_API_KEY, base:process.env.OPENROUTER_BASE_URL, model:process.env.OPENROUTER_MODEL },
  custom:{ key:process.env.CASCADE_CUSTOM_API_KEY, base:process.env.CASCADE_CUSTOM_BASE_URL, model:process.env.CASCADE_CUSTOM_MODEL }
};

const DOMAINS = ['general','product','research','game'];
const DEFAULT_PREFS = { mobileLayout:'standard', domain:'general', goal:'', context:'', pillars:'', avoid:'', steer:'balanced', autoGrow:true, autoTrace:true, growSize:'medium', creativity:0.7, theme:'system', pushback:true, grillStyle:'round', quitOnClose:false , useProject:true, askFiles:true};
function sanitizePrefs(p){
  p = p && typeof p==='object' ? p : {};
  const out = Object.assign({},DEFAULT_PREFS);
  for(const [k,max] of [['goal',600],['context',1200],['pillars',1200],['avoid',800]]) if(typeof p[k]==='string') out[k] = p[k].slice(0,max);
  out.domain = DOMAINS.includes(p.domain) ? p.domain : (Object.keys(p).length ? 'game' : 'general');   // saved before domains existed means game design
  if(['standard','minimal'].includes(p.mobileLayout)) out.mobileLayout = p.mobileLayout;
  if(['light','balanced','strong'].includes(p.steer)) out.steer = p.steer;
  if(['small','medium','large'].includes(p.growSize)) out.growSize = p.growSize;
  if(['system','light','dark'].includes(p.theme)) out.theme = p.theme;
  if(['round','single'].includes(p.grillStyle)) out.grillStyle = p.grillStyle;
  for(const k of ['autoGrow','autoTrace','pushback','quitOnClose','useProject','askFiles']) if(typeof p[k]==='boolean') out[k] = p[k];
  if(typeof p.creativity==='number' && isFinite(p.creativity)) out.creativity = Math.min(1,Math.max(0,p.creativity));
  return out;
}
const hasCreds = (s,n) => n==='chatgpt' ? !!chatgpt.account() : (n==='demo' || n==='claudecode') ? false : !!(s.providers[n].key || ENV[n].key);
function load(){
  let o = {}; try{ o = JSON.parse(fs.readFileSync(FILE,'utf8')); }catch(e){}
  const s = { active:null, providers:{}, prefs:sanitizePrefs(o.prefs), look:(o.look && typeof o.look==='object' && !Array.isArray(o.look)) ? o.look : {} };
  for(const n of NAMES){ const p = (o.providers && o.providers[n]) || {}; s.providers[n] = { key:str(p.key,500), model:str(p.model,200), baseUrl:str(p.baseUrl,300) }; }
  s.active = NAMES.includes(o.active) ? o.active : (NAMES.find(n=>hasCreds(s,n)) || 'demo');
  return s;
}
let settings = load();
function persist(){
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp,JSON.stringify(settings,null,2),{ mode:0o600 });
  fs.renameSync(tmp,FILE);
  try{ fs.chmodSync(FILE,0o600); }catch(e){}
}

function resolveProvider(name,over){
  over = over || {};
  const st = settings.providers[name] || {}, env = ENV[name] || {};
  const pick = (o,saved,envv,def) => (o || saved || envv || def || '');
  if(name==='chatgpt') return { name, kind:'responses', key:'', base:chatgpt.API_BASE, model:pick(over.model,st.model,'',''), extra:{} };
  if(name==='claudecode') return { name, kind:'claude-cli', key:'', base:'', model:pick(over.model,st.model,'',DEFAULT_MODEL.claudecode), extra:{} };
  if(name==='demo') return { name, kind:'demo', key:'', base:'', model:'', extra:{} };
  return {
    name, kind: name==='anthropic' ? 'anthropic' : 'openai',
    key:pick(over.key,st.key,env.key,''),
    base:pick(over.baseUrl,st.baseUrl,env.base,DEFAULT_BASE[name]).replace(/\/+$/,''),
    model:pick(over.model,st.model,env.model,DEFAULT_MODEL[name]),
    extra: name==='openrouter' ? { headers:{ 'X-Title':'Cascade' } } : {}
  };
}
// Why this provider can't be used for a server-side request, or '' if it can.
function problem(cfg){
  if(cfg.name==='demo') return 'The demo runs inside the page, not on the server.';
  if(cfg.name==='chatgpt'){
    const a = chatgpt.account();
    if(!a) return 'Sign in with ChatGPT first.';
    if(!a.planUsage) return 'ChatGPT plan usage isn’t allowed yet. Use “Allow plan usage”.';
    if(!cfg.model) return 'Choose a model first. Try Fetch models.';
    return '';
  }
  if(cfg.name==='claudecode') return claudecode.available() ? '' : 'Claude Code isn’t installed, or Cascade can’t find it.';
  if(cfg.name==='custom' && !cfg.base) return 'Enter a base URL first.';
  if(cfg.name!=='custom' && !cfg.key) return 'Add an API key first.';
  if(!cfg.model) return 'Choose a model first. Try Fetch models.';
  return '';
}
const isReady = (cfg) => cfg.name==='demo' ? true : !problem(cfg);
const hint = (k) => k ? '••••' + k.slice(-4) : '';

function publicSettings(server){
  const out = { local:true, active:settings.active, prefs:settings.prefs, look:settings.look, providers:{}, server };
  for(const n of NAMES){
    const st = settings.providers[n], cfg = resolveProvider(n);
    out.providers[n] = {
      hasKey:!!cfg.key, hint:hint(cfg.key), source: st.key ? 'settings' : (ENV[n] && ENV[n].key ? 'env' : null),
      model:st.model, effectiveModel:cfg.model, baseUrl:st.baseUrl, effectiveBase:cfg.base,
      defaultModel:DEFAULT_MODEL[n] || (ENV[n] && ENV[n].model) || '', ready:isReady(cfg)
    };
  }
  out.providers.chatgpt.account = chatgpt.publicAccount();
  out.providers.chatgpt.pending = chatgpt.isPending();
  out.providers.chatgpt.lastError = chatgpt.lastError();
  out.providers.claudecode.installed = claudecode.available();
  out.ready = out.providers[out.active].ready;
  return out;
}
function applyPatch(patch){
  if(!patch || typeof patch!=='object') throw new HttpError(400,'Bad settings');
  if(patch.active!==undefined){ if(!NAMES.includes(patch.active)) throw new HttpError(400,'Unknown provider'); settings.active = patch.active; }
  if(patch.prefs!==undefined) settings.prefs = sanitizePrefs(patch.prefs);
  if(patch.look!==undefined){
    // the page validates the look in detail; the server just keeps it, as long as it is a small plain object
    if(!patch.look || typeof patch.look!=='object' || Array.isArray(patch.look) || JSON.stringify(patch.look).length>20000) throw new HttpError(400,'The look must be a JSON object under 20 KB.');
    settings.look = patch.look;
  }
  if(patch.clearAllKeys) for(const n of NAMES) settings.providers[n].key = '';
  if(patch.providers){
    for(const [n,v] of Object.entries(patch.providers)){
      if(!NAMES.includes(n) || !v || typeof v!=='object') continue;
      const st = settings.providers[n];
      if(v.key===null) st.key = ''; else if(typeof v.key==='string') st.key = v.key.trim().slice(0,500);
      if(typeof v.model==='string') st.model = v.model.trim().slice(0,200);
      if(typeof v.baseUrl==='string'){
        let b = v.baseUrl.trim();
        if(b){
          let u; try{ u = new URL(b); }catch(e){ throw new HttpError(400,'That base URL isn’t valid. Start with http:// or https://'); }
          if(!/^https?:$/.test(u.protocol)) throw new HttpError(400,'The base URL must start with http:// or https://');
          b = b.replace(/\/+$/,'');
          if(n==='anthropic') b = b.replace(/\/v1$/,'');
        }
        st.baseUrl = b;
      }
    }
  }
  persist();
}
// Used by the OpenRouter sign-in: store the key it returned and make OpenRouter the active provider.
function setKey(name,key){ settings.providers[name].key = String(key).trim().slice(0,500); settings.active = name; persist(); }
const get = () => settings;
const active = () => settings.active;
module.exports = { NAMES, DEFAULT_PREFS, resolveProvider, problem, isReady, publicSettings, applyPatch, setKey, get, active };
