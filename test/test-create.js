// Headless exercise of the stone-calendar create path (demo mode, no Grist).
// `edit` is a top-level `let`, so it lives in the global lexical scope, not on window:
// everything that touches it goes through window.eval().
const fs = require('fs');
const { JSDOM } = require('jsdom');

const file = process.argv[2] || require('path').join(__dirname,'..','stone-calendar','index.html');
let html = fs.readFileSync(file, 'utf8');
html = html.replace(/<script src="https:\/\/[^"]*grist-plugin-api\.js"><\/script>/, '');

const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window;
const s = w._stonecal;
const ev = expr => w.eval(expr);
const $$ = sel => [...w.document.querySelectorAll(sel)];

let fails = 0, passes = 0;
const ok = (name, cond, extra) => {
  if (cond) { passes++; console.log('  PASS  ' + name); }
  else { fails++; console.log('  FAIL  ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
};
const sec = t => console.log('\n== ' + t + ' ==');

(async () => {
  sec('boot (demo mode)');
  ok('state exists', !!s);
  ok('not live grist', s.grist === false);
  ok('sample rows loaded', s.stone.length === 7, s.stone.length);
  ok('sample clients loaded', s.clients.length === 5, s.clients.length);
  ok('demo client ref resolved', s.ref.client && s.ref.client.targetTableId === 'Client', s.ref.client);
  ok('table rows rendered', $$('.strow').length > 0, $$('.strow').length);
  ok('rows carry data-rid', !!w.document.querySelector('.strow[data-rid]'));

  const stone0 = s.stone.length, jobs0 = s.jobs.length, clients0 = s.clients.length;

  sec('new order on an EXISTING job');
  w.openNew(null);
  ok('panel opened', w.document.getElementById('editModal').classList.contains('open'));
  ok('defaults to existing-job mode', ev('edit.jobMode') === 'existing', ev('edit.jobMode'));
  ok('order date pre-filled', /^\d{4}-\d{2}-\d{2}$/.test(ev('edit.cur.Order_Date')), ev('edit.cur.Order_Date'));
  ok('blocked without job+stone', w.newBlockers().length > 0, w.newBlockers());
  ev('edit.job=8; edit.product=101; edit.cur.Scope_Qty="3";');
  ok('unblocked once both picked', w.newBlockers().length === 0, w.newBlockers());

  const f1 = w.newFields(8);
  ok('writes Job ref as row id', f1.Job === 8, f1.Job);
  ok('writes Product ref as row id', f1.Product === 101, f1.Product);
  ok('does NOT write Stone when Product is set', !('Stone' in f1), Object.keys(f1));
  ok('does NOT write Product_Code', !('Product_Code' in f1), Object.keys(f1));
  ok('does NOT write Product_Supplier', !('Product_Supplier' in f1), Object.keys(f1));
  ok('Order_Date is epoch seconds', typeof f1.Order_Date === 'number', f1.Order_Date);
  ok('Scope_Qty coerced to number', f1.Scope_Qty === 3, f1.Scope_Qty);

  sec('create it');
  await w.saveEdit();
  ok('one Stone_Order row added', s.stone.length === stone0 + 1, s.stone.length);
  ok('no job created (existing job)', s.jobs.length === jobs0, s.jobs.length);
  const c1 = s.stone[s.stone.length - 1];
  ok('created row leaves Stone blank', !c1.Stone, c1.Stone);
  ok('flashId points at the new row', s.flashId === c1.id, { flashId: s.flashId, id: c1.id });
  ok('panel closed', !w.document.getElementById('editModal').classList.contains('open'));
  ok('edit state reset', ev('edit.mode') === 'edit' && ev('edit.jobMode') === 'existing');

  sec('new order creating a NEW job + NEW client');
  w.openNew(null);
  const seg = $$('.se-seg button');
  ok('mode switch rendered', seg.length === 2, seg.map(b => b.textContent));
  seg[1].onclick();
  ok('switched to new-job mode', ev('edit.jobMode') === 'new', ev('edit.jobMode'));
  ok('customer field rendered', $$('.se-grid input').length >= 2, $$('.se-grid input').length);
  ok('assignee chips rendered', $$('.se-chip').length > 0, $$('.se-chip').length);
  ok('blocked with no customer/address', w.newBlockers().some(m => /customer/.test(m)), w.newBlockers());

  ev('edit.clientName="Brand New Customer"; edit.address="5 Test St, Melbourne VIC 3000";'
     + ' edit.product=102; edit.assignees=["Minh"];');
  ok('unblocked', w.newBlockers().length === 0, w.newBlockers());

  await w.saveEdit();
  ok('client row added', s.clients.length === clients0 + 1, s.clients.length);
  ok('job row added', s.jobs.length === jobs0 + 1, s.jobs.length);
  ok('stone row added', s.stone.length === stone0 + 2, s.stone.length);
  const nc = s.clients[s.clients.length - 1], nj = s.jobs[s.jobs.length - 1], ns = s.stone[s.stone.length - 1];
  ok('client named correctly', nc.Client_Name === 'Brand New Customer', nc);
  ok('job links to the new client', nj.Client_Name === nc.id, { job: nj.Client_Name, client: nc.id });
  ok('Stage left to the doc trigger', !('Stage' in nj), Object.keys(nj));
  ok('job address set', nj.Job_Address === '5 Test St, Melbourne VIC 3000', nj.Job_Address);
  ok('assignees ChoiceList-encoded ["L",...]',
     Array.isArray(nj.Assigned_To) && nj.Assigned_To[0] === 'L' && nj.Assigned_To[1] === 'Minh', nj.Assigned_To);
  ok('order links to the new job', ns.Job === nj.id, { order: ns.Job, job: nj.id });
  ok('order leaves Stone blank', !ns.Stone, ns.Stone);

  sec('reusing an EXISTING client by name (different case)');
  const clientsNow = s.clients.length;
  w.openNew(null);
  $$('.se-seg button')[1].onclick();
  ev('edit.clientName="annie"; edit.product=103;');
  await w.saveEdit();
  ok('no duplicate client created', s.clients.length === clientsNow, s.clients.length);
  const j2 = s.jobs[s.jobs.length - 1];
  ok('job reused Annie (id 51)', j2.Client_Name === 51, j2.Client_Name);
  ok('name not misused as the address', !j2.Job_Address, j2.Job_Address);

  sec('the created chip is highlighted');
  const fid = s.flashId;
  ok('flashId set', fid != null, fid);
  const chip = w.document.querySelector('.strow[data-rid="' + fid + '"]');
  ok('row exists in the DOM for flashId', !!chip, $$('.strow[data-rid]').map(e => e.getAttribute('data-rid')));
  ok('row carries ev-new', !!chip && chip.classList.contains('ev-new'));

  sec('regression: plain edit of an existing row still works');
  const target = s.stone[0];
  w.openEdit(target);
  ev('edit.cur.Delivery_Qty="1";');
  const u = w.editUpdate();
  ok('only the changed column is written', JSON.stringify(Object.keys(u.fields)) === '["Delivery_Qty"]', u);
  await w.saveEdit();
  ok('value applied', s.stone.find(r => r.id === target.id).Delivery_Qty === 1,
     s.stone.find(r => r.id === target.id).Delivery_Qty);

  console.log('\n' + (fails ? 'FAILURES: ' + fails : 'ALL PASS') + '  (' + passes + ' passed)');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('\nTHREW:', (e && e.stack) || e); process.exit(2); });
