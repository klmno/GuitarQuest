// Loads the app's classic scripts into Node with a minimal browser shim.
const fs = require('fs'), path = require('path'), vm = require('vm');
const mem = {};
global.window = globalThis;
global.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
function load(...files) {
  for (const f of files) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), { filename: f + '.js' });
  return globalThis.GQ;
}
module.exports = { load };
