'use strict';
// Entry point so `node --test apple/WebTests/` works: Node 22 resolves a
// directory argument as a module (this index.js) rather than scanning it.
// `node --test 'apple/WebTests/*.test.js'` runs the same files directly.
const fs = require('node:fs');
const path = require('node:path');
for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort()) {
  require(path.join(__dirname, f));
}
