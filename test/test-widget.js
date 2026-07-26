const fs=require('fs'); const {JSDOM}=require('jsdom');
const F = require('path').join(__dirname,'..','stone-calendar','index.html');
let h=fs.readFileSync(F,'utf8').replace(/<script src="https:\/\/[^"]*grist-plugin-api\.js"><\/script>/,'');
const errs=[];
const dom=new JSDOM(h,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',
  virtualConsole:new (require('jsdom').VirtualConsole)().on('jsdomError',e=>errs.push(e.message))});
const w=dom.window,D=w.document,s=w._stonecal;
let F2=0,P=0;
const ok=(n,c,x)=>{ if(c){P++;console.log('  PASS  '+n);} else {F2++;console.log('  FAIL  '+n+(x!==undefined?'  -> '+JSON.stringify(x):''));} };
const $$=q=>[...D.querySelectorAll(q)];

console.log('== boots on sample data ==');
console.log('== search finds dates ==');
{
  const q=(v)=>{ w.eval('state.searchQ='+JSON.stringify(v)+'; render();'); return $$('.strow').length; };
  const all=q('');
  // pick a real order date out of the sample and search for it several ways
  const d=w.eval(`(function(){var r=state.stone.find(function(x){return x.Order_Date;});
     var dt=toDate(r.Order_Date);
     return {dmy:fmtDMY(r.Order_Date), slash:fmtDMY(r.Order_Date).replace(/-/g,'/'),
             dmon:dt.getDate()+' '+MONTHS[dt.getMonth()].slice(0,3),
             mon:MONTHS[dt.getMonth()], yr:String(dt.getFullYear())};})()`);
  ok('DD-MM-YYYY finds orders', q(d.dmy)>0, {term:d.dmy, hits:q(d.dmy)});
  ok('DD/MM/YYYY finds orders', q(d.slash)>0, {term:d.slash, hits:q(d.slash)});
  ok('"26 Jul" style finds orders', q(d.dmon)>0, {term:d.dmon, hits:q(d.dmon)});
  ok('month name finds orders', q(d.mon)>0, {term:d.mon, hits:q(d.mon)});
  ok('year finds orders', q(d.yr)>0, {term:d.yr, hits:q(d.yr)});
  ok('a date that is not there finds nothing', q('01-01-1999')===0, q('01-01-1999'));
  ok('date search narrows rather than matching everything', q(d.dmy)<=all, {hit:q(d.dmy), all});
  w.eval('state.searchQ=""; render();');
  ok('clearing the search restores every row', $$('.strow').length===all, {now:$$('.strow').length, all});
}

ok('no jsdom errors', errs.length===0, errs.slice(0,3));
ok('state exists', !!s);
ok('sample rows', s.stone.length===7, s.stone&&s.stone.length);

console.log('== table renders instead of chips ==');
ok('no chips', $$('.ev').length===0, $$('.ev').length);
ok('column header rendered once', $$('.sthead').length===1);
ok('header has a label per column', $$('.sthead .stcols .stlab').length===w.eval('tblCols.length'),
   $$('.sthead .stcols .stlab').map(e=>e.textContent));
ok('rows rendered', $$('.strow').length>0, $$('.strow').length);
ok('every row has cols.length cells (+1 handle)',
   $$('.strow').every(r=>r.children.length===w.eval('tblCols.length')+1),
   [...new Set($$('.strow').map(r=>r.children.length))]);
ok('all rows share one grid template',
   new Set($$('.strow').map(r=>r.style.gridTemplateColumns)).size===1,
   [...new Set($$('.strow').map(r=>r.style.gridTemplateColumns))]);
ok('header template matches rows',
   D.querySelector('.sthead .stcols').style.gridTemplateColumns===$$('.strow')[0].style.gridTemplateColumns);
ok('totals row per day', $$('.stsum').length>0, $$('.stsum').length);
ok('totals share the same template',
   $$('.stsum').every(x=>x.style.gridTemplateColumns===$$('.strow')[0].style.gridTemplateColumns));
ok('Total sits in column two', $$('.stsum').every(x=>/Total/.test(x.children[1].textContent)),
   $$('.stsum').map(x=>x.children[1].textContent.trim()));

console.log('== headline and pills count slabs ==');
ok('headline in slabs', /slabs$/.test(D.getElementById('title').textContent),
   D.getElementById('title').textContent);
ok('pill counts are slab sums', (()=>{ const all=$$('.sfp')[0];
   return all && all.querySelector('.cnt').textContent===String(w.eval('slabSum(baseRows())')); })(),
   {pill:($$('.sfp')[0]||{}).textContent, calc:w.eval('slabSum(baseRows())')});

