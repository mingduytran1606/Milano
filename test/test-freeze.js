// Freeze panes. The frozen block is always contiguous from the left (date gutter, then the leading
// columns), because that is the only shape sticky positioning can hold without the frozen cells
// floating over a gap. Offsets are absolute from the scroll container, since sticky resolves
// against .agenda and not the nested column grid.
const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
const F=require('path').join(__dirname,'..','stone-calendar','index.html');
const HTML=fs.readFileSync(F,'utf8').replace(/<script src="https:\/\/[^"]*grist-plugin-api\.js"><\/script>/,'');
const errs=[]; const vc=new VirtualConsole(); vc.on('jsdomError',e=>errs.push(e.message));
const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc});
const w=dom.window,D=dom.window.document,s=w._stonecal;
const $$=q=>[...D.querySelectorAll(q)];
let FA=0,P=0;
const ok=(n,c,x)=>{ if(c){P++;console.log('  PASS  '+n);} else {FA++;console.log('  FAIL  '+n+(x!==undefined?'  -> '+JSON.stringify(x):''));} };

const setFreeze=n=>w.eval('tblFreeze='+n+'; render();');
const dateW=()=>w.eval('dateColW');

console.log('== off by default ==');
w.eval('tblCols=[mkCol("client"),mkCol("stone"),mkCol("supplier"),mkCol("scope"),mkCol("status")]; tblFreeze=0; render();');
ok('nothing frozen', w.eval('tblFreeze')===0);
ok('no sticky cells', $$('.frz').length===0, $$('.frz').length);
ok('gutter is not pinned', !D.querySelector('.ag-date.frz'));

console.log('== freeze the date gutter only ==');
setFreeze(1);
{
  ok('gutter is pinned at 0', (()=>{ const d=D.querySelector('.ag-day.tbl>.ag-date');
     return d.style.position==='sticky' && d.style.left==='0px'; })(),
     (()=>{const d=D.querySelector('.ag-day.tbl>.ag-date');return {p:d.style.position,l:d.style.left};})());
  ok('header date label is pinned too', (()=>{ const l=D.querySelector('.sthead>.stlab');
     return l.classList.contains('frz') && l.style.left==='0px'; })());
  ok('no data cell is frozen yet', $$('.strow>.stcell.frz').length===0, $$('.strow>.stcell.frz').length);
  ok('the gutter carries the separating edge', !!D.querySelector('.ag-date.frz-edge'));
}

console.log('== freeze date + the first column ==');
setFreeze(2);
{
  const rows=$$('.strow');
  ok('exactly one cell per row is frozen',
     rows.every(r=>r.querySelectorAll('.stcell.frz').length===1),
     [...new Set(rows.map(r=>r.querySelectorAll('.stcell.frz').length))]);
  ok('it is the FIRST cell', rows.every(r=>r.children[0].classList.contains('frz')));
  ok('pinned just past the date gutter',
     rows.every(r=>r.children[0].style.left===dateW()+'px'),
     {got:rows[0].children[0].style.left, want:dateW()+'px'});
  ok('the header label matches that offset',
     D.querySelectorAll('.stcols>.stlab')[0].style.left===dateW()+'px',
     D.querySelectorAll('.stcols>.stlab')[0].style.left);
  ok('the edge moved to the last frozen column',
     !D.querySelector('.ag-date.frz-edge') && !!D.querySelector('.stcell.frz-edge'));
}

console.log('== freeze date + three columns, offsets accumulate ==');
setFreeze(4);
{
  const ws=w.eval('tblCols.slice(0,3).map(c=>c.w)');
  const want=[dateW(), dateW()+ws[0], dateW()+ws[0]+ws[1]].map(n=>n+'px');
  const got=[...$$('.strow')[0].children].slice(0,3).map(e=>e.style.left);
  ok('each frozen column starts where the previous one ends', JSON.stringify(got)===JSON.stringify(want),
     {got, want});
  ok('three cells frozen per row',
     $$('.strow').every(r=>r.querySelectorAll('.stcell.frz').length===3));
  ok('only the last one draws the edge',
     $$('.strow').every(r=>r.querySelectorAll('.stcell.frz-edge').length===1));
  ok('the totals row is pinned the same way', (()=>{ const sum=$$('.stsum')[0];
     if(!sum) return true;
     return [...sum.children].slice(0,3).map(e=>e.style.left).join()===want.join(); })(),
     (()=>{const sum=$$('.stsum')[0];return sum?[...sum.children].slice(0,3).map(e=>e.style.left):null;})());
  // widening a frozen column must push the ones after it along
  w.eval('tblCols[0].w=200; render();');
  ok('offsets follow a width change',
     $$('.strow')[0].children[1].style.left===(dateW()+200)+'px',
     $$('.strow')[0].children[1].style.left);
  w.eval('tblCols[0].w='+ws[0]+'; render();');
}

