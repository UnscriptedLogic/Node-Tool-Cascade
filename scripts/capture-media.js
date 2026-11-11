#!/usr/bin/env node
'use strict';
// Regenerates the screenshots and GIFs in docs/media by driving the real app in a real browser, using the built-in demo AI
// so no key is needed and the results are repeatable.
//
//   npm i --no-save puppeteer-core gifenc pngjs
//   node scripts/capture-media.js            (set CHROME=/path/to/chrome if it is not found)
const fs = require('fs'), os = require('os'), path = require('path'), { spawn } = require('child_process');
const puppeteer = require('puppeteer-core'), { GIFEncoder, quantize, applyPalette } = require('gifenc'), { PNG } = require('pngjs');

const ROOT = path.resolve(__dirname,'..'), OUT = path.join(ROOT,'docs','media'), PORT = 4391, BASE = `http://localhost:${PORT}`;
const W = 1280, H = 800, SCALE = 0.8;   // a roomy window, captured at 80% so the files stay small
const sleep = (ms) => new Promise(r=>setTimeout(r,ms));
const CHROMES = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const chrome = CHROMES.find(p=>fs.existsSync(p)); if(!chrome) throw new Error('No Chrome or Edge found. Set CHROME.');

async function api(method,p,body){ const r = await fetch(BASE+'/api/'+p,{ method, headers:{ 'content-type':'application/json' }, body:body ? JSON.stringify(body) : undefined }); return r.json(); }

// ---- gif: a list of PNG buffers, each with how long to show it ----
function writeGif(name,frames){
  const first = PNG.sync.read(frames[0].png), gif = GIFEncoder();
  for(const f of frames){
    const img = PNG.sync.read(f.png), data = new Uint8Array(img.data.buffer,img.data.byteOffset,img.data.length);
    const palette = quantize(data,256,{ format:'rgb444' });
    gif.writeFrame(applyPalette(data,palette,'rgb444'),first.width,first.height,{ palette, delay:f.ms });
  }
  gif.finish(); fs.writeFileSync(path.join(OUT,name),gif.bytes());
  console.log('  wrote',name,Math.round(gif.bytes().length/1024)+' KB,',frames.length,'frames');
}
async function shot(page){ return Buffer.from(await page.screenshot({ type:'png' })); }
// grab frames for `ms` milliseconds, one every `every` ms
async function record(page,frames,ms,every = 220){
  const t0 = Date.now();
  while(Date.now()-t0<ms){ const t = Date.now(); frames.push({ png:await shot(page), ms:every }); const left = every-(Date.now()-t); if(left>0) await sleep(left); }
}
const hold = async (page,frames,ms) => { frames.push({ png:await shot(page), ms }); };

