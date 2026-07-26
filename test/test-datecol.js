// The date gutter can be hidden to win back its width. The date must not be lost when it is: each
// day gets a full-width band above its rows instead. Hiding it also changes what "freeze" can mean,
// since there is no longer a gutter to pin.
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

w.eval('tblCols=[mkCol("client"),mkCol("stone"),mkCol("supplier"),mkCol("scope"),mkCol("status")]; render();');

console.log('== shown by default ==');
ok('flag defaults to shown', w.eval('showDateCol')===true);
ok('a gutter cell per day', $$('.ag-day.tbl>.ag-date').length>0, $$('.ag-day.tbl>.ag-date').length);
ok('no day bands while it is shown', $$('.dayband').length===0);
ok('header carries a Date label',
   D.querySelector('.sthead>.stlab').textContent.trim()==='Date',
   D.querySelector('.sthead>.stlab').textContent);
const widthWithGutter=w.eval('colRowPx()');

console.log('== hiding it ==');
w.eval('showDateCol=false; render();');
{
  ok('the gutter is gone', $$('.ag-day.tbl>.ag-date').length===0);
  ok('every day gets a band instead', $$('.dayband').length===$$('.ag-day.tbl').length,
     {bands:$$('.dayband').length, days:$$('.ag-day.tbl').length});
  ok('the band still names the day',
     $$('.dayband').every(b=>/(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} [A-Z][a-z]{2} \d{4}/.test(b.textContent)),
     $$('.dayband').map(b=>b.textContent.trim()));
  ok('today is still marked in the band', $$('.dayband .daychip.today').length<=1,
     $$('.dayband .daychip.today').length);
  ok('the day becomes a single column', $$('.ag-day.tbl').every(d=>d.classList.contains('nogutter')));
  ok('the header drops its Date label too',
     D.querySelector('.sthead').classList.contains('nogutter')
     && D.querySelector('.sthead>.stlab')===null,
     D.querySelector('.sthead>.stlab') && D.querySelector('.sthead>.stlab').textContent);
  ok('the table reclaims the gutter width', w.eval('colRowPx()')===widthWithGutter-dateW(),
     {now:w.eval('colRowPx()'), was:widthWithGutter, gutter:dateW()});
  ok('the band spans the table width, like the rules',
     $$('.dayband')[0].style.minWidth===w.eval('colRowPx()')+'px',
     $$('.dayband')[0].style.minWidth);
  ok('rows still render', $$('.strow').length>0, $$('.strow').length);
  // the band is as wide as the scroll area, so sticking the band buys nothing - the CONTENT has to
  // stick, or the date scrolls out of sight exactly when you need it
  ok('the band content is what sticks, not the band',
     (()=>{ const all=[...D.styleSheets].flatMap(sh=>{try{return [...sh.cssRules].map(r=>r.cssText||'')}catch(e){return[]}});
       const norm=t=>t.replace(/\s+/g,'');
       return all.some(t=>/\.dayband>\.daychip\{position:sticky/.test(norm(t)))
           && !all.some(t=>/\.dayband\{[^}]*position:sticky/.test(norm(t))); })(),
     [...D.styleSheets].flatMap(sh=>{try{return [...sh.cssRules].map(r=>r.cssText||'')}catch(e){return[]}})
       .filter(t=>/dayband/.test(t)));
}

console.log('== showing it again restores everything ==');
w.eval('showDateCol=true; render();');
ok('gutter back', $$('.ag-day.tbl>.ag-date').length>0);
ok('bands gone', $$('.dayband').length===0);
ok('no stale nogutter class', $$('.ag-day.tbl.nogutter').length===0);
ok('width back to normal', w.eval('colRowPx()')===widthWithGutter);

console.log('== freeze adapts to the gutter being hidden ==');
{
  // with the gutter showing, step 1 is the gutter and columns start at step 2
  w.eval('showDateCol=true; tblFreeze=2; render();');
  ok('shown: step 2 freezes the gutter + first column',
     !!D.querySelector('.ag-date.frz') && $$('.strow')[0].children[0].classList.contains('frz'));
  ok('shown: the first column sits past the gutter',
     $$('.strow')[0].children[0].style.left===dateW()+'px',
     $$('.strow')[0].children[0].style.left);
  // hidden, the same number means columns outright, starting at x=0
  w.eval('showDateCol=false; tblFreeze=2; render();');
  ok('hidden: two columns freeze',
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
  ok('both options explain themselves', seg.every(b=>(b.title||'').length>0));
  seg[1].onclick();
  ok('Hide applies', w.eval('showDateCol')===false);
  ok('and the table follows', $$('.dayband').length>0);
  const seg2=[...D.querySelectorAll('.ce-datecol .miniseg button')];
  ok('Hide is now marked active', seg2[1].className==='on',
     seg2.map(b=>b.textContent+(b.className==='on'?'*':'')));
  // the freeze options must now talk about columns, not the date
  const fz=[...D.querySelectorAll('.ce-freeze .miniseg button')].map(b=>b.textContent);
  ok('freeze options drop the Date step', !fz.some(t=>/Date/.test(t)), fz);
  ok('freeze options are plain column counts', fz.slice(1).every(t=>/^\d+ cols?$/.test(t)), fz);
  seg2[0].onclick();
  ok('Show restores it', w.eval('showDateCol')===true && $$('.dayband').length===0);
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
