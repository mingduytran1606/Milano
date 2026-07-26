// Double-click a table row -> the job panel, editable. The load-bearing rule: most of Jobs_Detail
// is formula columns (Job_ID, Stones, Inst_Dates, the qty rollups, Suburb/State/Postcode, Month,
// Client_Label). Writing one of those silently does nothing in Grist, so the panel must offer them
// read-only and never send them.
const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
const F=require('path').join(__dirname,'..','stone-calendar','index.html');
const HTML=fs.readFileSync(F,'utf8').replace(/<script src="https:\/\/[^"]*grist-plugin-api\.js"><\/script>/,'');
const errs=[]; const vc=new VirtualConsole(); vc.on('jsdomError',e=>errs.push(e.message));
const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc});
const w=dom.window,D=dom.window.document,s=w._stonecal;
const $$=q=>[...D.querySelectorAll(q)];
let FA=0,P=0;
const ok=(n,c,x)=>{ if(c){P++;console.log('  PASS  '+n);} else {FA++;console.log('  FAIL  '+n+(x!==undefined?'  -> '+JSON.stringify(x):''));} };

// Pretend we are live, with the real doc's split of writable vs formula columns, and capture writes.
w.eval(`
  state.grist=true;
  state.writableJob={Job_Address:1,Address_Formatted:1,Stage:1,Payment_Status:1,Assigned_To:1,
                     Meas_Date:1,Input_Date:1,Cash:1,Note:1,Client_Name:1};
  state.jobColType={Meas_Date:"Date",Input_Date:"Date"};
  state.jobChoices={ Stage:{choices:["Quote","Live","WIP","Completed"]},
                     Payment_Status:{choices:["Not Invoiced","Deposit Paid","Fully Paid"]},
                     Assigned_To:{choices:["Julie","Phoebe","Nhi"]} };
  state.clients=[{id:51,Client_Name:"Annie"},{id:52,Client_Name:"Home owner"},{id:53,Client_Name:"Harry Aboda"}];
  state.ref.client={targetTableId:"Client",labelCol:"Client_Name"};
  window.__acts=[];
  grist={ docApi:{ applyUserActions:a=>{ window.__acts.push(a); return Promise.resolve(); },
                   fetchTable:()=>Promise.resolve({}) } };
  refetch=()=>Promise.resolve();
  render();
`);
const acts=()=>w.eval('window.__acts');
const clearActs=()=>w.eval('window.__acts=[]');

console.log('== double-click a row opens the panel ==');
const row=$$('.strow')[0];
ok('rows carry a dblclick handler', typeof row.ondblclick==='function');
ok('panel starts closed', !D.getElementById('jobModal').classList.contains('open'));
row.ondblclick({target:row, preventDefault(){}, stopPropagation(){}});
ok('panel opens', D.getElementById('jobModal').classList.contains('open'));
const rid=Number(row.dataset.rid);
const job=w.eval('jobFor(state.stone.find(function(x){return x.id==='+rid+';}))');
ok('it is the job for that row', s.jobOpen===job.id, {open:s.jobOpen, want:job.id});
ok('titled with the job id', /Job/.test(D.getElementById('jobTab').textContent),
   D.getElementById('jobTab').textContent);
ok('names the client', D.querySelector('#jobBody .se-head').textContent.length>0,
   D.querySelector('#jobBody .se-head').textContent);

console.log('== a dblclick inside a cell editor is left alone ==');
{
  const inp=D.createElement('input'); row.appendChild(inp);
  D.getElementById('jobModal').classList.remove('open');
  row.ondblclick({target:inp, preventDefault(){}, stopPropagation(){}});
  ok('editor keeps the dblclick', !D.getElementById('jobModal').classList.contains('open'));
  row.removeChild(inp);
  row.ondblclick({target:row, preventDefault(){}, stopPropagation(){}});   // reopen for the rest
}

console.log('== formula columns are read-only, never written ==');
{
  const labs=$$('#jobBody .se-lab').map(e=>e.textContent);
  ok('editable fields are offered', labs.includes('Stage') && labs.includes('Payment')
     && labs.includes('Address') && labs.includes('Note'), labs);
  const ro=$$('#jobBody .jp-ro .k').map(e=>e.textContent);
  ok('calculated values appear in their own block', ro.length>0, ro);
  ok('Job ID is a read-out, not a field', !labs.includes('Job ID'), labs);
  // simulate the doc refusing: a column absent from writableJob must be disabled AND unsent
  w.eval('state.writableJob={Note:1}; openJobPanel(jobFor(state.stone.find(function(x){return x.id==='+rid+';})));');
  const disabled=$$('#jobBody .se-in').filter(e=>e.disabled).length;
  ok('non-writable fields are disabled', disabled>0, disabled);
  clearActs();
  const stage=$$('#jobBody select')[0];
  if(stage){ stage.value='Live'; if(stage.onchange) stage.onchange(); }
  ok('a disabled Stage sends nothing', acts().length===0, acts());
  // restore
  w.eval(`state.writableJob={Job_Address:1,Address_Formatted:1,Stage:1,Payment_Status:1,Assigned_To:1,
     Meas_Date:1,Input_Date:1,Cash:1,Note:1,Client_Name:1};
     openJobPanel(jobFor(state.stone.find(function(x){return x.id===${rid};})));`);
}

