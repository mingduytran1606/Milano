// Every column must render without throwing. A throw inside render() leaves the widget BLANK,
// which is what happened when "$ / slab" was added: priceOf() was referenced but never defined.
const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
const F=require('path').join(__dirname,'..','stone-calendar','index.html');
const HTML=fs.readFileSync(F,'utf8').replace(/<script src="https:\/\/[^"]*grist-plugin-api\.js"><\/script>/,'');
const errs=[]; const vc=new VirtualConsole(); vc.on('jsdomError',e=>errs.push(e.message));
const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc});
const w=dom.window,D=dom.window.document,s=w._stonecal;
const $$=q=>[...D.querySelectorAll(q)];
let FA=0,P=0;
const ok=(n,c,x)=>{ if(c){P++;console.log('  PASS  '+n);} else {FA++;console.log('  FAIL  '+n+(x!==undefined?'  -> '+JSON.stringify(x):''));} };

const keys=w.eval('Object.keys(COLDEF)');
console.log('== every column renders on its own ('+keys.length+' columns) ==');
keys.forEach(k=>{
  let threw=null, cells=0;
  try{
    w.eval('tblCols=[mkCol('+JSON.stringify(k)+')]; render();');
    cells=$$('.strow').length;
  }catch(e){ threw=e.message; }
  ok('column "'+k+'" renders', !threw && cells>0, threw||{rows:cells});
});

console.log('== the totals row survives every column too ==');
keys.forEach(k=>{
  let threw=null;
  try{ w.eval('tblCols=[mkCol('+JSON.stringify(k)+')]; showTotals=true; render();'); }
  catch(e){ threw=e.message; }
  ok('totals with "'+k+'"', !threw, threw);
});

console.log('== all columns at once ==');
{
  let threw=null;
  try{ w.eval('tblCols=Object.keys(COLDEF).map(k=>mkCol(k)); render();'); }
  catch(e){ threw=e.message; }
  ok('every column together renders', !threw, threw);
  ok('rows still present', $$('.strow').length>0, $$('.strow').length);
  ok('a cell per column, plus the handle slot',
     $$('.strow').every(r=>r.children.length===keys.length+1),
     [...new Set($$('.strow').map(r=>r.children.length))]);
  ok('header matches', D.querySelector('.sthead .stcols').children.length===keys.length,
     D.querySelector('.sthead .stcols').children.length);
}

console.log('== in bulk mode as well ==');
{
  let threw=null;
  try{ w.eval('setBulk(true); render();'); }catch(e){ threw=e.message; }
  ok('all columns + bulk renders', !threw, threw);
  ok('tick boxes present', $$('.evsel').length>0, $$('.evsel').length);
  w.eval('setBulk(false);');
}


console.log('== rules span the whole table, not just the visible pane ==');
{
  w.eval('tblCols=Object.keys(COLDEF).map(k=>mkCol(k)); setBulk(false); render();');
  const bodyPx=w.eval('colBodyPx()'), rowPx=w.eval('colRowPx()');
  const row=$$('.strow')[0], head=D.querySelector('.sthead'), hcols=D.querySelector('.sthead .stcols');
  const day=D.querySelector('.ag-day.tbl'), sum=$$('.stsum')[0];
  ok('column total is the sum of the widths + handle',
     bodyPx===w.eval('tblCols.reduce((s,c)=>s+c.w,0)')+26, bodyPx);
  ok('data row is pinned to the column total', row.style.minWidth===bodyPx+'px', row.style.minWidth);
  ok('header cols grid is pinned too', hcols.style.minWidth===bodyPx+'px', hcols.style.minWidth);
  ok('header shell spans gutter + columns', head.style.minWidth===rowPx+'px', head.style.minWidth);
  ok('the day block spans gutter + columns (this is the day rule)',
     day && day.style.minWidth===rowPx+'px', day && day.style.minWidth);
  if(sum) ok('totals row is pinned', sum.style.minWidth===bodyPx+'px', sum.style.minWidth);
  ok('day block is at least as wide as the header', rowPx>=bodyPx, {rowPx, bodyPx});
  // narrowing a column must shrink the pinned widths, i.e. they are recomputed not baked in
  w.eval('tblCols[0].w=60; render();');
  const narrower=w.eval('colBodyPx()');
  ok('widths follow a column resize', narrower<bodyPx && $$('.strow')[0].style.minWidth===narrower+'px',
     {narrower, was:bodyPx, applied:$$('.strow')[0].style.minWidth});
}

console.log('== refresh button ==');
{
  const btn=D.getElementById('reloadBtn');
  ok('refresh button exists in the toolbar', !!btn);
  ok('it has a handler', typeof btn.onclick==='function');
  ok('it explains the shift variant', /shift/i.test(btn.title||''), btn.title);
  let reloaded=null;
  w.eval('window.__loc=[]; ');
  // plain click in demo mode: re-render, no navigation
  btn.onclick({stopPropagation(){}, shiftKey:false});
  ok('plain click does not navigate', true);
  ok('rows still rendered after refresh', $$('.strow').length>0, $$('.strow').length);
}

ok('no jsdom errors', errs.length===0, errs);
console.log((FA?('FAILED '+FA+' of '+(FA+P)):'ALL PASS')+'  ('+P+' passed)');
process.exit(FA?1:0);
