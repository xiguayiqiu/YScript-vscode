const assert = require('node:assert/strict');
const test = require('node:test');
const { tokenize } = require('../src/lexer.js');
const { syntaxDiagnostics, unusedVariableDiagnostics } = require('../src/syntax.js');

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

test('unused local variables produce warning diagnostics without ysc', () => {
  const source = `package main
func main() {
    let unused = "unused"
    assigned <- 1
    assigned = 2
    let used <- "used"
    println(used)
    # ignoredInComment
    println("ignoredInString")
}
`;
  const diagnostics = unusedVariableDiagnostics(tokenize(source));
  assert.deepEqual(diagnostics.map((item) => item.message), ['变量 "unused" 已声明但未使用', '变量 "assigned" 已声明但未使用']);
  assert.ok(diagnostics.every((item) => item.severity === 'warning'));
});

test('unused-variable diagnostics inspect every name in a multi-variable declaration', () => {
  const source = `package main
func main() {
    let first,second = 1,2
    println(first)
}
`;
  const diagnostics = unusedVariableDiagnostics(tokenize(source));
  assert.deepEqual(diagnostics.map((item) => item.message), ['变量 "second" 已声明但未使用']);
});

test('references in other functions do not count as local variable usage', () => {
  const source = `package main
func main() {
    let local = 1
}
func helper() {
    println(local)
}
`;
  const diagnostics = unusedVariableDiagnostics(tokenize(source));
  assert.deepEqual(diagnostics.map((item) => item.message), ['变量 "local" 已声明但未使用']);
});
