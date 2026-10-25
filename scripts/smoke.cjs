const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..');
(async()=>{
const data=await fs.mkdtemp(path.join(os.tmpdir(),'toolbox2-ui-'));
process.env.TOOLBOX2_TEST_DATA_DIR=data;
require('../dist-electron/main.cjs');
const checks=[];const assert=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw Error(name)};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let win;let error;
try{
 for(let i=0;i<80;i++){win=BrowserWindow.getAllWindows()[0];if(win&&!win.webContents.isLoading()&&await win.webContents.executeJavaScript(`!!document.querySelector('.paper-table tbody tr')`).catch(()=>false))break;await delay(250)}
 if(!win)throw Error('No application window');
 const evaluate=code=>win.webContents.executeJavaScript(code);
 assert('native bridge loads a seeded workspace',await evaluate(`document.querySelectorAll('.paper-table tbody tr').length===8&&!!window.toolbox2`));
 await fs.mkdir(path.join(root,'docs/screenshots'),{recursive:true});
 await fs.writeFile(path.join(root,'docs/screenshots/workspace-dark.png'),(await win.webContents.capturePage()).toPNG());
 await evaluate(`document.querySelectorAll('.paper-table tbody tr')[1].click()`);await delay(250);
 assert('selecting a paper records a visit',await evaluate(`window.toolbox2.request('/workspace').then(w=>Object.values(w.annotations).some(a=>a.visits===1))`));
 await evaluate(`const s=document.querySelector('.read-status select');s.value='reading';s.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('.detail-actions .square').click()`);await delay(250);
 assert('reading status and bookmark persist',await evaluate(`window.toolbox2.request('/workspace').then(w=>Object.values(w.annotations).some(a=>a.status==='reading'&&a.pinned))`));
 await evaluate(`const t=document.querySelector('.notes-section textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,'Prototype reading note saved by the UI check.');t.dispatchEvent(new Event('input',{bubbles:true}))`);await delay(1000);
 assert('typed note auto-saves through the Node service',await evaluate(`window.toolbox2.request('/workspace').then(w=>Object.values(w.annotations).some(a=>a.note==='Prototype reading note saved by the UI check.'))`));
 await evaluate(`document.querySelectorAll('.view-segment button')[1].click()`);await delay(200);
 assert('graph renders all paper nodes and topic edges',await evaluate(`document.querySelectorAll('.graph-node').length===8&&document.querySelectorAll('.graph-edge').length>4`));
 await fs.writeFile(path.join(root,'docs/screenshots/graph-dark.png'),(await win.webContents.capturePage()).toPNG());
 await evaluate(`document.querySelectorAll('.workspace-header-actions .icon-button')[0].click()`);await delay(200);
 assert('light theme is persisted and applied',await evaluate(`document.documentElement.dataset.theme==='light'`));
 await fs.writeFile(path.join(root,'docs/screenshots/workspace-light.png'),(await win.webContents.capturePage()).toPNG());
 await evaluate(`document.querySelector('.panel-resizer').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}))`);await delay(200);
 assert('detail panel keyboard resizing persists',await evaluate(`window.toolbox2.request('/workspace').then(w=>w.preferences.detailWidth===360)`));
 await evaluate(`document.querySelector('.paper-toolbar>.icon-button').click()`);await delay(200);
 assert('detail panel can be collapsed',await evaluate(`!document.querySelector('.detail-panel')`));
 await evaluate(`document.querySelector('.new-library').click()`);await delay(80);
 await evaluate(`const inputs=document.querySelectorAll('.modal input');for(const [i,v] of ['UI check library','graph neural networks'].entries()){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(inputs[i],v);inputs[i].dispatchEvent(new Event('input',{bubbles:true}))}document.querySelector('.modal form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);await delay(250);
 assert('new library switches to a real empty workspace',await evaluate(`document.querySelector('h1').textContent==='UI check library'&&!!document.querySelector('.empty-state')`));
 const result=await evaluate(`window.toolbox2.request('/workspace')`);
 assert('all user edits also exist in the disk snapshot',JSON.parse(await fs.readFile(path.join(data,'workspace.json'),'utf8')).libraries.length===4&&Object.values(result.annotations).some(a=>a.note.includes('Prototype')));
 console.log(JSON.stringify({ok:true,checks}));
}catch(e){error=e;console.error(e.stack)}finally{
 await fs.mkdir(path.join(root,'work'),{recursive:true});await fs.writeFile(path.join(root,'work/ui-check.json'),JSON.stringify({ok:!error,checks,error:error?.message},null,2));
 for(const w of BrowserWindow.getAllWindows())w.destroy();app.exit(error?1:0);
}
})();