console.log('== the bulk tick box freezes with the block ==');
{
  w.eval('setBulk(true); tblFreeze=2; render();');
  const row=$$('.strow')[0];
  const box=row.querySelector('.evsel');
  ok('the tick box is pinned at the gutter edge',
     box.classList.contains('frz') && box.style.left===dateW()+'px',
     {cls:box.className, left:box.style.left});
  ok('the first column shifts past the tick box',
     row.children[1].style.left===(dateW()+26)+'px',
     row.children[1].style.left);
  ok('the header spacer is pinned too',
     D.querySelectorAll('.stcols>.stlab')[0].classList.contains('frz'));
  w.eval('setBulk(false); render();');
}

console.log('== the control in the Columns panel ==');
{
  w.eval('tblFreeze=0; render(); toggleColEditor();');
  const seg=[...D.querySelectorAll('.ce-freeze .miniseg button')];
  ok('a freeze control is offered', seg.length>=2, seg.length);
  ok('it starts on None', seg[0].className==='on' && seg[0].textContent==='None',
     seg.map(b=>b.textContent+(b.className==='on'?'*':'')));
  ok('options never exceed date + 4 columns', seg.length<=6, seg.map(b=>b.textContent));
  ok('each option explains itself', seg.every(b=>(b.title||'').length>0));
  seg[2].onclick();
  ok('clicking an option applies it', w.eval('tblFreeze')===2, w.eval('tblFreeze'));
  ok('and the table reflects it', $$('.strow')[0].children[0].classList.contains('frz'));
  const seg2=[...D.querySelectorAll('.ce-freeze .miniseg button')];
  ok('the active option is marked', seg2[2].className==='on',
     seg2.map(b=>b.textContent+(b.className==='on'?'*':'')));
  seg2[0].onclick();
  ok('None turns it back off', w.eval('tblFreeze')===0 && $$('.frz').length===0);
}

console.log('== it persists like the other column prefs ==');
{
  w.eval('closeColEditor();');   // shared column options are ignored while the panel is open
  w.eval(`window.__opts={};
    grist={ setOption:(k,v)=>{ window.__opts[k]=v; }, docApi:{} };
    tblFreeze=3; saveTablePrefs(); publishTableCols();`);
  ok('published through grist.setOption', w.eval('window.__opts.tblFreeze')===3,
     w.eval('window.__opts'));
  ok('and kept in localStorage',
     JSON.parse(w.eval("localStorage.getItem('milano_stonecal_table')")).freeze===3,
     w.eval("localStorage.getItem('milano_stonecal_table')"));
  w.eval('tblFreeze=0; loadTablePrefs();');
  ok('restored on load', w.eval('tblFreeze')===3, w.eval('tblFreeze'));
  w.eval('tblFreeze=0; applyGristOptions({tblFreeze:2});');
  ok('a shared value is adopted', w.eval('tblFreeze')===2, w.eval('tblFreeze'));
  // and the guard that caused this test to fail first time round is real behaviour worth keeping
  w.eval('colPanelOpen=true; applyGristOptions({tblFreeze:4}); colPanelOpen=false;');
  ok('a shared value is NOT adopted while the Columns panel is open',
     w.eval('tblFreeze')===2, w.eval('tblFreeze'));
  w.eval('applyGristOptions({tblFreeze:"junk"});');
  ok('junk is ignored', w.eval('tblFreeze')===2, w.eval('tblFreeze'));
}

console.log('== asking for more than there is stays sane ==');
{
  w.eval('tblCols=[mkCol("client")]; tblFreeze=9; render();');
  ok('never freezes more columns than exist',
     $$('.strow')[0].querySelectorAll('.stcell.frz').length<=1,
     $$('.strow')[0].querySelectorAll('.stcell.frz').length);
  // freezing every column would leave nothing to scroll, so one column is always left free
  w.eval('tblCols=[mkCol("client"),mkCol("stone"),mkCol("supplier")]; tblFreeze=99; render();');
  ok('always leaves one column scrollable',
     $$('.strow')[0].querySelectorAll('.stcell.frz').length===2,
     $$('.strow')[0].querySelectorAll('.stcell.frz').length);
  ok('the frozen cells are still the leading ones',
     [...$$('.strow')[0].children].slice(0,2).every(e=>e.classList.contains('frz')));
  ok('still renders', $$('.strow').length>0, $$('.strow').length);
  ok('no jsdom errors', errs.length===0, errs);
}

console.log((FA?('FAILED '+FA+' of '+(FA+P)):'ALL PASS')+'  ('+P+' passed)');
process.exit(FA?1:0);
