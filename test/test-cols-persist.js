const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
const F = require('path').join(__dirname,'..','stone-calendar','index.html');
const HTML=fs.readFileSync(F,'utf8').replace(/<script src="https:\/\/[^"]*grist-plugin-api\.js"><\/script>/,'');
function boot(store){
  const errs=[]; const vc=new VirtualConsole(); vc.on('jsdomError',e=>errs.push(e.message));
  const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc});
  if(store!=null) dom.window.localStorage.setItem('milano_stonecal_table',store);
  return {dom,w:dom.window,D:dom.window.document,errs};
}
let F2=0,P=0;
const ok=(n,c,x)=>{ if(c){P++;console.log('  PASS  '+n);} else {F2++;console.log('  FAIL  '+n+(x!==undefined?'  -> '+JSON.stringify(x):''));} };

console.log('== the Cards button is gone, Columns is there ==');
let {w,D,errs}=boot();
const $$=q=>[...D.querySelectorAll(q)];
ok('no clean boot errors', errs.length===0, errs.slice(0,2));
ok('no Cards button', !D.getElementById('cardsBtn'));
ok('no ⚙ Cards label anywhere', !/⚙ Cards/.test(D.body.textContent));
ok('Columns button present', !!D.getElementById('colsBtn'));
ok('labelled ⚙ Columns', /⚙ Columns/.test(D.getElementById('colsBtn').textContent),
   D.getElementById('colsBtn').textContent);

console.log('== the editor edits columns ==');
D.getElementById('colsBtn').onclick({stopPropagation(){}});
ok('inline panel opens', D.getElementById('colPanel').classList.contains('open'));
ok('panel is headed Columns shown',
   /Columns shown/.test(D.querySelector('#colPanel h4').textContent),
   D.querySelector('#colPanel h4').textContent);
ok('one row per column', $$('.colrow').length===w.eval('tblCols.length'), $$('.colrow').length);
ok('headings are static text, not inputs', $$('.colrow input[type=text]').length===0);
ok('B/I/U per column', $$('.colrow').every(r=>
   [...r.querySelectorAll('.fmtseg button')].map(b=>b.textContent).join('')==='BIU'));
ok('plain/pill + L/C/R per column', $$('.colrow').every(r=>r.querySelectorAll('.miniseg').length===2));
ok('totals checkbox present', !!D.querySelector('.coltog input'));
ok('editable/read-only tags', $$('.rotag.can').length>0 && $$('.rotag').length===w.eval('tblCols.length'));
ok('add-column chips for the unused ones', $$('.ce-tok').length>0, $$('.ce-tok').length);

console.log('== changes persist to localStorage ==');
$$('.colrow')[0].querySelector('.fmtseg button').onclick();      // toggle Client bold off
D.querySelector('.coltog input').checked=false;
D.querySelector('.coltog input').onchange();
const saved=JSON.parse(w.localStorage.getItem('milano_stonecal_table'));
ok('something was written', !!saved, saved);
ok('cols saved', Array.isArray(saved.cols) && saved.cols.length===w.eval('tblCols.length'));
ok('bold flag saved as false', saved.cols[0].b===false, saved.cols[0]);
ok('totals preference saved', saved.totals===false, saved.totals);

console.log('== and are restored on the next load ==');
const store=JSON.stringify({cols:[{k:'stone',w:180,align:'left',style:'plain',b:true,i:false,u:false},
                                  {k:'scope',w:60,align:'right',style:'plain',b:false,i:false,u:false}],
                            totals:false, scope:'me'});
const b2=boot(store); // localStorage is set after scripts run, so reload semantics: call loadTablePrefs
b2.w.eval('loadTablePrefs(); render();');
const $$2=q=>[...b2.D.querySelectorAll(q)];
ok('restored 2 columns', b2.w.eval('tblCols.length')===2, b2.w.eval('tblCols.length'));
ok('restored the stone column first', b2.w.eval('tblCols[0].k')==='stone', b2.w.eval('tblCols[0].k'));
ok('restored width', b2.w.eval('tblCols[0].w')===180);
ok('restored totals=false', b2.w.eval('showTotals')===false);
ok('restored scope', b2.w.eval('colScope')==='me');
ok('table redrew with 2 columns',
   $$2('.strow').every(r=>r.children.length===3), [...new Set($$2('.strow').map(r=>r.children.length))]);

console.log('== a corrupt or stale option cannot break the grid ==');
const b3=boot();
ok('unknown keys dropped', b3.w.eval('JSON.stringify(normaliseTblCols([{k:"nope"},{k:"scope"}]))')
   ==='[{"k":"scope","w":54,"align":"right","style":"plain","b":false,"i":false,"u":false}]',
   b3.w.eval('JSON.stringify(normaliseTblCols([{k:"nope"},{k:"scope"}]))'));
ok('duplicates dropped', b3.w.eval('normaliseTblCols([{k:"scope"},{k:"scope"}]).length')===1);
ok('empty result falls back to null', b3.w.eval('normaliseTblCols([{k:"nope"}])')===null);
ok('non-array falls back to null', b3.w.eval('normaliseTblCols("junk")')===null);
ok('silly widths clamped', b3.w.eval('normaliseTblCols([{k:"scope",w:9999}])[0].w')===320);
ok('bad align falls back', b3.w.eval('normaliseTblCols([{k:"scope",align:"sideways"}])[0].align')==='right');

console.log('== shared options adopt table columns ==');
const b4=boot();
b4.w.eval('applyGristOptions({tblCols:[{k:"client"},{k:"status"}],tblTotals:false});');
ok('shared cols adopted', b4.w.eval('tblCols.length')===2, b4.w.eval('tblCols.length'));
ok('shared totals adopted', b4.w.eval('showTotals')===false);
b4.w.eval('colScope="me"; applyGristOptions({tblCols:[{k:"note"}]});');
ok('a "just for me" layout is not overwritten by the shared one',
   b4.w.eval('tblCols.length')===2, b4.w.eval('tblCols.length'));
ok('no errors through all of that', b4.errs.length===0, b4.errs.slice(0,2));

console.log('\n'+(F2?'FAILURES: '+F2:'ALL PASS')+'  ('+P+' passed)');
process.exit(F2?1:0);