console.log('== date gutter chip ==');
ok('a chip per day', $$('.ag-date .daychip').length>0, $$('.ag-date .daychip').length);
ok('the gutter supplier box is gone', $$('.supbox').length===0);
ok('date is a single line, weekday day mon year',
   $$('.daychip .dtxt').every(n=>/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} [A-Z][a-z]{2} \d{4}$/.test(n.textContent.trim())),
   $$('.daychip .dtxt').map(n=>n.textContent));
ok('no emphasised day-number circle any more', $$('.daychip .dnum').length===0);
ok('chip is one row', $$('.daychip').every(c=>c.querySelectorAll('span').length===1),
   $$('.daychip').map(c=>c.querySelectorAll('span').length));
ok('the gutter heading is just Date',
   D.querySelector('.sthead .stlab').textContent.trim()==='Date',
   D.querySelector('.sthead .stlab').textContent);
ok('at most one chip is flagged today', $$('.daychip.today').length<=1, $$('.daychip.today').length);

console.log('== group by supplier ==');
ok('grouping is off to begin with', w.eval('groupBySup')===false);
ok('no group headers while off', $$('.supgrp').length===0, $$('.supgrp').length);
D.getElementById('groupBtn').onclick({stopPropagation(){}});
ok('toggle turns it on', w.eval('groupBySup')===true);
ok('button reads as active', D.getElementById('groupBtn').classList.contains('on'));
ok('group headers appear', $$('.supgrp').length>0, $$('.supgrp').length);
ok('the group row carries no supplier name, it is a total row', $$('.supgrp .gnm').length===0);
ok('it is labelled Total', $$('.supgrp .lb').every(e=>/total/i.test(e.textContent)),
   $$('.supgrp .lb').map(e=>e.textContent));
ok('the total row is static, not a control',
   $$('.supgrp').every(h=>!h.onclick), $$('.supgrp').map(h=>typeof h.onclick));
ok('no fold twisty', $$('.supgrp .tw').length===0);
ok('every row stays visible - nothing is foldable away',
   $$('.strow').length===w.eval('baseRows().filter(function(r){return passStatus(r);}).length'),
   {rows:$$('.strow').length, expected:w.eval('baseRows().filter(function(r){return passStatus(r);}).length')});
ok('the total row is not a pointer target',
   !/cursor:\s*pointer/.test(w.eval('[...document.styleSheets[0].cssRules].map(r=>r.cssText).filter(t=>/\.supgrp\{/.test(t)).join("")')));
D.getElementById('groupBtn').onclick({stopPropagation(){}});
ok('toggling off removes the headers', $$('.supgrp').length===0 && w.eval('groupBySup')===false);

console.log('== editable vs read-only ==');
ok('editable cells marked', $$('.stcell.ed').length>0);
ok('read-only cells marked', $$('.stcell.roc').length>0);
ok('client is read-only', $$('.strow')[0].children[0].className.includes('roc'));
ok('scope is editable', (()=>{ const i=w.eval('tblCols.findIndex(c=>c.k==="scope")');
   return $$('.strow')[0].children[i].className.includes(' ed'); })());
ok('Client bold by default', !!$$('.strow')[0].children[0].querySelector('b'));

console.log('== remove handle ==');
ok('one per row', $$('.rowdel').length===$$('.strow').length, {d:$$('.rowdel').length,r:$$('.strow').length});
ok('not on totals rows', $$('.stsum .rowdel').length===0);

console.log('== inline edit writes through ==');
const i=w.eval('tblCols.findIndex(c=>c.k==="delivered")');
const cell=$$('.strow')[0].children[i];
const rid=Number(cell.dataset.rid);
cell.onclick({stopPropagation(){}});
const inp=cell.querySelector('input');
ok('opens a number input', !!inp && inp.type==='number', inp&&inp.type);
inp.value='7'; inp.onblur();
ok('value applied to the row', w.eval('state.stone.find(r=>r.id==='+rid+').Delivery_Qty')===7,
   w.eval('state.stone.find(r=>r.id==='+rid+').Delivery_Qty'));
ok('no jsdom errors after editing', errs.length===0, errs.slice(0,3));

console.log('== Quote rows are hidden ==');
const q0=$$('.strow').length;
ok('sample Naz job is a Quote, so 6 of 7 rows show', q0===6 && s.stone.length===7,
   {shown:q0, total:s.stone.length});
w.eval('state.jobs.forEach(j=>j.Stage="Quote"); reindex(); render();');
ok('all rows disappear when every job is a Quote', $$('.strow').length===0, $$('.strow').length);
w.eval('state.jobs.forEach(j=>j.Stage="Live"); reindex(); render();');
ok('all 7 show once no job is a Quote', $$('.strow').length===7, $$('.strow').length);

console.log('== totals toggle ==');
w.eval('showTotals=false; render();');
ok('totals hidden', $$('.stsum').length===0);
w.eval('showTotals=true; render();');
ok('totals back', $$('.stsum').length>0);

console.log('\n'+(F2?'FAILURES: '+F2:'ALL PASS')+'  ('+P+' passed)');
process.exit(F2?1:0);
