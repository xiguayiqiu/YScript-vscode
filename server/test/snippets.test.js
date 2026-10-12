const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const snippets = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../snippets/yscript.json'), 'utf8'),
);

test('snippet prefixes are unique and every snippet has an insertion body', () => {
  const prefixes = new Set();
  for (const [name, snippet] of Object.entries(snippets)) {
    assert.ok(snippet.prefix, `${name} is missing a prefix`);
    assert.ok(snippet.body, `${name} is missing a body`);
    for (const prefix of Array.isArray(snippet.prefix) ? snippet.prefix : [snippet.prefix]) {
      assert.ok(!prefixes.has(prefix), `duplicate snippet prefix: ${prefix}`);
      prefixes.add(prefix);
    }
  }
});

test('common shortcuts are registered', () => {
  const prefixes = new Set(Object.values(snippets).flatMap(({ prefix }) =>
    Array.isArray(prefix) ? prefix : [prefix],
  ));
  for (const prefix of [
    'main', 'fori', 'forc', 'fore', 'ret', 'retn', 'pln',
    'ifnil', 'iferr', 'raise', 'catchmatch', 'deferclose',
  ]) {
    assert.ok(prefixes.has(prefix), `missing snippet: ${prefix}`);
  }
});
