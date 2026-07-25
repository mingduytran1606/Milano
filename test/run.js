// Runs every suite in this folder and reports a single result.
//   npm install   (once, for jsdom)
//   npm test
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const suites = fs.readdirSync(__dirname)
  .filter(f => f.startsWith('test-') && f.endsWith('.js'))
  .sort();

let failed = 0, total = 0;
for (const s of suites) {
  let out = '', code = 0;
  try {
    out = execFileSync(process.execPath, [path.join(__dirname, s)], { encoding: 'utf8' });
  } catch (e) {
    out = (e.stdout || '') + (e.stderr || '');
    code = e.status || 1;
  }
  const last = out.trim().split('\n').pop().trim();
  const n = /\((\d+) passed\)/.exec(last);
  if (n) total += Number(n[1]);
  if (code) failed++;
  console.log((code ? 'FAIL  ' : 'ok    ') + s.padEnd(24) + last);
  if (code) console.log(out.split('\n').filter(l => /FAIL|THREW|Error/.test(l)).join('\n'));
}
console.log('\n' + (failed ? failed + ' suite(s) failed' : 'all ' + suites.length + ' suites passed')
  + '  (' + total + ' assertions)');
process.exit(failed ? 1 : 0);
