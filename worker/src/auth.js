// Sign in with Google (ID token verification) and browser sessions. Uses only Web Crypto, so it runs in Workers and Node.
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['https://accounts.google.com','accounts.google.com'];
export const SESSION_DAYS = 30;
export const COOKIE = 'cascade_session';

const enc = new TextEncoder();
const b64uToBytes = (s) => { s = s.replace(/-/g,'+').replace(/_/g,'/'); s += '='.repeat((4 - s.length % 4) % 4); return Uint8Array.from(atob(s),c=>c.charCodeAt(0)); };
const bytesToHex = (buf) => [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
const bytesToB64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const parseJSON = (bytes) => JSON.parse(new TextDecoder().decode(bytes));

let jwksCache = { at:0, keys:null };
async function googleKeys(fetchImpl){
  if(jwksCache.keys && Date.now() - jwksCache.at < 3600e3) return jwksCache.keys;
  const r = await fetchImpl(JWKS_URL); if(!r.ok) throw new Error('Could not load Google’s signing keys.');
  jwksCache = { at:Date.now(), keys:(await r.json()).keys || [] };
  return jwksCache.keys;
}
export const resetKeyCache = () => { jwksCache = { at:0, keys:null }; };

// Returns { sub, email, name, picture } for a valid Google ID token issued to `clientId`, or throws.
export async function verifyGoogleToken(token,{ clientId, fetchImpl = fetch, now = Date.now() }){
  if(!clientId || /^REPLACE/.test(clientId)) throw new Error('Google sign-in is not configured on this server.');
  const parts = typeof token==='string' ? token.split('.') : [];
  if(parts.length!==3) throw new Error('That is not a Google ID token.');
  const head = parseJSON(b64uToBytes(parts[0])), claims = parseJSON(b64uToBytes(parts[1]));
  if(head.alg!=='RS256') throw new Error('Unsupported token algorithm.');
  const jwk = (await googleKeys(fetchImpl)).find(k=>k.kid===head.kid);
  if(!jwk) throw new Error('The token was signed with an unknown key.');
  const key = await crypto.subtle.importKey('jwk',jwk,{ name:'RSASSA-PKCS1-v1_5', hash:'SHA-256' },false,['verify']);
  const good = await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,b64uToBytes(parts[2]),enc.encode(parts[0]+'.'+parts[1]));
  if(!good) throw new Error('The token signature is not valid.');
  if(!ISSUERS.includes(claims.iss)) throw new Error('The token was not issued by Google.');
  if(claims.aud!==clientId) throw new Error('The token was issued to a different app.');
  if(!(claims.exp*1000 > now)) throw new Error('The token has expired. Try signing in again.');
  if(!claims.sub || !claims.email || claims.email_verified===false) throw new Error('Your Google account has no verified email.');
  return { sub:String(claims.sub), email:String(claims.email), name:String(claims.name || ''), picture:String(claims.picture || '') };
}

export async function sha256Hex(text){ return bytesToHex(await crypto.subtle.digest('SHA-256',enc.encode(text))); }
export const newToken = () => bytesToB64u(crypto.getRandomValues(new Uint8Array(32)));

export function readCookie(request,name = COOKIE){
  const m = (request.headers.get('cookie') || '').split(/;\s*/).find(c=>c.startsWith(name+'='));
  return m ? decodeURIComponent(m.slice(name.length+1)) : '';
}
export const sessionCookie = (token,days = SESSION_DAYS) =>
  `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${token ? days*86400 : 0}`;