console.log('== editing writes back to Jobs_Detail ==');
{
  clearActs();
  const sel=$$('#jobBody select')[0];
  sel.value='Completed'; sel.onchange();
  const a=acts();
  ok('one action went out', a.length===1, a);
  ok('it is an UpdateRecord on Jobs_Detail',
     a[0] && a[0][0][0]==='UpdateRecord' && a[0][0][1]==='Jobs_Detail', a[0]);
  ok('it targets the job row', a[0] && a[0][0][2]===job.id, a[0]&&a[0][0][2]);
  ok('it sends only the edited column', a[0] && Object.keys(a[0][0][3]).join()==='Stage', a[0]&&a[0][0][3]);
  ok('with the chosen value', a[0] && a[0][0][3].Stage==='Completed', a[0]&&a[0][0][3]);
}

console.log('== text, date and note fields ==');
{
  clearActs();
  const ins=$$('#jobBody input.se-in');
  const addr=ins.find(e=>e.type==='text' && !e.getAttribute('list'));
  addr.value='12 Test St, Reservoir VIC 3073'; addr.onblur();
  ok('a text field writes its column', acts().length===1 &&
     Object.keys(acts()[0][0][3])[0]==='Job_Address', acts()[0]&&acts()[0][0][3]);
  clearActs();
  const dt=ins.find(e=>e.type==='date');
  dt.value='2026-08-14'; dt.onblur();
  const sent=acts()[0]&&acts()[0][0][3];
  const col=sent&&Object.keys(sent)[0];
  ok('a date field writes epoch seconds', typeof sent[col]==='number' && sent[col]>1e9, sent);
  ok('at UTC midnight', sent[col]%86400===0, sent[col]%86400);
  clearActs();
  const area=D.querySelector('#jobBody textarea');
  area.value='panel note'; area.onblur();
  ok('the note writes as text', acts().length===1 && acts()[0][0][3].Note==='panel note', acts()[0]);
  clearActs();
  area.onblur();
  ok('an unchanged field sends nothing', acts().length===0, acts());
  // changing a value and putting it back must still write: the comparison has to be against the
  // live value, not the one captured when the panel was drawn
  clearActs();
  const sel2=$$('#jobBody select')[0];
  const orig=sel2.value;
  sel2.value='Quote'; sel2.onchange();
  sel2.value=orig;    sel2.onchange();
  ok('changing a value and back again writes twice', acts().length===2,
     acts().map(a=>a[0][3]));
}

console.log('== assignees are a ChoiceList ==');
{
  clearActs();
  const chip=$$('#jobBody .se-chip')[0];
  ok('chips are rendered', !!chip, $$('#jobBody .se-chip').length);
  chip.onclick();
  const sent=acts()[0]&&acts()[0][0][3];
  ok('written in Grist ChoiceList form', sent && Array.isArray(sent.Assigned_To)
     && sent.Assigned_To[0]==='L', sent);
}

console.log('== the client is a ref, refused unless it is a real client ==');
{
  clearActs();
  const cli=$$('#jobBody input.se-in').find(e=>e.getAttribute('list'));
  ok('client field is a picker', !!cli && !!D.getElementById('dl-job-client'));
  cli.value='Someone Not On File'; cli.oninput(); cli.onblur();
  ok('an unknown client is refused', acts().length===0, acts());
  clearActs();
  cli.value='Harry Aboda'; cli.oninput(); cli.onblur();
  const sent=acts()[0]&&acts()[0][0][3];
  ok('a real client writes the ref as a row id',
     sent && typeof sent.Client_Name==='number' && sent.Client_Name===53, sent);
}

console.log('== the job stone orders are listed ==');
{
  const mine=w.eval('state.stone.filter(function(r){return refId(r.Job)==='+job.id+';}).length');
  ok('one line per stone order on the job', $$('#jobBody .jp-line').length===mine,
     {shown:$$('#jobBody .jp-line').length, expected:mine});
  ok('the row you came from is marked', $$('#jobBody .jp-line.here').length<=1,
     $$('#jobBody .jp-line.here').length);
}

console.log('== closing ==');
{
  D.getElementById('jobClose').onclick();
  ok('close button shuts it', !D.getElementById('jobModal').classList.contains('open'));
  ok('and clears the open job', s.jobOpen===null, s.jobOpen);
  row.ondblclick({target:row, preventDefault(){}, stopPropagation(){}});
  D.getElementById('jobModal').onclick({target:{id:'jobModal'}});
  ok('backdrop click shuts it', !D.getElementById('jobModal').classList.contains('open'));
}

ok('no jsdom errors', errs.length===0, errs);
console.log((FA?('FAILED '+FA+' of '+(FA+P)):'ALL PASS')+'  ('+P+' passed)');
process.exit(FA?1:0);