async function main(){
  fs.mkdirSync(OUT,{ recursive:true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'cascade-media-'));
  const srv = spawn(process.execPath,[path.join(ROOT,'server','server.js')],{ env:{ ...process.env, NO_OPEN:'1', PORT:String(PORT), CASCADE_DATA_DIR:dir }, stdio:'ignore' });
  for(let i=0;i<60;i++){ try{ await fetch(BASE+'/api/ping'); break; }catch(e){ await sleep(100); } }
  const browser = await puppeteer.launch({ executablePath:chrome, headless:true, defaultViewport:{ width:W, height:H, deviceScaleFactor:SCALE }, args:['--no-sandbox','--hide-scrollbars'] });
  try{
    await api('POST','settings',{ prefs:{ domain:'game', goal:'Make traversal feel like discovery, not a commute', steer:'balanced', autoGrow:false, autoTrace:true, pushback:true } });
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(()=>{ try{ localStorage.setItem('cascade-seen-settings','1'); }catch(e){} });
    const fresh = async () => {
      await page.goto(BASE,{ waitUntil:'domcontentloaded' }); await sleep(1200);
      await page.evaluate(()=>{ resetTree(); closeSide && closeSide(); });
      await sleep(700); await page.click('#zFit'); await sleep(900);
    };
    // work inside a named Cascade, so the library label shows in the corner
    await page.goto(BASE,{ waitUntil:'domcontentloaded' }); await sleep(1200);
    const folder = await api('POST','folders',{ name:'Game Dev' });
    const cid = await page.evaluate(async(fid)=>{ const m = await libCreate(libData(),'Traversal feel',fid); libRemember(m.id); return m.id; },folder.id);
    const nodeBy = async (text) => page.evaluateHandle((t)=>[...document.querySelectorAll('.node')].find(n=>n.querySelector('.txt') && n.querySelector('.txt').textContent.includes(t)),text);
    const clickNode = async (text) => { const h = await nodeBy(text); await h.asElement().click({ offset:{ x:30, y:12 } }); await sleep(350); return h.asElement(); };
    const clickBar = async (text,act) => { const el = await clickNode(text); await (await el.$(`[data-act=${act}]`)).click(); };

    console.log('hero');
    await fresh(); await page.screenshot({ path:path.join(OUT,'tree.png') });

    console.log('branching');
    { await fresh(); const f = [];
      await clickNode('Why does traversal feel slow'); await hold(page,f,900);
      const el = (await nodeBy('Why does traversal feel slow')).asElement(); await (await el.$('[data-act=grow]')).click();
      await record(page,f,5200); await hold(page,f,1800); writeGif('branching.gif',f);
      await page.screenshot({ path:path.join(OUT,'branching.png') }); }

    console.log('ask');
    { await fresh(); const f = []; await hold(page,f,700);
      await page.click('#askBtn'); await sleep(400);
      await page.type('#aQ','What is causing the boredom?',{ delay:35 }); await hold(page,f,700);
      await page.click('#aGo'); await record(page,f,3600); await hold(page,f,2000); writeGif('ask.gif',f);
      await page.screenshot({ path:path.join(OUT,'ask.png') }); }

    console.log('grill');
    { await fresh(); const f = []; await hold(page,f,600);
      await clickBar('Why does traversal feel slow','grill'); await sleep(2500); await hold(page,f,1500);
      const ta = await page.$('.gcard .gans'); await ta.type('Yes.',{ delay:60 }); await hold(page,f,700);
      await (await page.$('.gcard [data-gact=answer]')).click(); await record(page,f,2600); await hold(page,f,1500);
      await page.evaluate(el=>{ el.value = ''; },ta);
      await ta.type('Yes, but only in the first act, because we want players to learn the map by walking before any shortcut exists.',{ delay:22 }); await hold(page,f,700);
      await (await page.$('.gcard [data-gact=answer]')).click(); await record(page,f,2200); await hold(page,f,1800); writeGif('grill.gif',f);
      await page.screenshot({ path:path.join(OUT,'grill.png') }); }

    console.log('bridge');
    { await fresh(); const f = []; await hold(page,f,700);
      await page.click('.tile[data-type=emotion]'); await sleep(400);
      await page.type('#compose textarea','Relief when upgrades change how the player moves',{ delay:30 }); await hold(page,f,700);
      await page.click('#cOk'); await record(page,f,7000); await hold(page,f,2200); writeGif('bridge.gif',f);
      await page.screenshot({ path:path.join(OUT,'bridge.png') }); }

    console.log('bridge, gap');
    { await fresh(); const f = []; await hold(page,f,600);
      await page.click('.tile[data-type=emotion]'); await sleep(400);
      await page.type('#compose textarea','Dread of a dragon',{ delay:40 }); await hold(page,f,600);
      await page.click('#cOk'); await record(page,f,6500); await hold(page,f,2200); writeGif('bridge-gap.gif',f); }

    console.log('settings and library');
    { await fresh();
      await page.click('#setBtn'); await sleep(300); await page.click('.stabs [data-tab=goal]'); await sleep(300);
      await page.screenshot({ path:path.join(OUT,'domains.png') });
      const T = JSON.stringify({ nodes:{ n1:{ id:'n1', type:'loop', text:'Root', parent:null, ghost:false } }, order:['n1'], links:[], seq:1 });
      const fo = folder, fo2 = await api('POST','folders',{ name:'Client work' });
      await api('POST','cascades',{ name:'Combat pacing', folderId:fo.id, data:{ tree:T, prefs:{ domain:'game' } } });
            await api('POST','cascades',{ name:'Onboarding flow', folderId:fo2.id, data:{ tree:T, prefs:{ domain:'product' } } });
      await api('POST','cascades',{ name:'Interview study', data:{ tree:T, prefs:{ domain:'research' } } });
      await page.evaluate(()=>libRefresh()); await sleep(400);
      await page.click('.stabs [data-tab=library]'); await sleep(400);
      await page.screenshot({ path:path.join(OUT,'library.png') }); }
  } finally { await browser.close(); srv.kill(); try{ fs.rmSync(dir,{ recursive:true, force:true }); }catch(e){} }
}
main().then(()=>console.log('done'),e=>{ console.error(e); process.exit(1); });
