// Regression suite for two "doesn't stick" bugs in the Stone Order Calendar:
//   1. ticking an UNDATED order, then any re-render, silently dropped the selection
//      (the pruning "live" set was built from dated events only)
//   2. the agenda sort direction lived in localStorage alone, so in a cross-origin
//      Grist iframe with third-party storage blocked it never survived a reload
//      (every other preference also mirrors through grist.setOption)
const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
const F=require('path').join(__dirname,'..','stone-calendar','index.html');
const HTML=fs.readFileSync(F,'utf8').replace(/<script src="https:\/\/[^"]*grist-plugin-api\.js"><\/script>/,'');
const errs=[]; const vc=new VirtualConsole(); vc.on('jsdomError',e=>errs.push(e.message));
const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc});
const w=dom.window,D=dom.window.document,s=w._stonecal;
const $$=q=>[...D.querySelectorAll(q)];
let FA=0,P=0;
const ok=(n,c,x)=>{ if(c){P++;console.log('  PASS  '+n);} else {FA++;console.log('  FAIL  '+n+(x!==undefined?'  -> '+JSON.stringify(x):''));} };

// ---------------------------------------------------------------
console.log('== undated orders survive a re-render while selected ==');
// Put the widget in a view that lists undated rows: "na" shows the N/A bucket,
// which is where orders with no order date and no delivery date live.
w.eval(`
  // one undated order, guaranteed to render only in the undated block
  state.stone.push({ id:9001, Job:2, Product:101, Product_Code:"LS303", Product_Supplier:"Lavistone",
    Scope_Qty:3, Ordered_Qty:0, Delivery_Qty:0, Order_Status:"N/A", Order_Date:null, Delivery_Date:null });
  state.statusFilter="na"; setBulk(true); render();
`);
const undatedIds=w.eval('undatedShown().map(r=>r.id)');
ok('an undated order is on screen', undatedIds.includes(9001), undatedIds);
ok('it has a tick box', $$('.evsel').length>0, $$('.evsel').length);

w.eval('state.sel.clear(); state.sel.add(9001); renderBulkBar();');
ok('undated order ticks', s.sel.has(9001));
ok('bulk bar counts it', /1 selected/.test(D.getElementById('bulkCount').textContent),
   D.getElementById('bulkCount').textContent);

w.eval('render();');   // the bug: pruning ran against dated events only
ok('selection SURVIVES a re-render', s.sel.has(9001), [...s.sel]);
ok('apply stays enabled after the re-render', D.getElementById('bulkApply').disabled===false);

console.log('== the tick box leads the row, and the grid stays aligned ==');
{
  const row=$$('.strow')[0];
  ok('tick box is the FIRST child of the row', row.firstChild && row.firstChild.classList.contains('evsel'),
     row.firstChild && row.firstChild.className);
  ok('exactly one tick box per row', $$('.strow').every(r=>r.querySelectorAll('.evsel').length===1),
     [...new Set($$('.strow').map(r=>r.querySelectorAll('.evsel').length))]);
  ok('remove handle steps aside in bulk', $$('.rowdel').length===0, $$('.rowdel').length);
  ok('template puts the 26px slot first', /^26px /.test(row.style.gridTemplateColumns),
     row.style.gridTemplateColumns);
  const hcols=D.querySelector('.sthead .stcols');
  ok('header uses the same template', hcols.style.gridTemplateColumns===row.style.gridTemplateColumns,
     {head:hcols.style.gridTemplateColumns, row:row.style.gridTemplateColumns});
  ok('header gained a leading spacer so labels still line up',
     hcols.children.length===w.eval('tblCols.length')+1, hcols.children.length);
  // Same template + same child count already proves the columns line up. What is worth pinning
  // is that the leading spacer did not shift the per-column ALIGNMENT by one slot: compare just
  // the r/c modifiers, since row cells also carry "roc" (read-only) which headers never do.
  const alignOf=e=>(e.className.match(/\b[rc]\b/)||[""])[0];
  ok('column alignment is not shifted by the leading spacer',
     [...hcols.children].slice(1).map(alignOf).join("|")
       ===[...row.children].slice(1).map(alignOf).join("|"),
     {head:[...hcols.children].slice(1).map(alignOf),
      row:[...row.children].slice(1).map(alignOf)});
  const sum=$$('.stsum')[0];
  if(sum){
    ok('totals row uses the same template', sum.style.gridTemplateColumns===row.style.gridTemplateColumns,
       {sum:sum.style.gridTemplateColumns, row:row.style.gridTemplateColumns});
    ok('totals row gained the spacer too', sum.children.length===w.eval('tblCols.length')+1,
       sum.children.length);
  }
  ok('row child count is still columns + 1',
     $$('.strow').every(r=>r.children.length===w.eval('tblCols.length')+1),
     [...new Set($$('.strow').map(r=>r.children.length))]);
}

