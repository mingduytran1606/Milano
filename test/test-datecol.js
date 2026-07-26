// The date column can be hidden. Hidden means GONE - no gutter and no stand-in band. The rows stay
// grouped by day and keep their boundary rule, they just carry no date. Hiding it also changes what
// "freeze" can mean, since there is no longer a gutter to pin.
const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
const F=require('path').join(__dirname,'..','stone-calendar','index.html');
const HTML=fs.readFileSync(F,'utf8').replace(/<script src="https:\/\/[^"]*grist-plugin-api\.js"><\/script>/,'');
const errs=[]; const vc=new VirtualConsole(); vc.on('jsdomError',e=>errs.push(e.message));
const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc});
const w=dom.window,D=dom.window.document,s=w._stonecal;
const $$=q=>[...D.querySelectorAll(q)];
let FA=0,P=0;
const ok=(n,c,x)=>{ if(c){P++;console.log('  PASS  '+n);} else {FA++;console.log('  FAIL  '+n+(x!==undefined?'  -> '+JSON.stringify(x):''));} };
const dateW=()=>w.eval('dateColW');
const DATE_RE=/(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} [A-Z][a-z]{2} \d{4}/;

w.eval('tblCols=[mkCol("client"),mkCol("stone"),mkCol("supplier"),mkCol("scope"),mkCol("status")]; render();');

console.log('== shown by default ==');
ok('flag defaults to shown', w.eval('showDateCol')===true);
ok('a gutter cell per day', $$('.ag-day.tbl>.ag-date').length>0, $$('.ag-day.tbl>.ag-date').length);
ok('the gutter shows the date', $$('.ag-date .daychip').every(c=>DATE_RE.test(c.textContent)),
   $$('.ag-date .daychip').map(c=>c.textContent.trim()));
ok('header carries a Date label',
   D.querySelector('.sthead>.stlab').textContent.trim()==='Date',
   D.querySelector('.sthead>.stlab').textContent);
const widthWithGutter=w.eval('colRowPx()');
const dayCount=$$('.ag-day.tbl').length;

console.log('== hidden means gone, with no stand-in ==');
w.eval('showDateCol=false; render();');
{
  ok('the gutter is gone', $$('.ag-day.tbl>.ag-date').length===0);
  ok('no band or other substitute appears', $$('.dayband').length===0 && $$('.daychip').length===0,
     {bands:$$('.dayband').length, chips:$$('.daychip').length});
  ok('no date text anywhere in the agenda',
     !DATE_RE.test(D.getElementById('agenda').textContent),
     (D.getElementById('agenda').textContent.match(DATE_RE)||[])[0]);
  ok('the days themselves still group', $$('.ag-day.tbl').length===dayCount,
     {now:$$('.ag-day.tbl').length, was:dayCount});
  ok('each day is now a single column', $$('.ag-day.tbl').every(d=>d.classList.contains('nogutter')));
  ok('the header drops its Date label too',
     D.querySelector('.sthead').classList.contains('nogutter')
     && D.querySelector('.sthead>.stlab')===null,
     D.querySelector('.sthead>.stlab') && D.querySelector('.sthead>.stlab').textContent);
  ok('the table reclaims the whole gutter width', w.eval('colRowPx()')===widthWithGutter-dateW(),
     {now:w.eval('colRowPx()'), was:widthWithGutter, gutter:dateW()});
  ok('rows still render', $$('.strow').length>0, $$('.strow').length);
  ok('the day boundary rule is still there',
     $$('.ag-day.tbl').length>0 && $$('.strows').length>0);
}

console.log('== the bulk day toggle goes with the gutter ==');
{
  w.eval('setBulk(true); render();');
  ok('tick boxes still render per row', $$('.evsel').length>0, $$('.evsel').length);
  ok('no orphaned Select day control', $$('.ag-all').length===0, $$('.ag-all').length);
  ok('and no stale entries left behind for it', w.eval('dayToggles.length')===0,
     w.eval('dayToggles.length'));
  ok('refreshing the toggles does not throw', (()=>{ try{ w.eval('refreshDayToggles(); render();');
     return true; }catch(e){ return false; } })());
  // with the gutter back, the toggle returns
  w.eval('showDateCol=true; render();');
  ok('Select day comes back with the gutter', $$('.ag-all').length>0, $$('.ag-all').length);
  w.eval('setBulk(false); render();');
}

console.log('== showing it again restores everything ==');
w.eval('showDateCol=true; render();');
ok('gutter back', $$('.ag-day.tbl>.ag-date').length>0);
ok('dates back', $$('.ag-date .daychip').length>0);
ok('no stale nogutter class', $$('.ag-day.tbl.nogutter').length===0);
ok('width back to normal', w.eval('colRowPx()')===widthWithGutter);

