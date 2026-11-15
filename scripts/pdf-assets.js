'use strict';
const fs = require('node:fs'), path = require('node:path');
function pdfAsset(relative){
  const map = {'pdf.mjs':'build/pdf.min.mjs','pdf.worker.mjs':'build/pdf.worker.min.mjs',LICENSE:'LICENSE'};
  const rel = map[relative] || (/^(cmaps|standard_fonts)\/[\w.-]+$/.test(relative) ? relative : null);
  if(!rel) return null;
  const file = path.join(path.dirname(require.resolve('pdfjs-dist/package.json')),rel);
  return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}
function copyPdfAssets(out){
  const root = path.dirname(require.resolve('pdfjs-dist/package.json'));
  fs.mkdirSync(out,{recursive:true});
  for(const name of ['pdf.mjs','pdf.worker.mjs','LICENSE']) fs.copyFileSync(pdfAsset(name),path.join(out,name));
  for(const dir of ['cmaps','standard_fonts']) fs.cpSync(path.join(root,dir),path.join(out,dir),{recursive:true});
}
module.exports = {pdfAsset,copyPdfAssets};
