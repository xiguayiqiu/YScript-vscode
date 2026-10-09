const assert = require('node:assert/strict');
const test = require('node:test');
const { tokenize } = require('../src/lexer.js');
const { syntaxDiagnostics } = require('../src/syntax.js');

test('package main declaration does not require an entry point in every file', () => {
  const source = `package main

func Fetch(url) {
    return url
}
`;
  assert.deepEqual(syntaxDiagnostics(tokenize(source)), []);
});

test('package declarations continue to constrain func main', () => {
  const source = `package library

func main() {}
`;
  const diagnostics = syntaxDiagnostics(tokenize(source));
  assert.ok(diagnostics.some((item) => item.message === 'func main() 只能在 package main 下声明'));
});

test('named documentation annotations are ignored by syntax diagnostics', () => {
  const source = `@banner_text HEAD
# Converts service banner bytes to readable text.
@ banner_text END

package main

func banner_text(data) {
    return string(data)
}
`;
  const tokens = tokenize(source);
  assert.ok(tokens.some((token) => token.type === 'comment' && token.value.includes('banner_text HEAD')));
  assert.deepEqual(syntaxDiagnostics(tokens), []);
});