console.log('== freeze adapts to the gutter being hidden ==');
{
  w.eval('showDateCol=true; tblFreeze=2; render();');
  ok('shown: step 2 freezes the gutter + first column',
     !!D.querySelector('.ag-date.frz') && $$('.strow')[0].children[0].classList.contains('frz'));
  ok('shown: the first column sits past the gutter',
     $$('.strow')[0].children[0].style.left===dateW()+'px',
     $$('.strow')[0].children[0].style.left);
  w.eval('showDateCol=false; tblFreeze=2; render();');
  ok('hidden: the same number means two columns',
     $$('.strow')[0].querySelectorAll('.stcell.frz').length===2,
     $$('.strow')[0].querySelectorAll('.stcell.frz').length);
  ok('hidden: the first frozen column starts at 0',
     $$('.strow')[0].children[0].style.left==='0px',
     $$('.strow')[0].children[0].style.left);
  ok('hidden: the second follows the first width',
     $$('.strow')[0].children[1].style.left===w.eval('tblCols[0].w')+'px',
     $$('.strow')[0].children[1].style.left);
  ok('hidden: nothing tries to freeze a gutter that is not there',
     $$('.ag-date.frz').length===0);
  w.eval('showDateCol=true; tblFreeze=0; render();');
}

console.log('== the control in the Columns panel ==');
{
  w.eval('toggleColEditor();');
  const seg=[...D.querySelectorAll('.ce-datecol .miniseg button')];
  ok('a Show/Hide control is offered', seg.length===2, seg.map(b=>b.textContent));
  ok('it reflects the current state', seg[0].className==='on' && seg[0].textContent==='Show',
     seg.map(b=>b.textContent+(b.className==='on'?'*':'')));
  ok('Hide says it removes the column outright', /remov/i.test(seg[1].title||''), seg[1].title);
  seg[1].onclick();
  ok('Hide applies', w.eval('showDateCol')===false);
  ok('and the date is gone from the table', $$('.ag-date').length===0 && $$('.daychip').length===0);
  const seg2=[...D.querySelectorAll('.ce-datecol .miniseg button')];
  ok('Hide is now marked active', seg2[1].className==='on',
     seg2.map(b=>b.textContent+(b.className==='on'?'*':'')));
  ok('the hint warns that Select day goes with it',
     /select day/i.test(D.querySelector('.ce-datecol .ce-hint').textContent),
     D.querySelector('.ce-datecol .ce-hint').textContent);
  const fz=[...D.querySelectorAll('.ce-freeze .miniseg button')].map(b=>b.textContent);
  ok('freeze options drop the Date step', !fz.some(t=>/Date/.test(t)), fz);
  ok('freeze options are plain column counts', fz.slice(1).every(t=>/^\d+ cols?$/.test(t)), fz);
  seg2[0].onclick();
  ok('Show restores it', w.eval('showDateCol')===true && $$('.ag-date').length>0);
  const fz2=[...D.querySelectorAll('.ce-freeze .miniseg button')].map(b=>b.textContent);
  ok('and the Date freeze step comes back', fz2.some(t=>t==='Date'), fz2);
  w.eval('closeColEditor();');
}

console.log('== it persists like the other column prefs ==');
{
  w.eval(`window.__opts={};
    grist={ setOption:(k,v)=>{ window.__opts[k]=v; }, docApi:{} };
    showDateCol=false; saveTablePrefs(); publishTableCols();`);
  ok('published through grist.setOption', w.eval('window.__opts.tblDateColOn')===false,
     w.eval('window.__opts'));
  ok('kept in localStorage',
     JSON.parse(w.eval("localStorage.getItem('milano_stonecal_table')")).datecolon===false,
     w.eval("localStorage.getItem('milano_stonecal_table')"));
  w.eval('showDateCol=true; loadTablePrefs();');
  ok('restored on load', w.eval('showDateCol')===false, w.eval('showDateCol'));
  w.eval('showDateCol=false; applyGristOptions({tblDateColOn:true});');
  ok('a shared value is adopted', w.eval('showDateCol')===true, w.eval('showDateCol'));
  w.eval('applyGristOptions({tblDateColOn:"junk"});');
  ok('junk is ignored', w.eval('showDateCol')===true, w.eval('showDateCol'));
}

w.eval('showDateCol=true; render();');
ok('no jsdom errors', errs.length===0, errs);
console.log((FA?('FAILED '+FA+' of '+(FA+P)):'ALL PASS')+'  ('+P+' passed)');
process.exit(FA?1:0);
