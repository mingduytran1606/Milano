// Stone and Supplier are read-outs of the linked catalogue product, so editing either must write
// the Product REF. Writing Product_Supplier / Product_Code directly would silently do nothing in
// Grist - they are formula columns ($Product.Supplier / $Product.Code).
const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
const F=require('path').join(__dirname,'..','stone-calendar','index.html');
const HTML=fs.readFileSync(F,'utf8').replace(/<script src="https:\/\/[^"]*grist-plugin-api\.js"><\/script>/,'');
const errs=[]; const vc=new VirtualConsole(); vc.on('jsdomError',e=>errs.push(e.message));
const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc});
const w=dom.window,D=dom.window.document,s=w._stonecal;
const $$=q=>[...D.querySelectorAll(q)];
let FA=0,P=0;
const ok=(n,c,x)=>{ if(c){P++;console.log('  PASS  '+n);} else {FA++;console.log('  FAIL  '+n+(x!==undefined?'  -> '+JSON.stringify(x):''));} };

// show both columns and capture what gets written
w.eval(`tblCols=[mkCol("client"),mkCol("stone"),mkCol("supplier"),mkCol("scope")]; render();
        window.__wrote=[]; queueCellWrite=function(u){ window.__wrote.push(u); };`);
const idxOf=k=>w.eval('tblCols.findIndex(c=>c.k==="'+k+'")');

console.log('== both columns are editable ==');
['stone','supplier'].forEach(k=>{
  const cell=$$('.strow')[0].children[idxOf(k)];
  ok(k+' cell is marked editable', cell.className.includes(' ed'), cell.className);
  ok(k+' edits the Product column', w.eval('COLDEF.'+k+'.edit.f')==='Product',
     w.eval('COLDEF.'+k+'.edit.f'));
  ok(k+' uses the product editor', w.eval('COLDEF.'+k+'.edit.t')==='product');
});

console.log('== the editor is a catalogue picker ==');
{
  const cell=$$('.strow')[0].children[idxOf('stone')];
  cell.onclick({stopPropagation(){}});
  const inp=cell.querySelector('input');
  ok('opens a text input', !!inp && inp.type==='text', inp&&inp.type);
  ok('backed by a datalist', !!inp.getAttribute('list') && !!cell.querySelector('datalist'));
  const opts=[...cell.querySelectorAll('datalist option')].map(o=>o.value);
  ok('lists the catalogue', opts.length===w.eval('state.catalogue.length'),
     {opts:opts.length, cat:w.eval('state.catalogue.length')});
  ok('seeded with the row current product', inp.value.length>0, inp.value);
  ok('an unknown name is flagged', (()=>{ inp.value='Not A Real Stone'; inp.oninput();
     return /danger/.test(inp.style.borderColor); })(), inp.style.borderColor);
  // refusing a typo must leave the row alone
  const before=w.eval('refId(state.stone[0].Product)');
  inp.onblur();
  ok('a typo is refused, not guessed at', w.eval('refId(state.stone[0].Product)')===before,
     {before, after:w.eval('refId(state.stone[0].Product)')});
  ok('nothing was written for the typo', w.eval('window.__wrote.length')===0, w.eval('window.__wrote'));
}

