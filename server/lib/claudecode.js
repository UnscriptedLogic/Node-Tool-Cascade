'use strict';
// "Claude Code" provider: runs the Claude Code CLI (`claude -p`) that is installed on this computer,
// so model calls use whatever account it is logged in with, including a Claude Pro or Max plan.
// Local app only: the Worker can't start processes. Cascade never sees or stores the login itself.
const fs = require('fs'), os = require('os'), path = require('path');
const { spawn } = require('child_process');
const { ProviderError, DATA_DIR } = require('./util');

const INSTRUCTIONS = 'You follow the user’s formatting instructions exactly and reply with only what they ask for.';
const NO_TEXT = 'The model returned no text. Try a different model.';
const MODELS = ['haiku','sonnet','opus','fable'];   // CLI aliases for the newest model in each tier
const WIN = process.platform==='win32';

// Find the binary: CASCADE_CLAUDE_BIN, then PATH, then the usual install folders (apps started
// from Finder or a launcher often get a short PATH that misses ~/.local/bin).
let found;
function bin(){
  if(found!==undefined && (found===null || fs.existsSync(found))) return found;
  if(process.env.CASCADE_CLAUDE_BIN) return (found = fs.existsSync(process.env.CASCADE_CLAUDE_BIN) ? process.env.CASCADE_CLAUDE_BIN : null);
  const names = WIN ? ['claude.exe','claude.cmd'] : ['claude'];
  const home = os.homedir();
  const dirs = [...(process.env.PATH || '').split(path.delimiter).filter(Boolean),
    path.join(home,'.local','bin'), path.join(home,'.claude','local'), '/opt/homebrew/bin', '/usr/local/bin',
    ...(WIN && process.env.APPDATA ? [path.join(process.env.APPDATA,'npm')] : [])];
  for(const d of dirs) for(const n of names){
    const f = path.join(d,n);
    try{ if(fs.statSync(f).isFile()) return (found = f); }catch(e){}
  }
  return (found = null);
}
const available = () => !!bin();
const NOT_FOUND = 'Claude Code isn’t installed, or Cascade can’t find it. Install it from claude.com/claude-code, or set CASCADE_CLAUDE_BIN to its path.';

// An empty folder to run in, so the CLI picks up no CLAUDE.md, project settings or memory.
function workDir(){
  const d = path.join(DATA_DIR,'.claude-cli');
  try{ fs.mkdirSync(d,{ recursive:true }); }catch(e){}
  return d;
}

function friendly(msg){
  const m = String(msg || '').trim();
  if(/not logged in|please run \/login|invalid api key|oauth|authenticat/i.test(m)) return new ProviderError(401,'Claude Code isn’t logged in. Run `claude` in a terminal, log in with your Claude account, then try again.');
  if(/usage limit|rate limit|limit reached|429/i.test(m)) return new ProviderError(429,'Your Claude plan’s usage limit has been reached. Try again after it resets.');
  return new ProviderError(502,(m || 'Claude Code exited without a reply.').slice(0,400));
}

function streamClaudeCode(cfg,o,onDelta){
  const exe = bin();
  if(!exe) return Promise.reject(new ProviderError(400,NOT_FOUND));
  const args = ['-p','--output-format','stream-json','--verbose','--include-partial-messages',
    '--tools','','--strict-mcp-config','--setting-sources','','--no-session-persistence',
    '--system-prompt',INSTRUCTIONS];
  if(cfg.model) args.push('--model',cfg.model);
  // Drop API credentials so the CLI uses its own login (the plan), not a key that bills separately.
  const env = { ...process.env };
  for(const k of ['ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','CLAUDECODE']) delete env[k];

  return new Promise((resolve,reject)=>{
    let child;
    try{ child = spawn(exe,args,{ cwd:workDir(), env, stdio:['pipe','pipe','pipe'], windowsHide:true, shell:WIN && /\.cmd$/i.test(exe) }); }
    catch(e){ return reject(new ProviderError(400,NOT_FOUND)); }
    let buf = '', err = '', got = 0, result = null, settled = false;
    const done = (fn,v) => { if(!settled){ settled = true; if(o.signal) o.signal.removeEventListener('abort',onAbort); fn(v); } };
    const onAbort = () => { try{ child.kill(); }catch(e){} const e = new Error('Aborted'); e.name = 'AbortError'; done(reject,e); };
    if(o.signal){ if(o.signal.aborted) return onAbort(); o.signal.addEventListener('abort',onAbort); }

    const line = (l) => {
      if(!l.trim()) return;
      let ev; try{ ev = JSON.parse(l); }catch(e){ return; }
      if(ev.type==='stream_event' && ev.event && ev.event.type==='content_block_delta' && ev.event.delta && ev.event.delta.type==='text_delta' && ev.event.delta.text){
        got++; try{ onDelta(ev.event.delta.text); }catch(e){}
      } else if(ev.type==='result') result = ev;
    };
    child.stdout.setEncoding('utf8');
    child.stdout.on('data',d=>{ buf += d; let i; while((i = buf.indexOf('\n'))>=0){ line(buf.slice(0,i)); buf = buf.slice(i+1); } });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data',d=>{ if(err.length<4000) err += d; });
    child.on('error',e=>done(reject,e.code==='ENOENT' ? new ProviderError(400,NOT_FOUND) : new ProviderError(502,'Couldn’t start Claude Code: ' + e.message)));
    child.on('close',code=>{
      line(buf);
      if(result && result.is_error) return done(reject,friendly(result.result || (result.errors || []).join(' ') || result.subtype));
      if(code!==0 && !got) return done(reject,friendly(err || (result && result.result) || `Claude Code exited with code ${code}.`));
      if(!got){
        // no partial chunks (older CLI): fall back to the final text
        if(result && typeof result.result==='string' && result.result){ onDelta(result.result); return done(resolve); }
        return done(reject,new ProviderError(502,NO_TEXT));
      }
      done(resolve);
    });
    child.stdin.on('error',()=>{});
    child.stdin.end(o.prompt);   // stdin, not argv: prompts can be long
  });
}

const listModels = async () => { if(!bin()) throw new ProviderError(400,NOT_FOUND); return MODELS.slice(); };
module.exports = { streamClaudeCode, listModels, available, bin, MODELS };
