const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
const F = require('path').join(__dirname,'..','stone-calendar','index.html');
const HTML=fs.readFileSync(F,'utf8').replace(/<script src="https:\/\/[^"]*grist-plugin-api\.js"><\/script>/,'');
function boot(store){
  const errs=[]; const vc=new VirtualConsole(); vc.on('jsdomError',e=>errs.push(e.message));
  const d=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc});
  if(store) d.window.localStorage.setItem('milano_stonecal_table',store);
  return {w:d.window,D:d.window.document,errs};
}
let F2=0,P=0;
const ok=(n,c,x)=>{ if(c){P++;console.log('  PASS  '+n);} else {F2++;console.log('  FAIL  '+n+(x!==undefined?'  -> '+JSON.stringify(x):''));} };
let {w,D,errs}=boot();
const $$=q=>[...D.querySelectorAll(q)];
const css=[...D.styleSheets[0].cssRules].map(r=>r.cssText).join('\n');
const cs=el=>w.getComputedStyle(el);

console.log('== the panel no longer gets squeezed ==');
const p=D.getElementById('colPanel');
ok('panel will not shrink', cs(p).flexShrink==='0', {shrink:cs(p).flexShrink, grow:cs(p).flexGrow});
ok('sized to its content, not stretched', cs(p).flexBasis==='auto', cs(p).flexBasis);
ok('capped so it cannot eat the whole widget', /max-height:\s*52vh/.test(css));
ok('scrolls internally past that', /\.colpanel\s*\{[^}]*overflow-y:\s*auto/.test(css));
ok('the table area is the one that gives way',
   parseFloat(cs(D.getElementById('body')).flexShrink)!==0
   && parseFloat(cs(D.getElementById('body')).minHeight)===0,
   {shrink:cs(D.getElementById('body')).flexShrink, min:cs(D.getElementById('body')).minHeight});

console.log('== date column width setting ==');
D.getElementById('colsBtn').onclick({stopPropagation(){}});
const labs=()=>$$('#colPanel .cpset .lab').map(e=>e.textContent);
ok('both steppers present', labs().join('|')==='Date column|Font size', labs());
ok('date column starts at 200px', w.eval('dateColW')===200);
const dstep=$$('#colPanel .cpset .grp')[0].querySelectorAll('.ce-fbtn');
dstep[1].onclick();
ok('plus widens it', w.eval('dateColW')===210, w.eval('dateColW'));
ok('the CSS variable follows',
   D.documentElement.style.getPropertyValue('--datecol')==='210px',
   D.documentElement.style.getPropertyValue('--datecol'));
for(let i=0;i<40;i++) $$('#colPanel .cpset .grp')[0].querySelectorAll('.ce-fbtn')[1].onclick();
ok('clamped at 360px', w.eval('dateColW')===360, w.eval('dateColW'));
for(let i=0;i<40;i++) $$('#colPanel .cpset .grp')[0].querySelectorAll('.ce-fbtn')[0].onclick();
ok('clamped at 120px going down', w.eval('dateColW')===120, w.eval('dateColW'));

console.log('== font size setting ==');
ok('starts at 12.5px', w.eval('tblFont')===12.5);
ok('cells read the variable', /\.stcell\s*\{[^}]*font-size:\s*var\(--tblfont\)/.test(css));
const fstep=()=>$$('#colPanel .cpset .grp')[1].querySelectorAll('.ce-fbtn');
fstep()[1].onclick();
ok('plus raises it by half a point', w.eval('tblFont')===13, w.eval('tblFont'));
ok('variable follows', D.documentElement.style.getPropertyValue('--tblfont')==='13px',
   D.documentElement.style.getPropertyValue('--tblfont'));
for(let i=0;i<30;i++) fstep()[1].onclick();
ok('clamped at 18px', w.eval('tblFont')===18, w.eval('tblFont'));
for(let i=0;i<40;i++) fstep()[0].onclick();
ok('clamped at 9.5px', w.eval('tblFont')===9.5, w.eval('tblFont'));

console.log('== both persist ==');
const saved=JSON.parse(w.localStorage.getItem('milano_stonecal_table'));
ok('written to localStorage', saved.datecol===120 && saved.font===9.5, {d:saved.datecol,f:saved.font});
const b2=boot(JSON.stringify({cols:saved.cols,totals:true,datecol:260,font:15,scope:'me'}));
b2.w.eval('loadTablePrefs(); render();');
ok('restored on the next load', b2.w.eval('dateColW')===260 && b2.w.eval('tblFont')===15,
   {d:b2.w.eval('dateColW'), f:b2.w.eval('tblFont')});
ok('variables applied at restore',
   b2.D.documentElement.style.getPropertyValue('--datecol')==='260px'
   && b2.D.documentElement.style.getPropertyValue('--tblfont')==='15px',
   {d:b2.D.documentElement.style.getPropertyValue('--datecol'),
    f:b2.D.documentElement.style.getPropertyValue('--tblfont')});

console.log('== shared via grist options, and sanitised ==');
const b3=boot();
b3.w.eval('applyGristOptions({tblDateCol:300,tblFont:14});');
ok('adopted from shared options', b3.w.eval('dateColW')===300 && b3.w.eval('tblFont')===14);
b3.w.eval('applyGristOptions({tblDateCol:99999,tblFont:-5});');
ok('absurd shared values clamped, not applied raw',
   b3.w.eval('dateColW')===360 && b3.w.eval('tblFont')===9.5,
   {d:b3.w.eval('dateColW'), f:b3.w.eval('tblFont')});

console.log('== nothing broke ==');
ok('no jsdom errors', errs.length===0 && b3.errs.length===0, errs.concat(b3.errs).slice(0,2));
ok('rows still render', $$('.strow').length>0);
console.log('\n'+(F2?'FAILURES: '+F2:'ALL PASS')+'  ('+P+' passed)');
process.exit(F2?1:0);
