'use strict';
/* ================= source-to-mindset workspace ================= */
const MSCONVERT = {ctl:null,units:null,warnings:[],draft:null,task:null};
function conversionBusy(on){
  $('#msConverter').querySelectorAll('input,textarea,button').forEach(el=>{ el.disabled = on && el.id!=='mcStop'; });
  $('#mcStop').hidden = !on;
}
function clearMindsetDraft(){
  MSCONVERT.draft = null; $('#mcReview').hidden = true; $('#mcJson').value = ''; $('#mcEntries').textContent = '';
}
function renderMindsetDraft(pack,report){
  MSCONVERT.draft = pack; $('#mcJson').value = JSON.stringify(pack,null,2); $('#mcReview').hidden = false;
  $('#mcReport').textContent = report; const list = $('#mcEntries'); list.textContent = '';
  for(const entry of pack.entries){
    const details = document.createElement('details'), summary = document.createElement('summary');
    summary.textContent = `${entry.label}${entry.number ? ' #'+entry.number : ''}: ${entry.name}`;
    details.appendChild(summary);
    const info = document.createElement('p'); info.className = 'small'; info.textContent = 'Topics: '+entry.topics.join(', '); details.appendChild(info);
    for(const question of entry.questions){ const p = document.createElement('p'); p.textContent = question; details.appendChild(p); }
    const refs = document.createElement('p'); refs.className = 'small'; refs.textContent = entry.references.map(r=>r.source+' — '+r.location).join('; '); details.appendChild(refs);
    list.appendChild(details);
  }
}
async function extractMindsetPdf(file,{signal,onProgress} = {},loader){
  const base = new URL('vendor/pdfjs/',document.baseURI);
  let lib;
  try{ lib = await (loader ? loader() : import(new URL('pdf.mjs',base).href)); }
  catch(e){ throw new Error('PDF reader could not load. Run npm install and restart locally, or rebuild the hosted app. You can also paste exported text.'); }
  if(signal && signal.aborted) throw new DOMException('Stopped','AbortError');
  lib.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.mjs',base).href;
  const loading = lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),cMapUrl:new URL('cmaps/',base).href,cMapPacked:true,
    standardFontDataUrl:new URL('standard_fonts/',base).href,isEvalSupported:false,useWasm:false});
  const abort = () => { loading.destroy().catch(()=>{}); };
  if(signal) signal.addEventListener('abort',abort,{once:true});
  const units = []; let size = 0, empty = 0;
  try{
    const pdf = await loading.promise;
    if(pdf.numPages>1000) throw new Error('PDF has more than 1,000 pages. Split it into smaller documents.');
    for(let i=1;i<=pdf.numPages;i++){
      if(signal && signal.aborted) throw new DOMException('Stopped','AbortError');
      if(onProgress) onProgress(`Reading ${file.name}: page ${i} of ${pdf.numPages}…`);
      const page = await pdf.getPage(i), content = await page.getTextContent();
      const text = content.items.map(item=>typeof item.str==='string' ? item.str+(item.hasEOL ? '\n' : ' ') : '').join('').trim(); page.cleanup();
      size += text.length;
      if(size>MindsetConversion.MAX_TEXT) throw new Error('PDF text exceeds 2 million characters. Split it into smaller documents.');
      if(text) units.push({text,source:file.name,location:'PDF page '+i}); else empty++;
    }
    if(!units.length) throw new Error('No readable text in this PDF. Run OCR or paste a text export first.');
    return {units,warnings:empty ? [`${file.name}: ${empty} ${empty===1?'page had':'pages had'} no readable text (images or blank pages).`] : []};
  }finally{
    if(signal) signal.removeEventListener('abort',abort);
    await loading.destroy().catch(()=>{});
  }
}
async function extractMindsetFile(file,options){
  if(file.size>25*1024*1024) throw new Error('Each source file must be smaller than 25 MB.');
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if(ext==='pdf') return extractMindsetPdf(file,options);
  if(!['txt','md','markdown','html','htm','json','csv','tsv','xml','yaml','yml','log'].includes(ext)) throw new Error('Unsupported file. Export it as PDF, TXT, Markdown, HTML, JSON, CSV, XML or YAML.');
  let text = await file.text();
  if(ext==='html' || ext==='htm'){
    const doc = new DOMParser().parseFromString(text,'text/html');
    doc.querySelectorAll('script,style,template,noscript,svg').forEach(el=>el.remove());
    doc.querySelectorAll('p,div,section,article,li,tr,br,h1,h2,h3,h4').forEach(el=>el.appendChild(doc.createTextNode('\n')));
    text = doc.body.textContent;
  }
  return {units:MindsetConversion.textUnits(text,file.name),warnings:[]};
}
async function readMindsetSources(files){
  if(!files.length) return;
  if(files.length>8){ $('#mcStatus').textContent = 'Choose up to 8 source files at once.'; return; }
  cancelAI(); clearMindsetDraft();
  const c = new AbortController(); MSCONVERT.ctl = c; conversionBusy(true);
  try{
    let units = [], warnings = [];
    for(const file of files){
      if(c.signal.aborted) return;
      $('#mcStatus').textContent = 'Reading '+file.name+'…';
      const result = await extractMindsetFile(file,{signal:c.signal,onProgress:message=>{ $('#mcStatus').textContent = message; }});
      if(c.signal.aborted) return;
      units = units.concat(result.units); warnings = warnings.concat(result.warnings);
    }
    const chunks = MindsetConversion.chunks(units);
    MSCONVERT.units = units; MSCONVERT.warnings = warnings;
    $('#mcText').value = units.map(u=>u.text).join('\n\n');
    if(!$('#mcName').value.trim()) $('#mcName').value = files[0].name.replace(/\.[^.]+$/,'').slice(0,80);
    if(!$('#mcSourceTitle').value.trim()) $('#mcSourceTitle').value = files.map(f=>f.name).join(', ').slice(0,200);
    $('#mcSourceInfo').textContent = `${files.length} ${files.length===1?'file':'files'}, ${units.length} source ${units.length===1?'section':'sections'}. ${chunks.length} provider ${chunks.length===1?'call':'calls'} for full extracted-text coverage. ${warnings.join(' ')}`;
    $('#mcStatus').textContent = chunks.length ? 'Source ready. Check the name and allowed domains, then generate a draft.' : 'No readable text found.';
  }catch(e){ $('#mcStatus').textContent = c.signal.aborted ? 'Reading stopped.' : e.message; }
  finally{ if(MSCONVERT.ctl===c){ if(c.signal.aborted) $('#mcStatus').textContent = 'Reading stopped.'; MSCONVERT.ctl = null; conversionBusy(false); } }
}
function conversionOptions(){
  const name = $('#mcName').value.trim(), domains = [...$('#mcDomains').querySelectorAll('input:checked')].map(el=>el.value);
  if(!name) throw new Error('Name the mindset first.');
  if(!domains.length) throw new Error('Choose at least one allowed domain.');
  const limit = Number($('#mcLimit').value);
  if(!Number.isInteger(limit) || limit<1 || limit>200) throw new Error('Maximum entries must be between 1 and 200.');
  const source = {title:$('#mcSourceTitle').value.trim() || name,edition:$('#mcEdition').value.trim(),url:$('#mcUrl').value.trim()};
  if(source.url){ try{ if(!['http:','https:'].includes(new URL(source.url).protocol)) throw new Error(); }catch(e){ throw new Error('Use an http or https source link.'); } }
  return {name,domains,limit,source};
}
function generateMindsetDraft(){
  let options, chunks;
  try{
    options = conversionOptions();
    const text = $('#mcText').value;
    chunks = MindsetConversion.chunks(MSCONVERT.units || MindsetConversion.textUnits(text,'Pasted text'));
    if(!chunks.length || !text.trim()) throw new Error('Add readable source material first.');
    if(!aiAvailable() || ((LOCAL || WEB) && activeProvider()==='demo')) throw new Error('Connect a provider in Settings > AI model. Demo mode cannot convert source material.');
  }catch(e){ $('#mcStatus').textContent = e.message; return; }
  cancelAI(); clearMindsetDraft();
  const c = new AbortController(), warnings = [...MSCONVERT.warnings]; MSCONVERT.ctl = c; conversionBusy(true);
  $('#mcStatus').textContent = `Queued conversion: up to ${chunks.length} provider ${chunks.length===1?'call':'calls'}.`;
  MSCONVERT.task = enqueue(async()=>{
    ctl = c; setBusy('Converting mindset source…',true);
    let entries = [], processed = 0, rejected = 0, limited = false, failure = '';
    try{
      for(let i=0;i<chunks.length;i++){
        if(c.signal.aborted) break;
        $('#mcStatus').textContent = `Converting chunk ${i+1} of ${chunks.length}… ${entries.length} ${entries.length===1?'entry':'entries'} collected.`;
        setBusy(`Converting mindset source: ${i+1}/${chunks.length}…`,true);
        const output = await callAI(MindsetConversion.prompt(chunks[i],options,i,chunks.length),{cache:false,signal:c.signal,temperature:0.2});
        if(c.signal.aborted) break;
        const result = MindsetConversion.groundedEntries(parseObj(output.text),chunks[i],options.domains); rejected += result.rejected;
        const merged = MindsetConversion.merge(entries,result.entries);
        entries = merged.slice(0,options.limit); processed++;
        if(merged.length>options.limit || (entries.length>=options.limit && processed<chunks.length)){ limited = true; break; }
      }
    }catch(e){ if(!c.signal.aborted) failure = e.message || 'Provider conversion failed.'; }
    finally{
      const complete = processed===chunks.length && !limited && !failure && !c.signal.aborted;
      const coverage = `${complete ? 'Complete extracted-text pass' : 'Partial conversion'}: ${processed}/${chunks.length} chunks. ${entries.length} ${entries.length===1?'entry':'entries'}. ${warnings.join(' ')}`;
      const report = coverage+(limited ? ' Entry limit reached.' : '')+(c.signal.aborted ? ' Stopped by user or tree change.' : '')+(failure ? ' '+failure : '')+(rejected ? ` ${rejected} ungrounded entries rejected.` : '');
      if(entries.length){
        const pack = Mindsets.pack({schemaVersion:1,id:MindsetConversion.slug(options.name),version:'1.0.0',name:options.name,icon:'💡',domains:options.domains,
          source:{...options.source,coverage},guidance:'Use these approaches only when the branch topic and goal fit.',entries});
        renderMindsetDraft(pack,report);
      }
      $('#mcStatus').textContent = entries.length ? 'Draft ready for review. '+report : 'No draft entries produced. '+report;
      if(MSCONVERT.ctl===c){ MSCONVERT.ctl = null; conversionBusy(false); }
      if(ctl===c){ ctl = null; setBusy(null);  }
    }
  });
  return MSCONVERT.task;
}
function reviewedMindsetDraft(){ return Mindsets.pack(JSON.parse($('#mcJson').value)); }
$('#mcFiles').addEventListener('change',e=>{ readMindsetSources([...e.target.files]); });
$('#mcText').addEventListener('input',()=>{
  MSCONVERT.units = null; MSCONVERT.warnings = []; clearMindsetDraft();
  try{ const chunks = MindsetConversion.chunks(MindsetConversion.textUnits($('#mcText').value,'Pasted text')); $('#mcSourceInfo').textContent = `${chunks.length} provider ${chunks.length===1?'call':'calls'} for full extracted-text coverage. Pasted text uses line references.`; }
  catch(e){ $('#mcSourceInfo').textContent = e.message; }
});
for(const id of ['mcName','mcSourceTitle','mcEdition','mcUrl','mcLimit','mcDomains']) $('#'+id).addEventListener('change',clearMindsetDraft);
$('#mcGenerate').addEventListener('click',generateMindsetDraft);
$('#mcStop').addEventListener('click',()=>{ if(MSCONVERT.ctl) MSCONVERT.ctl.abort(); });
$('#mcImport').addEventListener('click',()=>{
  try{ const pack = reviewedMindsetDraft(); importMindsets(pack); $('#mcStatus').textContent = 'Imported '+pack.name+'.'; }
  catch(e){ $('#mcStatus').textContent = e.message; }
});
$('#mcDownload').addEventListener('click',()=>{
  try{ const pack = reviewedMindsetDraft(); downloadMindset(pack,pack.id+'.mindset.json'); }
  catch(e){ $('#mcStatus').textContent = e.message; }
});
