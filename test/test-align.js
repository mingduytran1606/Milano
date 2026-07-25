const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
const F = require('path').join(__dirname,'..','stone-calendar','index.html');
const HTML=fs.readFileSync(F,'utf8').replace(/<script src="https:\/\/[^"]*grist-plugin-api\.js"><\/script>/,'');
const errs=[]; const vc=new VirtualConsole(); vc.on('jsdomError',e=>errs.push(e.message));
const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc});
const w=dom.window,D=w.document;
const $$=q=>[...D.querySelectorAll(q)];
const cs=el=>w.getComputedStyle(el);
let F2=0,P=0;
const ok=(n,c,x)=>{ if(c){P++;console.log('  PASS  '+n);} else {F2++;console.log('  FAIL  '+n+(x!==undefined?'  -> '+JSON.stringify(x):''));} };
const css=[...D.styleSheets[0].cssRules].map(r=>r.cssText).join('\n');

console.log('== the day band really is a grid (this is what was broken) ==');
const day=$$('.ag-day.tbl')[0];
ok('a .tbl day band exists', !!day);
ok('rule .ag-day.tbl is in the stylesheet', /\.ag-day\.tbl\s*\{/.test(css));
ok('computed display is grid', cs(day).display==='grid', cs(day).display);
ok('chip-era padding is zeroed', cs(day).padding==='0px'||cs(day).paddingLeft==='0px',
   {padding:cs(day).padding, left:cs(day).paddingLeft});
// jsdom versions disagree on whether zero serialises as "0" or "0px", so compare values
const zero=v=>v===''||v==='normal'||parseFloat(v)===0;
ok('chip-era gap is zeroed', zero(cs(day).gap)&&zero(cs(day).columnGap),
   {gap:cs(day).gap, col:cs(day).columnGap});

console.log('== header and rows sit on the same first track ==');
const head=D.querySelector('.sthead');
ok('header is a grid', cs(head).display==='grid');
ok('header and day band share grid-template-columns',
   cs(head).gridTemplateColumns===cs(day).gridTemplateColumns,
   {head:cs(head).gridTemplateColumns, day:cs(day).gridTemplateColumns});
ok('both reference the same --datecol token',
   /var\(--datecol\)/.test(cs(head).gridTemplateColumns||'') || /--datecol/.test(css),
   cs(head).gridTemplateColumns);
ok('--datecol is defined once, not a fallback', /--datecol:\s*200px/.test(css)
   && !/var\(--datecol,\s*200px\)/.test(css), {defined:/--datecol:\s*200px/.test(css),
   fallbackStillUsed:/var\(--datecol,\s*200px\)/.test(css)});

console.log('== the inner column template matches between header and rows ==');
const hcols=D.querySelector('.sthead .stcols');
const row=$$('.strow')[0];
ok('header inner grid template equals a row template',
   hcols.style.gridTemplateColumns===row.style.gridTemplateColumns,
   {head:hcols.style.gridTemplateColumns, row:row.style.gridTemplateColumns});
ok('totals row matches too', $$('.stsum')[0].style.gridTemplateColumns===row.style.gridTemplateColumns);
ok('every row identical', new Set($$('.strow').map(r=>r.style.gridTemplateColumns)).size===1);

console.log('== columns now stretch instead of leaving dead space ==');
const tpl=row.style.gridTemplateColumns;
ok('uses minmax so columns can grow', /minmax\(\d+px,\s*\d+fr\)/.test(tpl), tpl);
ok('no fixed dead filler track', !/minmax\(0px?,\s*1fr\)/.test(tpl), tpl);
ok('trailing track for the handle', /\s26px$/.test(tpl), tpl.slice(-24));
ok('one track per column plus the handle',
   tpl.trim().split(/\s+(?=minmax|\d+px$)/).length===w.eval('tblCols.length')+1,
   {tracks:tpl.trim().split(/\s+(?=minmax|\d+px$)/).length, cols:w.eval('tblCols.length')});
// jsdom re-serialises rules with spaces after ':' and around '>', so match loosely
ok('agenda can scroll sideways if it still cannot fit',
   /\.agenda\s*\{[^}]*overflow-x:\s*auto/.test(css));

console.log('== the date column is banded ==');
ok('row date cell has the panel-contrast background',
   /\.ag-day\.tbl\s*>\s*\.ag-date\s*\{[^}]*background:\s*var\(--bg\)/.test(css));
ok('header date cell banded to match',
   /\.sthead\s*>\s*\.stlab:first-child\s*\{[^}]*background:\s*var\(--bg\)/.test(css));
ok('vertical divider stays a hairline: the banding already separates that column',
   (css.match(/border-right:\s*1px solid var\(--line\)/g)||[]).length>=2,
   (css.match(/border-right:[^;}]*/g)||[]).slice(0,4));
ok('the day boundary is what carries the strong rule',
   /\.ag-day\.tbl\s*\{[^}]*border-bottom:\s*2px solid var\(--rule\)/.test(css));
ok('no rule dangling under the last day',
   /\.ag-day\.tbl:last-child\s*\{[^}]*border-bottom:\s*0/.test(css));
ok('row separators within a day stay light, so the boundary reads as the heavier line',
   /\.strow\s*\{[^}]*border-bottom:\s*1px solid var\(--line2\)/.test(css));
ok('the rule has its own token', /--rule:\s*#/.test(css));
ok('the token is defined for both themes',
   (css.match(/--rule:\s*#[0-9a-f]{6}/gi)||[]).length>=2,
   (css.match(/--rule:\s*#[0-9a-f]{6}/gi)||[]));
const lum=h=>{ const n=parseInt(h.replace('#',''),16);
  return ((n>>16)&255)*0.299+((n>>8)&255)*0.587+(n&255)*0.114; };
ok('light rule is much darker than the hairline it replaced',
   lum('#94a0ad') < lum('#e2e5ea')-40, {rule:Math.round(lum('#94a0ad')), line:Math.round(lum('#e2e5ea'))});
ok('but nowhere near black', lum('#94a0ad') > 90, Math.round(lum('#94a0ad')));
ok('dark theme goes lighter instead, since a darker rule would vanish',
   lum('#5b6878') > lum('#2a323b'), {rule:Math.round(lum('#5b6878')), line:Math.round(lum('#2a323b'))});
ok('today keeps its accent tint',
   /\.ag-day\.tbl\.today\s*>\s*\.ag-date\s*\{[^}]*accent-soft/.test(css));

console.log('== nothing broke ==');
ok('no jsdom errors', errs.length===0, errs.slice(0,2));
ok('rows still render', $$('.strow').length>0, $$('.strow').length);
ok('supplier box still inside the date cell', $$('.ag-date > .supbox').length>0);
console.log('\n'+(F2?'FAILURES: '+F2:'ALL PASS')+'  ('+P+' passed)');
process.exit(F2?1:0);
