const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
const F = require('path').join(__dirname,'..','stone-calendar','index.html');
const HTML=fs.readFileSync(F,'utf8').replace(/<script src="https:\/\/[^"]*grist-plugin-api\.js"><\/script>/,'');
const errs=[]; const vc=new VirtualConsole(); vc.on('jsdomError',e=>errs.push(e.message));
const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc});
const w=dom.window,D=w.document;
const $$=q=>[...D.querySelectorAll(q)];
let F2=0,P=0;
const ok=(n,c,x)=>{ if(c){P++;console.log('  PASS  '+n);} else {F2++;console.log('  FAIL  '+n+(x!==undefined?'  -> '+JSON.stringify(x):''));} };

console.log('== inline panel, not an overlay ==');
ok('no modal shell left', !D.getElementById('cardModal'));
ok('panel exists in the markup', !!D.getElementById('colPanel'));
ok('panel sits between the filter bar and the body', (()=>{
   const p=D.getElementById('colPanel');
   return p.previousElementSibling.classList.contains('filterbar')
       && p.nextElementSibling.id==='body'; })(),
   {prev:D.getElementById('colPanel').previousElementSibling.className,
    next:D.getElementById('colPanel').nextElementSibling.id});
ok('closed at boot', !D.getElementById('colPanel').classList.contains('open'));
ok('nothing rendered while closed', D.getElementById('colPanel').innerHTML==='');
D.getElementById('colsBtn').onclick({stopPropagation(){}});
ok('button toggles it open', D.getElementById('colPanel').classList.contains('open'));
ok('button shows as active', D.getElementById('colsBtn').classList.contains('on'));
ok('rows rendered', $$('#colPanel .colrow').length===w.eval('tblCols.length'),
   $$('#colPanel .colrow').length);
ok('table is still visible behind it, not covered',
   $$('.strow').length>0 && !/position:\s*fixed/.test(w.getComputedStyle(D.getElementById('colPanel')).position),
   w.getComputedStyle(D.getElementById('colPanel')).position);
D.getElementById('colsBtn').onclick({stopPropagation(){}});
ok('toggles shut again', !D.getElementById('colPanel').classList.contains('open'));

console.log('== the address column ==');
ok('address is an available column', w.eval('!!COLDEF.address'));
ok('labelled Job address', w.eval('COLDEF.address.label')==='Job address');
ok('read-only (it lives on the job)', w.eval('!COLDEF.address.edit'));
ok('offered in "add a column"', (()=>{ D.getElementById('colsBtn').onclick({stopPropagation(){}});
   return $$('#colPanel .ce-tok').map(b=>b.textContent).some(x=>/Job address/.test(x)); })(),
   $$('#colPanel .ce-tok').map(b=>b.textContent));
const before=w.eval('tblCols.length');
$$('#colPanel .ce-tok').find(b=>/Job address/.test(b.textContent)).onclick();
ok('adding it widens the table', w.eval('tblCols.length')===before+1);
ok('it renders a value from the job', (()=>{
   const i=w.eval('tblCols.findIndex(c=>c.k==="address")');
   const cell=$$('.strow')[0].children[i];
   return cell && cell.textContent.trim().length>0; })(),
   (()=>{ const i=w.eval('tblCols.findIndex(c=>c.k==="address")');
     return $$('.strow')[0].children[i].textContent.trim(); })());
ok('header label follows', $$('.sthead .stlab').map(e=>e.textContent).includes('Job address'));

console.log('== drag to reorder ==');
ok('rows are draggable', $$('#colPanel .colrow').every(r=>r.draggable===true));
ok('each row has a grip', $$('#colPanel .grip').length===w.eval('tblCols.length'));
ok('arrow buttons are gone', $$('#colPanel .ce-sec-mv').length===0, $$('#colPanel .ce-sec-mv').length);
ok('remove still there', $$('#colPanel .ce-sec-x').length===w.eval('tblCols.length'));
ok('drag handlers wired', (()=>{ const r=$$('#colPanel .colrow')[0];
   return typeof r.ondragstart==='function' && typeof r.ondragover==='function'
       && typeof r.ondrop==='function'; })());

console.log('== moveCol is the single reorder path ==');
const order=()=>w.eval('JSON.stringify(tblCols.map(c=>c.k))');
const o0=JSON.parse(order());
ok('moving row 0 to the end', (()=>{ w.eval('moveCol(0,tblCols.length)');
   const o=JSON.parse(order()); return o[o.length-1]===o0[0] && o.length===o0.length; })(), order());
ok('moving it back', (()=>{ w.eval('moveCol(tblCols.length-1,0)');
   return JSON.stringify(JSON.parse(order()))===JSON.stringify(o0); })(), order());
ok('no-op when from===to', w.eval('moveCol(2,2)')===false);
ok('out-of-range rejected', w.eval('moveCol(-1,2)')===false && w.eval('moveCol(99,0)')===false);
ok('order persisted to localStorage', (()=>{ w.eval('moveCol(0,2)');
   const s=JSON.parse(w.localStorage.getItem('milano_stonecal_table'));
   return s && s.cols[0].k===JSON.parse(order())[0]; })());

console.log('== shared options still respect an open editor ==');
w.eval('colScope="everyone"; colPanelOpen=true;');
const keep=order();
w.eval('applyGristOptions({tblCols:[{k:"note"}]});');
ok('layout not yanked while the panel is open', order()===keep, {before:keep, after:order()});
w.eval('colPanelOpen=false; applyGristOptions({tblCols:[{k:"note"}]});');
ok('adopted once the panel is closed', w.eval('tblCols.length')===1, w.eval('tblCols.length'));

console.log('== nothing broke ==');
ok('no jsdom errors', errs.length===0, errs.slice(0,3));
console.log('\n'+(F2?'FAILURES: '+F2:'ALL PASS')+'  ('+P+' passed)');
process.exit(F2?1:0);
