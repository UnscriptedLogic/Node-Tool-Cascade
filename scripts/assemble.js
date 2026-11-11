'use strict';
// Puts the page together from its parts: app/app.html (markup), app/css/*.css and app/js/**/*.js,
// in the order listed in app/manifest.json. Script order matters: files share one global scope.
//   inline:true  -> a single self-contained HTML string (web build, tests)
//   inline:false -> <link>/<script src> tags the local server can serve from /app/
const fs = require('fs'), path = require('path');
const APP_DIR = path.resolve(__dirname,'..','app');
const read = (f) => fs.readFileSync(path.join(APP_DIR,f),'utf8');
const manifest = () => JSON.parse(read('manifest.json'));

function assemble({ inline = true, runtime = '' } = {}){
  const m = manifest();
  let html = read('app.html');
  for(const k of ['<!--STYLES-->','<!--SCRIPTS-->','<!--RUNTIME-->']) if(!html.includes(k)) throw new Error(`app/app.html is missing ${k}`);
  const styles = inline ? '<style>\n' + m.css.map(read).join('') + '</style>' : m.css.map(f=>`<link rel="stylesheet" href="/app/${f}">`).join('\n');
  const scripts = inline ? '<script>\n' + m.js.map(read).join('\n') + '\n</script>' : m.js.map(f=>`<script src="/app/${f}"></script>`).join('\n');
  return html.replace('<!--STYLES-->',()=>styles).replace('<!--RUNTIME-->',()=>runtime).replace('<!--SCRIPTS-->',()=>scripts);
}
module.exports = { assemble, APP_DIR, manifest };

// Turns the server's <link>/<script src> tags back into inline code, for jsdom tests that load the page from a string.
function inlineParts(html){
  return html
    .replace(/<link rel="stylesheet" href="\/app\/([^"]+)">/g,(m,f)=>'<style>\n' + read(f) + '</style>')
    .replace(/<script src="\/app\/([^"]+)"><\/script>/g,(m,f)=>'<script>\n' + read(f) + '\n</script>');
}
module.exports.inlineParts = inlineParts;
