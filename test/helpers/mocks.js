'use strict';
// One local HTTP server that imitates every provider Cascade talks to, so tests never touch the network.
//   /anthropic/...        Anthropic Messages API
//   /openai/v1/...        OpenAI Chat Completions (model "strict" rejects temperature and max_tokens)
//   /openrouter/api/v1/.. OpenRouter: models, OAuth key exchange, Chat Completions
//   /chatgpt-auth/...     "Sign in with ChatGPT": authorize, token (real RS256 ID tokens), JWKS, revoke
//   /chatgpt-api/v1/...   Responses API + model catalog for ChatGPT plan usage
const http = require('http'), crypto = require('crypto');

function start(){
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa',{ modulusLength:2048 });
  const jwk = Object.assign(publicKey.export({ format:'jwk' }),{ kid:'test-key', alg:'RS256', use:'sig' });
  const b64u = (b) => Buffer.from(b).toString('base64url');
  const sign = (claims) => {
    const h = b64u(JSON.stringify({ alg:'RS256', kid:'test-key', typ:'JWT' })), p = b64u(JSON.stringify(claims));
    return `${h}.${p}.${b64u(crypto.sign('sha256',Buffer.from(h+'.'+p),privateKey))}`;
  };
  const log = [];
  const state = {
    script:null, deny:false, noPlan:false, expiresIn:3600, usageLimit:false, expire401Once:false, badSignature:false,
    codes:new Map(), refreshTokens:new Set(['rt-1']), seq:1, orKeyOk:true
  };
  const json = (res,code,o) => { res.writeHead(code,{ 'content-type':'application/json' }); res.end(JSON.stringify(o)); };
  const sse = (res,events) => { res.writeHead(200,{ 'content-type':'text/event-stream' }); for(const e of events) res.write(e); res.end(); };
  const chatSse = (res,parts) => sse(res,[...parts.map(t=>'data: '+JSON.stringify({ choices:[{ delta:{ content:t } }] })+'\n\n'),'data: [DONE]\n\n']);

  const server = http.createServer((req,res)=>{
    let body = ''; req.on('data',c=>body += c);
    req.on('end',()=>{
      const url = new URL(req.url,'http://x'), p = url.pathname, auth = req.headers.authorization || '';
      let j = {}; const isJson = (req.headers['content-type'] || '').includes('json');
      if(body && isJson){ try{ j = JSON.parse(body); }catch(e){} }
      log.push({ method:req.method, path:p, query:url.search, headers:req.headers, body:j, raw:body });

      // ---- Anthropic ----
      if(p==='/anthropic/v1/models'){
        if(req.headers['x-api-key']!=='ant-key-1234') return json(res,401,{ error:{ message:'invalid x-api-key' } });
        return json(res,200,{ data:[{ id:'claude-haiku-5-5' },{ id:'claude-sonnet-5-5' }] });
      }
      if(p==='/anthropic/v1/messages'){
        if(req.headers['x-api-key']!=='ant-key-1234') return json(res,401,{ error:{ type:'authentication_error', message:'invalid x-api-key' } });
        const ev = (o) => 'event: '+o.type+'\ndata: '+JSON.stringify(o)+'\n\n';
        return sse(res,[ev({ type:'message_start' }),...['{"id":"g1",','"type":"answer"}'].map(t=>ev({ type:'content_block_delta', delta:{ type:'text_delta', text:t } })),ev({ type:'message_stop' })]);
      }
      if(p==='/anthropic-hang/v1/messages'){   // starts streaming and never finishes
        res.writeHead(200,{ 'content-type':'text/event-stream' });
        return res.write('event: content_block_delta\ndata: '+JSON.stringify({ type:'content_block_delta', delta:{ type:'text_delta', text:'hi' } })+'\n\n');
      }
      // ---- OpenAI Chat Completions ----
      if(p==='/openai/v1/models'){
        if(auth!=='Bearer oa-key-9999') return json(res,401,{ error:{ message:'Incorrect API key provided' } });
        return json(res,200,{ data:[{ id:'gpt-x-mini' },{ id:'gpt-x' },{ id:'text-embedding-3-small' }] });
      }
      if(p==='/openai/v1/chat/completions'){
        if(auth!=='Bearer oa-key-9999') return json(res,401,{ error:{ message:'Incorrect API key provided' } });
        const bad = (m) => json(res,400,{ error:{ message:m } });
        if(j.model==='strict'){
          if('temperature' in j) return bad("Unsupported value: 'temperature' does not support 0.7 with this model.");
          if('max_tokens' in j) return bad("Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.");
        }
        if(j.model==='empty') return chatSse(res,['']);
        if(typeof state.script==='function'){   // a test can script the reply from the prompt
          const text = state.script((j.messages && j.messages[0] && j.messages[0].content) || '');
          if(typeof text==='string') return chatSse(res,text.match(/[\s\S]{1,48}/g) || ['']);
        }
        return chatSse(res,['{"id":"g1",','"type":"answer"}']);
      }
      // ---- OpenRouter ----
      if(p==='/openrouter/api/v1/models') return json(res,200,{ data:[
        { id:'anthropic/claude-old-haiku', created:100 }, { id:'anthropic/claude-new-haiku', created:900 },
        { id:'openai/gpt-new-mini', created:800 }, { id:'some-lab/model-x', created:950 }, { id:'google/gemini-flash:free', created:990 } ] });
      if(p==='/openrouter/api/v1/auth/keys'){
        const ok = state.orKeyOk && j.code==='or-code-1' && j.code_challenge_method==='S256' && typeof j.code_verifier==='string' && j.code_verifier.length>=43;
        return ok ? json(res,200,{ key:'sk-or-test-key', user_id:'u1' }) : json(res,400,{ error:{ message:'Invalid or expired code' } });
      }
      if(p==='/openrouter/api/v1/chat/completions'){
        if(auth==='Bearer sk-or-broke') return json(res,402,{ error:{ message:'Insufficient credits' } });
        if(auth!=='Bearer sk-or-test-key') return json(res,401,{ error:{ message:'No auth credentials found' } });
        // OpenRouter sends comment lines like this while it routes the request; clients must ignore them
        return sse(res,[': OPENROUTER PROCESSING\n\n',...['{"id":"g1",','"type":"answer"}'].map(t=>'data: '+JSON.stringify({ choices:[{ delta:{ content:t } }] })+'\n\n'),'data: [DONE]\n\n']);
      }
      // ---- ChatGPT sign-in ----
      if(p==='/chatgpt-auth/.well-known/jwks.json') return json(res,200,{ keys:[jwk] });
      if(p==='/chatgpt-auth/.well-known/openid-configuration') return json(res,200,{ revocation_endpoint:`http://${req.headers.host}/chatgpt-auth/api/accounts/oauth/revoke` });
      if(p==='/chatgpt-auth/api/accounts/authorize'){
        const q = url.searchParams, ru = q.get('redirect_uri');
        const back = new URL(ru);
        if(state.deny){ back.searchParams.set('error','access_denied'); back.searchParams.set('state',q.get('state')); res.writeHead(302,{ location:back.toString() }); return res.end(); }
        const code = 'code-'+(++state.seq), clientId = q.get('client_id')==='dynamic_agent_client' ? 'oaiapp_test123' : q.get('client_id');
        state.codes.set(code,{ challenge:q.get('code_challenge'), nonce:q.get('nonce'), clientId, redirect:ru, resource:q.get('resource') });
        back.searchParams.set('code',code); back.searchParams.set('state',q.get('state'));
        if(q.get('client_id')==='dynamic_agent_client') back.searchParams.set('client_id',clientId);
        res.writeHead(302,{ location:back.toString() }); return res.end();
      }
      if(p==='/chatgpt-auth/api/accounts/oauth/token'){
        const f = Object.fromEntries(new URLSearchParams(body)), now = Math.floor(Date.now()/1000);
        if(f.grant_type==='authorization_code'){
          const c = state.codes.get(f.code); state.codes.delete(f.code);
          const challenge = crypto.createHash('sha256').update(f.code_verifier || '').digest('base64url');
          if(!c || c.challenge!==challenge || f.client_id!==c.clientId || f.redirect_uri!==c.redirect) return json(res,400,{ error:'invalid_grant', error_description:'bad code or verifier' });
          const scope = 'openid profile email offline_access' + (state.noPlan ? '' : ' resource.invoke chatgpt.tokens.use.direct');
          const id_token = sign({ iss:'https://auth.openai.com', aud:c.clientId, sub:'user-1', email:'dev@example.com', nonce:state.badNonce ? 'wrong' : c.nonce, exp:now+3600, iat:now });
          const tampered = state.badSignature ? id_token.slice(0,-4)+'AAAA' : id_token;
          state.refreshTokens.add('rt-1');
          return json(res,200,{ access_token:'at-1', refresh_token:'rt-1', id_token:tampered, expires_in:state.expiresIn, token_type:'Bearer', scope });
        }
        if(f.grant_type==='refresh_token'){
          if(!state.refreshTokens.has(f.refresh_token) || f.client_id!=='oaiapp_test123') return json(res,400,{ error:'invalid_grant', error_description:'refresh token not valid' });
          state.refreshTokens.delete(f.refresh_token);
          const n = ++state.seq, rt = 'rt-'+n; state.refreshTokens.add(rt);
          return json(res,200,{ access_token:'at-'+n, refresh_token:rt, expires_in:state.expiresIn, token_type:'Bearer' });
        }
        return json(res,400,{ error:'unsupported_grant_type' });
      }
      if(p==='/chatgpt-auth/api/accounts/oauth/revoke'){ state.revoked = Object.fromEntries(new URLSearchParams(body)); state.refreshTokens.clear(); res.writeHead(200); return res.end(); }
      // ---- ChatGPT plan usage API ----
      if(p==='/chatgpt-api/v1/models'){
        if(!/^Bearer at-/.test(auth)) return json(res,401,{ detail:'bad token' });
        return json(res,200,{ models:[{ slug:'gpt-plan-mini', display_name:'Plan Mini', visibility:'list' },{ slug:'gpt-plan-big', display_name:'Plan Big', visibility:'list' },{ slug:'internal-x', visibility:'hide' }] });
      }
      if(p==='/chatgpt-api/v1/responses'){
        if(state.expire401Once){ state.expire401Once = false; return json(res,401,{ detail:'expired' }); }
        if(!/^Bearer at-/.test(auth)) return json(res,401,{ detail:'bad token' });
        if(state.usageLimit) return json(res,429,{ error:{ code:'subscription_sharing_usage_limit_exceeded', message:'limit' } });
        const bad = ['temperature','max_output_tokens','previous_response_id','top_p'].find(k=>k in j);
        if(bad) return json(res,400,{ error:{ code:'subscription_sharing_unsupported_capability', param:bad, message:'nope' } });
        if(j.store!==false || j.stream!==true || !Array.isArray(j.input) || !j.instructions || j.input.some(i=>i.role==='system')) return json(res,400,{ error:{ code:'invalid_request', message:'bad shape' } });
        const ev = (t,o) => 'event: '+t+'\ndata: '+JSON.stringify(Object.assign({ type:t },o))+'\n\n';
        return sse(res,[ev('response.created',{}),ev('response.output_text.delta',{ delta:'{"id":"g1",' }),ev('response.output_text.delta',{ delta:'"type":"answer"}' }),ev('response.completed',{ response:{ id:'r1' } })]);
      }
      res.writeHead(404); res.end('not found');
    });
  });
  return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>{
    const port = server.address().port, base = `http://127.0.0.1:${port}`;
    resolve({
      port, base, log, state,
      env:{
        ANTHROPIC_BASE_URL:base+'/anthropic', OPENAI_BASE_URL:base+'/openai/v1', OPENROUTER_BASE_URL:base+'/openrouter/api/v1',
        CASCADE_CHATGPT_AUTH_BASE:base+'/chatgpt-auth', CASCADE_CHATGPT_API_BASE:base+'/chatgpt-api/v1'
      },
      close:() => new Promise(r=>{ server.closeAllConnections && server.closeAllConnections(); server.close(()=>r()); })
    });
  }));
}
module.exports = { start };
