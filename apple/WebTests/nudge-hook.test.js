// Regression for task 5024: app.js nudgeAfterSave() recursed forever when nudge.js was
// absent (iOS bundle), because the global function declaration IS window.nudgeAfterSave.
// Run:  node --test apple/WebTests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '../../app.js'), 'utf8');
// The hook lives in the last line of app.js; extract it and the installer block marker.
const line = src.split('\n').find(l => l.startsWith('function nudgeAfterSave'));

function ctx() { const c = { }; c.window = c; return vm.createContext(c); }

test('nudgeAfterSave found in app.js', () => { assert.ok(line); });

test('nudge.js absent: nudgeAfterSave returns without recursing', () => {
  const c = ctx();
  vm.runInContext(line, c);
  assert.doesNotThrow(() => vm.runInContext('nudgeAfterSave()', c));
});

test('nudge.js present: the installed hook is called once', () => {
  const c = ctx();
  vm.runInContext(line, c);
  let n = 0; c.tankmateNudgeSaved = () => { n++; };
  vm.runInContext('nudgeAfterSave()', c);
  assert.equal(n, 1);
});
