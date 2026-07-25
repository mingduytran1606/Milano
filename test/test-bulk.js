const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
const F = require('path').join(__dirname,'..','stone-calendar','index.html');
const HTML=fs.readFileSync(F,'utf8').replace(/<script src="https:\/\/[^"]*grist-plugin-api\.js"><\/script>/,'');
const errs=[]; const vc=new VirtualConsole(); vc.on('jsdomError',e=>errs.push(e.message));
const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc});
const w=dom.window,D=dom.window.document,s=w._stonecal;
const $$=q=>[...D.querySelectorAll(q)];
let F2=0,P=0;
const ok=(n,c,x)=>{ if(c){P++;console.log('  PASS  '+n);} else {F2++;console.log('  FAIL  '+n+(x!==undefined?'  -> '+JSON.stringify(x):''));} };

console.log('== entering bulk mode ==');
const rows0=$$('.strow').length;
ok('remove handles while not in bulk', $$('.rowdel').length===rows0);
ok('no checkboxes yet', $$('.evsel').length===0);
D.getElementById('bulkBtn').onclick({stopPropagation(){}});
ok('bulk mode on', s.bulk===true);
ok('bulk bar open', D.getElementById('bulkBar').classList.contains('open'));
ok('a checkbox per row', $$('.evsel').length===rows0, {cb:$$('.evsel').length, rows:rows0});
ok('remove handle steps aside in bulk', $$('.rowdel').length===0, $$('.rowdel').length);
ok('row cell count still matches columns +1',
   $$('.strow').every(r=>r.children.length===w.eval('tblCols.length')+1),
   [...new Set($$('.strow').map(r=>r.children.length))]);
ok('grid template unchanged by bulk',
   new Set($$('.strow').map(r=>r.style.gridTemplateColumns)).size===1);

console.log('== selecting ==');
const cb=$$('.evsel')[0];
cb.checked=true; cb.onchange();
ok('selection recorded', s.sel.size===1, s.sel.size);
ok('bulk count reflects it', /1 selected/.test(D.getElementById('bulkCount').textContent),
   D.getElementById('bulkCount').textContent);
ok('apply enabled once something is ticked', D.getElementById('bulkApply').disabled===false);

console.log('== per-day select-all toggle ==');
const tog=$$('.ag-date .ag-all')[0];
ok('day toggle rendered in bulk', !!tog);
ok('toggle is labelled', /Select day|Clear day/.test(tog.textContent), tog.textContent);
// start from nothing selected, so the toggle's direction is unambiguous
w.eval('state.sel.clear(); render();');
const dayRows=$$('.ag-day')[0].querySelectorAll('.strow').length;
$$('.ag-date .ag-all')[0].onclick({stopPropagation(){}});
ok('ticks the whole day', s.sel.size===dayRows, {sel:s.sel.size, dayRows});
$$('.ag-date .ag-all')[0].onclick({stopPropagation(){}});
ok('clicking again clears that day', s.sel.size===0, s.sel.size);
ok('label follows the state', (()=>{
   $$('.ag-date .ag-all')[0].onclick({stopPropagation(){}});
   const lab=$$('.ag-date .ag-all')[0].textContent;
   $$('.ag-date .ag-all')[0].onclick({stopPropagation(){}});
   return lab==='Clear day'; })(), $$('.ag-date .ag-all')[0].textContent);

console.log('== bulk apply reaches writeRows ==');
w.eval('state.sel=new Set(state.stone.filter(r=>!isQuote(r)).slice(0,2).map(r=>r.id)); renderBulkBar();');
ok('two selected', s.sel.size===2, s.sel.size);
w.eval('window.__wrote=null; window.__origWrite=writeRows; writeRows=async u=>{ window.__wrote=u; };');
D.getElementById('bulkStatus').value='Delivered';
w.eval('confirmBox=async()=>"go";');            // auto-confirm
const done=w.eval('applyBulk()');
Promise.resolve(done).then(()=>{
  const wrote=w.eval('window.__wrote');
  ok('applyBulk produced updates', Array.isArray(wrote) && wrote.length===2, wrote);
  ok('each update carries the new status',
     wrote && wrote.every(u=>u.fields.Order_Status==='Delivered'), wrote);
  ok('delivered qty followed the order number',
     wrote && wrote.every(u=>'Delivery_Qty' in u.fields), wrote&&wrote[0].fields);
  ok('bulk mode closed after applying', s.bulk===false, s.bulk);

  console.log('== leaving bulk restores the remove handle ==');
  ok('handles back', $$('.rowdel').length===$$('.strow').length,
     {d:$$('.rowdel').length, r:$$('.strow').length});
  ok('checkboxes gone', $$('.evsel').length===0);
  ok('no errors throughout', errs.length===0, errs.slice(0,3));

  console.log('\n'+(F2?'FAILURES: '+F2:'ALL PASS')+'  ('+P+' passed)');
  process.exit(F2?1:0);
}).catch(e=>{ console.error('THREW:', e&&e.stack||e); process.exit(2); });
