// Runs the Node tests (no install needed). The browser test needs Playwright: see README.
const { execFileSync } = require('child_process');
let failed = 0;
for (const t of ['notes', 'chords', 'overlap', 'chords-overlap', 'curriculum', 'steps', 'abc']) {
  try { process.stdout.write(execFileSync(process.execPath, [__dirname + '/' + t + '.test.js']).toString()); }
  catch (e) { failed++; process.stdout.write((e.stdout || '').toString()); console.log('FAILED: ' + t); }
}
console.log(failed ? failed + ' test file(s) failed' : 'all Node tests passed');
process.exitCode = failed ? 1 : 0;
