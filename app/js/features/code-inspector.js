/*
MIT License

Copyright (c) 2023 Phosphor Icons

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/
'use strict';
// Inspector owns presentation preferences; source evidence remains unchanged.
const CodeInspector = (() => {
  const defaults={spacing:1,layerGap:1,layers:8,scriptLimit:12,labels:true,wires:0,expandLayers:false};
  let settings={...defaults};
  try{const saved=JSON.parse(localStorage.getItem('cascade-map-visuals')||'null');if(saved)for(const key of ['spacing','layerGap','layers','scriptLimit','labels','wires'])if(typeof saved[key]===typeof defaults[key])settings[key]=saved[key];}catch(e){}
  const bounds={spacing:[.6,2],layerGap:[.6,2],layers:[1,8],scriptLimit:[6,48],wires:[0,3]};
  for(const [key,[min,max]] of Object.entries(bounds))settings[key]=Number.isFinite(settings[key])?Math.max(min,Math.min(max,settings[key])):defaults[key];
  function save(){try{localStorage.setItem('cascade-map-visuals',JSON.stringify(settings));}catch(e){}}
  function setup(){
    const root=$('#codeExplorer'),body=root.querySelector('.code-body');
    // One scrolling column; selected context stays above optional tools.
    const context=document.createElement('section');context.className='code-context';
    context.innerHTML='<span class="code-eyebrow">Selected</span><div id="codeSelectionMeta" class="small"></div><div id="codeSelectionStats" class="code-stats"></div>';
    body.prepend(context);context.prepend($('#codeSelection'));context.append($('#codeSource'),$('#codeDetails'),$('#codeOverview'));
    context.insertAdjacentHTML('beforeend',`
      <div id="codePreviewPanel" hidden>
        <strong id="codePreviewTitle"></strong>
        <p id="codePreviewStatus" class="small" role="status"></p>
        <button id="codePreviewDraft" class="btn" type="button">Preview draft</button>
        <button id="codePreviewClear" class="btn" type="button">Clear preview</button>
      </div>`);
    function section(title,icon,open=false){const panel=document.createElement('details');panel.className='code-section';panel.open=open;panel.innerHTML='<summary data-code-icon="'+icon+'">'+title+'</summary><div class="code-section-content"></div>';body.append(panel);return panel.lastElementChild;}
    const visual=section('Appearance','sliders-horizontal',true);
    visual.append(root.querySelector('[aria-label="Graph visualization"]'));
    visual.insertAdjacentHTML('beforeend',`
      <label class="code-field" title="Limit visible ownership levels. Systems = 1, scripts = 2, declarations = 3 and deeper.">Layers <select id="codeLayers"><option value="1">1 · Systems</option><option value="2">2 · Scripts</option><option value="3">3 · Declarations</option><option value="4">4 · Members</option><option value="8">All layers</option></select></label>
      <label class="code-field" title="Space between neighboring nodes.">Node spacing <span><input id="codeSpacing" type="range" min="60" max="200" step="10"><output id="codeSpacingValue"></output></span></label>
      <label class="code-field" title="Distance between parents and children.">Layer spacing <span><input id="codeLayerGap" type="range" min="60" max="200" step="10"><output id="codeLayerGapValue"></output></span></label>
      <label class="code-field" title="Maximum scripts shown in each system. Overall map limit still applies.">Scripts per system <select id="codeScriptLimit"><option>6</option><option>12</option><option>24</option><option>48</option></select></label>
      <label class="code-field" title="Choose connection routing for this map.">Connections <select id="codeWireStyle"><option value="0">Theme default</option><option value="1">Straight</option><option value="2">Curved</option><option value="3">Right angle</option></select></label>
      <label class="code-check" title="Show source paths and details when hovering over a node."><input id="codeLabels" type="checkbox"> Detailed node tooltips</label>
      <button id="codeResetVisuals" type="button" class="btn" title="Restore visual defaults without changing your systems.">Reset appearance</button>`);
    const browse=section('Browse','magnifying-glass');browse.append(root.querySelector('.code-nav'));
    const links=section('Connections','git-branch');links.append($('#codeAllLinks').parentElement,$('#codeRelation').parentElement,$('#codeEdges'));
    const members=section('Members','code');members.append($('#codeMembers'));
    const organize=section('Systems','folder-open');organize.append($('#codeOrganize'),$('#codeMoreScripts'));
    const impact=section('Impact','graph');impact.append(root.querySelector('.code-impact'));
    const review=section('Ask & review','code');review.append(root.querySelector('.code-review'));
    const scan=section('Scan details','info');for(const item of [...root.querySelectorAll('.code-coverage'),$('#codeChanges').closest('details')])if(item&&!scan.contains(item))scan.append(item);
    scan.append($('#codeProject').parentElement);
    $('#codeDiagram').classList.add('code-map-summary');context.append($('#codeDiagram'));
    root.querySelector('.code-main').remove();
    $('#codeTitle').textContent='Project map';root.querySelector('header small').remove();
    const labels={codeReload:['arrows-clockwise','Reload','Reload scanned snapshot'],codeClose:['x','Close','Close inspector'],codeSource:['code','Source','Open source code'],codeOverview:['graph','Overview','Return to project overview'],codeDetails:['magnifying-glass','Inspect','Inspect selected code'],codeExpandSystems:['stack','Expand','Expand systems to show scripts'],codePrepare:['code','Prepare','Prepare a refactor prompt locally'],codeAsk:['graph','Ask AI','Send selected evidence to connected AI']};
    for(const [id,[icon,label,tip]] of Object.entries(labels)){const node=$('#'+id);node.textContent=label;node.dataset.codeIcon=icon;node.title=tip;}
    $('#codeSelection').before(context.querySelector('.code-eyebrow'));
    $('#codeSearch').placeholder='Name or path';root.querySelector('label[for="codeSearch"]').textContent='Search';
    $('#codeOrganize').querySelector('.small').hidden=true;$('#codeOrganize').open=true;
    for(const label of root.querySelectorAll('.code-field[title]')){const input=label.querySelector('input,select');if(input)input.title=label.title;}
    $('#codeVisualization').title='Choose how the same project data is arranged.';
    const sync=()=>{for(const [id,key] of [['codeSpacing','spacing'],['codeLayerGap','layerGap']]){$('#'+id).value=Math.round(settings[key]*100);$('#'+id+'Value').value=Math.round(settings[key]*100)+'%';}$('#codeLayers').value=settings.layers;$('#codeScriptLimit').value=settings.scriptLimit;$('#codeLabels').checked=settings.labels;$('#codeWireStyle').value=settings.wires;};
    const icons={"graph":"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 256 256\" fill=\"currentColor\"><path d=\"M200,152a31.84,31.84,0,0,0-19.53,6.68l-23.11-18A31.65,31.65,0,0,0,160,128c0-.74,0-1.48-.08-2.21l13.23-4.41A32,32,0,1,0,168,104c0,.74,0,1.48.08,2.21l-13.23,4.41A32,32,0,0,0,128,96a32.59,32.59,0,0,0-5.27.44L115.89,81A32,32,0,1,0,96,88a32.59,32.59,0,0,0,5.27-.44l6.84,15.4a31.92,31.92,0,0,0-8.57,39.64L73.83,165.44a32.06,32.06,0,1,0,10.63,12l25.71-22.84a31.91,31.91,0,0,0,37.36-1.24l23.11,18A31.65,31.65,0,0,0,168,184a32,32,0,1,0,32-32Zm0-64a16,16,0,1,1-16,16A16,16,0,0,1,200,88ZM80,56A16,16,0,1,1,96,72,16,16,0,0,1,80,56ZM56,208a16,16,0,1,1,16-16A16,16,0,0,1,56,208Zm56-80a16,16,0,1,1,16,16A16,16,0,0,1,112,128Zm88,72a16,16,0,1,1,16-16A16,16,0,0,1,200,200Z\"/></svg>","folder-open":"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 256 256\" fill=\"currentColor\"><path d=\"M245,110.64A16,16,0,0,0,232,104H216V88a16,16,0,0,0-16-16H130.67L102.94,51.2a16.14,16.14,0,0,0-9.6-3.2H40A16,16,0,0,0,24,64V208h0a8,8,0,0,0,8,8H211.1a8,8,0,0,0,7.59-5.47l28.49-85.47A16.05,16.05,0,0,0,245,110.64ZM93.34,64,123.2,86.4A8,8,0,0,0,128,88h72v16H69.77a16,16,0,0,0-15.18,10.94L40,158.7V64Zm112,136H43.1l26.67-80H232Z\"/></svg>","info":"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 256 256\" fill=\"currentColor\"><path d=\"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z\"/></svg>","x":"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 256 256\" fill=\"currentColor\"><path d=\"M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z\"/></svg>","stack":"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 256 256\" fill=\"currentColor\"><path d=\"M230.91,172A8,8,0,0,1,228,182.91l-96,56a8,8,0,0,1-8.06,0l-96-56A8,8,0,0,1,36,169.09l92,53.65,92-53.65A8,8,0,0,1,230.91,172ZM220,121.09l-92,53.65L36,121.09A8,8,0,0,0,28,134.91l96,56a8,8,0,0,0,8.06,0l96-56A8,8,0,1,0,220,121.09ZM24,80a8,8,0,0,1,4-6.91l96-56a8,8,0,0,1,8.06,0l96,56a8,8,0,0,1,0,13.82l-96,56a8,8,0,0,1-8.06,0l-96-56A8,8,0,0,1,24,80Zm23.88,0L128,126.74,208.12,80,128,33.26Z\"/></svg>","sliders-horizontal":"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 256 256\" fill=\"currentColor\"><path d=\"M40,88H73a32,32,0,0,0,62,0h81a8,8,0,0,0,0-16H135a32,32,0,0,0-62,0H40a8,8,0,0,0,0,16Zm64-24A16,16,0,1,1,88,80,16,16,0,0,1,104,64ZM216,168H199a32,32,0,0,0-62,0H40a8,8,0,0,0,0,16h97a32,32,0,0,0,62,0h17a8,8,0,0,0,0-16Zm-48,24a16,16,0,1,1,16-16A16,16,0,0,1,168,192Z\"/></svg>","git-branch":"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 256 256\" fill=\"currentColor\"><path d=\"M232,64a32,32,0,1,0-40,31v17a8,8,0,0,1-8,8H96a23.84,23.84,0,0,0-8,1.38V95a32,32,0,1,0-16,0v66a32,32,0,1,0,16,0V144a8,8,0,0,1,8-8h88a24,24,0,0,0,24-24V95A32.06,32.06,0,0,0,232,64ZM64,64A16,16,0,1,1,80,80,16,16,0,0,1,64,64ZM96,192a16,16,0,1,1-16-16A16,16,0,0,1,96,192ZM200,80a16,16,0,1,1,16-16A16,16,0,0,1,200,80Z\"/></svg>","code":"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 256 256\" fill=\"currentColor\"><path d=\"M69.12,94.15,28.5,128l40.62,33.85a8,8,0,1,1-10.24,12.29l-48-40a8,8,0,0,1,0-12.29l48-40a8,8,0,0,1,10.24,12.3Zm176,27.7-48-40a8,8,0,1,0-10.24,12.3L227.5,128l-40.62,33.85a8,8,0,1,0,10.24,12.29l48-40a8,8,0,0,0,0-12.29ZM162.73,32.48a8,8,0,0,0-10.25,4.79l-64,176a8,8,0,0,0,4.79,10.26A8.14,8.14,0,0,0,96,224a8,8,0,0,0,7.52-5.27l64-176A8,8,0,0,0,162.73,32.48Z\"/></svg>","magnifying-glass":"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 256 256\" fill=\"currentColor\"><path d=\"M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z\"/></svg>","arrows-clockwise":"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 256 256\" fill=\"currentColor\"><path d=\"M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h28.69L182.06,73.37a79.56,79.56,0,0,0-56.13-23.43h-.45A79.52,79.52,0,0,0,69.59,72.71,8,8,0,0,1,58.41,61.27a96,96,0,0,1,135,.79L208,76.69V48a8,8,0,0,1,16,0ZM186.41,183.29a80,80,0,0,1-112.47-.66L59.31,168H88a8,8,0,0,0,0-16H40a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V179.31l14.63,14.63A95.43,95.43,0,0,0,130,222.06h.53a95.36,95.36,0,0,0,67.07-27.33,8,8,0,0,0-11.18-11.44Z\"/></svg>"};
    for(const node of root.querySelectorAll('[data-code-icon]')){const wrap=document.createElement('span');wrap.className='code-icon';wrap.setAttribute('aria-hidden','true');wrap.innerHTML=icons[node.dataset.codeIcon]||'';node.prepend(wrap);}
    for(const node of root.querySelectorAll('.code-review>p.small')){node.previousElementSibling.title=node.textContent;node.hidden=true;}
    sync();
    return {settings,sync,save,defaults};
  }
  return {settings,setup};
})();
