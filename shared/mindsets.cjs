'use strict';
/* Mindsets are portable tree data. Domain and topic gates run before any pack reaches a model. */
const Mindsets = (() => {
  const domains = ['general','product','research','game'];
  const text = (v,max) => typeof v==='string' ? v.trim().slice(0,max) : '';
  const number = v => text(Number.isFinite(v) ? String(v) : v,20);
  const identifier = v => typeof v==='string' && /^[a-z0-9][a-z0-9._-]{0,79}$/i.test(v);
  const references = v => (Array.isArray(v) ? v : []).filter(r=>r && typeof r.source==='string' && typeof r.location==='string').slice(0,12).map(r=>({source:text(r.source,160),location:text(r.location,100)}));
  function source(v){
    v = v || {}; let url = '';
    try{ const u = new URL(v.url); if(u.protocol==='https:' || u.protocol==='http:') url = u.href.slice(0,1000); }catch(e){}
    return {title:text(v.title,200),edition:text(v.edition,80),url,coverage:text(v.coverage,300)};
  }
  function strings(v,max,count){
    if(!Array.isArray(v) || !v.length || v.length>count || v.some(s=>typeof s!=='string' || !s.trim() || s.length>max)) throw new Error('Use a non-empty list of short strings.');
    return [...new Set(v.map(s=>s.trim()))];
  }
  function pack(v){
    if(!v || v.schemaVersion!==1 || !identifier(v.id) || !text(v.name,80)) throw new Error('Mindset needs schemaVersion 1, an id, and a name.');
    const allowed = strings(v.domains,20,4);
    if(allowed.some(d=>!domains.includes(d))) throw new Error('Domains must be general, product, research, or game.');
    if(!Array.isArray(v.entries) || !v.entries.length || v.entries.length>200) throw new Error('A mindset needs 1 to 200 entries.');
    const ids = new Set();
    const entries = v.entries.map(e=>{
      if(!e || !identifier(e.id) || ids.has(e.id) || !text(e.name,100)) throw new Error('Each entry needs a unique id and a name.');
      ids.add(e.id);
      const ed = e.domains===undefined ? allowed : strings(e.domains,20,4);
      if(ed.some(d=>!allowed.includes(d))) throw new Error('Entry domains must belong to the pack domains.');
      return {id:e.id,name:text(e.name,100),label:text(e.label,30)||'Lens',number:number(e.number),domains:ed,
        topics:strings(e.topics,80,30),appliesWhen:text(e.appliesWhen,400),questions:strings(e.questions,400,12),references:references(e.references)};
    });
    return {schemaVersion:1,id:v.id,version:text(v.version,30)||'1.0.0',name:text(v.name,80),icon:text(v.icon,16)||'💡',
      domains:allowed,guidance:text(v.guidance,1200),source:source(v.source),entries};
  }
  function collection(v){
    if(v===undefined) return [];
    if(!Array.isArray(v) || v.length>12) throw new Error('A Cascade can hold up to 12 mindsets.');
    const ids = new Set();
    return v.map(p=>{ const clean = pack(p); if(ids.has(clean.id)) throw new Error('Duplicate mindset id.'); ids.add(clean.id); return {...clean,enabled:p.enabled!==false}; });
  }
  const words = s => String(s||'').normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  function matches(topic,context){
    const t = words(topic), c = ' '+words(context).join(' ')+' ';
    return t.length>0 && c.includes(' '+t.join(' ')+' ');
  }
  function candidates(packs,domain,context,only){
    const groups = [];
    for(const p of packs || []){
      if(!p.enabled || (only && p.id!==only) || !p.domains.includes(domain)) continue;
      groups.push(p.entries.filter(e=>e.domains.includes(domain) && e.topics.some(t=>matches(t,context))).map(e=>({pack:p,entry:e})));
    }
    // Give each matching pack a turn so a large lens collection cannot crowd out smaller mindsets.
    const out = [];
    for(let i=0; out.length<12 && groups.some(g=>g[i]); i++) for(const group of groups){ if(group[i] && out.length<12) out.push(group[i]); }
    return out;
  }
  function snapshot(p,e,why){
    return {packId:p.id,packVersion:p.version,packName:p.name,entryId:e.id,name:e.name,label:e.label,number:e.number,icon:p.icon,source:{...p.source},references:references(e.references),why:text(why,300)};
  }
  function metadata(v){
    if(!v || !identifier(v.packId) || !identifier(v.entryId) || !text(v.name,100)) return null;
    return {packId:v.packId,entryId:v.entryId,packVersion:text(v.packVersion,30),packName:text(v.packName,80),name:text(v.name,100),
      label:text(v.label,30)||'Lens',number:number(v.number),icon:text(v.icon,16)||'💡',
      source:source(v.source),references:references(v.references),why:text(v.why,300)};
  }
  const label = (m,withIcon = true) => `${withIcon ? m.icon+' ' : ''}${m.label}${m.number ? ' #'+m.number : ''}: ${m.name}`;
  return {pack,collection,candidates,snapshot,metadata,label};
})();
if(typeof module!=='undefined' && module.exports) module.exports = Mindsets;
