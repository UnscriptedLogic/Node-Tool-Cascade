'use strict';
// Opens the operating system's own "choose a folder" dialog, because a web page can't hand a server a real path.
// Nothing user-supplied is ever put in a command line, so there is nothing to inject into.
const { execFile } = require('child_process');

function run(cmd,args){
  return new Promise((resolve,reject)=>{
    execFile(cmd,args,{ timeout:5*60*1000, windowsHide:false, maxBuffer:1024*64 },(err,stdout,stderr)=>{
      if(err){
        if(err.code==='ENOENT') return reject(Object.assign(new Error('missing'),{ missing:true }));
        // closing the dialog is an exit code, not a failure
        return resolve({ cancelled:true, stderr:String(stderr||'') });
      }
      resolve({ path:String(stdout||'').trim().replace(/[\r\n]+$/,'') });
    });
  });
}
async function pickFolder(){
  const prompt = 'Choose your project folder';
  try{
    if(process.env.CASCADE_PICKER_CMD){   // lets tests, or a user with their own dialog, plug something in
      const r = await run(process.env.CASCADE_PICKER_CMD,[]);
      return { path:r.path || '' };
    }
    if(process.platform==='darwin'){
      const r = await run('osascript',['-e',`POSIX path of (choose folder with prompt "${prompt}")`]);
      return { path:r.path || '' };
    }
    if(process.platform==='win32'){
      const ps = `Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description = '${prompt}'; if($d.ShowDialog() -eq 'OK'){ $d.SelectedPath }`;
      const r = await run('powershell',['-NoProfile','-STA','-Command',ps]);
      return { path:r.path || '' };
    }
    try{ const r = await run('zenity',['--file-selection','--directory','--title='+prompt]); return { path:r.path || '' }; }
    catch(e){ if(!e.missing) throw e; }
    const r = await run('kdialog',['--getexistingdirectory',process.env.HOME || '/','--title',prompt]);
    return { path:r.path || '' };
  }catch(e){
    if(e && e.missing) throw Object.assign(new Error('No folder dialog is available on this computer. Paste the folder’s path instead.'),{ status:501 });
    throw e;
  }
}
module.exports = { pickFolder };