console.log('== picking a product writes the ref ==');
{
  // The agenda is date-sorted, so .strow[0] is NOT state.stone[0]; resolve the row from the cell.
  const cell0=$$('.strow')[0].children[idxOf('stone')];
  const rid=Number(cell0.dataset.rid);
  const R=()=>w.eval('state.stone.find(function(x){return x.id==='+rid+';})');
  const target=w.eval(`(function(){var r=state.stone.find(function(x){return x.id===${rid};});
    return state.catalogue.find(function(c){return refId(r.Product)!==c.id;});})()`);
  const label=w.eval(`(function(){var r=state.stone.find(function(x){return x.id===${rid};});
    var c=state.catalogue.find(function(c){return refId(r.Product)!==c.id;});
    return String(c[(state.ref.product&&state.ref.product.labelCol)||"Product_Full"]||c.Product_Full);})()`);
  cell0.onclick({stopPropagation(){}});
  const inp=cell0.querySelector('input');
  inp.value=label; inp.oninput(); inp.onblur();
  const wrote=w.eval('window.__wrote');
  ok('one write went out', wrote.length===1, wrote);
  ok('it targets the edited row', wrote[0] && wrote[0].id===rid, {got:wrote[0]&&wrote[0].id, want:rid});
  ok('it writes Product, as a plain row id',
     wrote[0] && Object.keys(wrote[0].fields).join()==='Product' && typeof wrote[0].fields.Product==='number',
     wrote[0]&&wrote[0].fields);
  ok('it does NOT write the formula columns',
     wrote[0] && !('Product_Supplier' in wrote[0].fields) && !('Product_Code' in wrote[0].fields),
     wrote[0]&&Object.keys(wrote[0].fields));
  ok('the row now points at the picked product',
     w.eval('refId(state.stone.find(function(x){return x.id==='+rid+';}).Product)')===target.id,
     {now:w.eval('refId(state.stone.find(function(x){return x.id==='+rid+';}).Product)'), want:target.id});
  ok('the Supplier read-out follows immediately',
     R().Product_Supplier===(target.Supplier||''), {now:R().Product_Supplier, want:target.Supplier});
}

console.log('== editing from the Supplier cell does the same ==');
{
  w.eval('window.__wrote=[]; render();');
  const cell=$$('.strow')[1].children[idxOf('supplier')];
  const rid=Number(cell.dataset.rid);
  cell.onclick({stopPropagation(){}});
  const inp=cell.querySelector('input');
  ok('supplier cell opens the same picker', !!inp && !!cell.querySelector('datalist'));
  const label=w.eval(`(function(){var r=state.stone.find(function(x){return x.id===${rid};});
    var c=state.catalogue.find(function(c){return refId(r.Product)!==c.id;});
    return String(c[(state.ref.product&&state.ref.product.labelCol)||"Product_Full"]||c.Product_Full);})()`);
  inp.value=label; inp.oninput(); inp.onblur();
  const wrote=w.eval('window.__wrote');
  ok('writes Product from the supplier cell too',
     wrote.length===1 && Object.keys(wrote[0].fields).join()==='Product', wrote);
}

console.log('== clearing the cell unlinks the product ==');
{
  w.eval('window.__wrote=[]; render();');
  const cell=$$('.strow')[0].children[idxOf('stone')];
  const rid=Number(cell.dataset.rid);
  cell.onclick({stopPropagation(){}});
  const inp=cell.querySelector('input');
  inp.value=''; inp.oninput(); inp.onblur();
  const wrote=w.eval('window.__wrote');
  ok('an empty cell clears the link', wrote.length===1 && wrote[0].fields.Product===null, wrote);
  ok('supplier read-out clears with it',
     w.eval('state.stone.find(function(x){return x.id==='+rid+';}).Product_Supplier')==='',
     w.eval('state.stone.find(function(x){return x.id==='+rid+';}).Product_Supplier'));
}

console.log('== re-picking the same product is a no-op ==');
{
  w.eval(`render(); window.__wrote=[];
    state.stone[0].Product=state.catalogue[0].id; reindex(); render();`);
  const cell=$$('.strow')[0].children[idxOf('stone')];
  cell.onclick({stopPropagation(){}});
  const inp=cell.querySelector('input');
  inp.onblur();                        // committed unchanged
  ok('no write when nothing changed', w.eval('window.__wrote.length')===0, w.eval('window.__wrote'));
}

ok('no jsdom errors', errs.length===0, errs);
console.log((FA?('FAILED '+FA+' of '+(FA+P)):'ALL PASS')+'  ('+P+' passed)');
process.exit(FA?1:0);