console.log('== leaving bulk puts the slot back at the end ==');
w.eval('setBulk(false); render();');
{
  const row=$$('.strow')[0];
  ok('slot returns to the end', /\s26px$/.test(row.style.gridTemplateColumns),
     row.style.gridTemplateColumns);
  ok('remove handle is back', $$('.rowdel').length>0);
  ok('no tick boxes outside bulk', $$('.evsel').length===0);
  const hcols=D.querySelector('.sthead .stcols');
  ok('header spacer removed again', hcols.children.length===w.eval('tblCols.length'), hcols.children.length);
  ok('header still matches the rows', hcols.style.gridTemplateColumns===row.style.gridTemplateColumns,
     {head:hcols.style.gridTemplateColumns, row:row.style.gridTemplateColumns});
}
w.eval('setBulk(true); state.sel.clear(); state.sel.add(9001); render();');
ok('back in bulk, the selection round-trips', s.sel.has(9001), [...s.sel]);

console.log('== a genuinely gone row is still pruned ==');
w.eval('state.sel.add(999999); render();');
ok('an id that is not on screen is dropped', !s.sel.has(999999), [...s.sel]);
ok('the real selection is untouched by that pruning', s.sel.has(9001), [...s.sel]);

console.log('== applyBulk reaches the undated row ==');
w.eval(`window.__wrote=null; writeRows=async u=>{ window.__wrote=u; };
        state.sel=new Set([9001]); confirmBox=async()=>"go";`);
D.getElementById('bulkStatus').value='Delivered';
Promise.resolve(w.eval('applyBulk()')).then(()=>{
  const wrote=w.eval('window.__wrote');
  ok('the undated order is written', Array.isArray(wrote)&&wrote.length===1&&wrote[0].id===9001, wrote);
  ok('status is in the payload', wrote&&wrote[0].fields.Order_Status==='Delivered', wrote&&wrote[0].fields);

  // ---------------------------------------------------------------
  console.log('== sort direction is published to Grist, not just localStorage ==');
  const opts={};
  w.eval(`window.__opts={};
          window.grist={ setOption:(k,v)=>{ window.__opts[k]=v; },
                         docApi:{}, ready(){}, onOptions(){}, onRecords(){} };`);
  w.eval('state.sortDir="asc"; savePrefs();');
  w.eval('state.sortDir="desc"; savePrefs();');
  const published=w.eval('window.__opts');
  ok('savePrefs publishes the sort through grist.setOption',
     published && published.sort==='desc', published);

  console.log('== a shared sort option is adopted on load ==');
  w.eval('state.sortDir="asc"; applyGristOptions({sort:"desc"});');
  ok('applyGristOptions restores the direction', s.sortDir==='desc', s.sortDir);
  w.eval('applyGristOptions({sort:"nonsense"});');
  ok('a junk value is ignored', s.sortDir==='desc', s.sortDir);
  w.eval('applyGristOptions({sort:"asc"});');
  ok('a valid value applies', s.sortDir==='asc', s.sortDir);

  console.log('== localStorage still works as the per-person fallback ==');
  w.eval('state.sortDir="desc"; savePrefs(); state.sortDir="asc"; loadPrefs();');
  ok('loadPrefs still restores from localStorage', s.sortDir==='desc', s.sortDir);

  ok('no jsdom errors', errs.length===0, errs);
  console.log((FA?('FAILED '+FA+' of '+(FA+P)):'ALL PASS')+'  ('+P+' passed)');
  process.exit(FA?1:0);
});
