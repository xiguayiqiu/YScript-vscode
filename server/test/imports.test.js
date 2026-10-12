const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  buildImportEdit,
  findUnimportedUses,
  moduleForNamespace,
  parseImports,
} = require('../src/imports.js');
const {
  isStdModule,
  MODULE_CANONICAL,
  MODULE_NAMESPACE,
  NAMESPACE_MODULE,
  NS_MEMBERS,
} = require('../src/ns_members.js');

test('finds missing standard-library imports from namespace members', () => {
  const source = `package main

func main() {
    binary.ReadFile("input")
}`;

  assert.deepEqual(findUnimportedUses(source, parseImports(source)), [
    { ns: 'binary', module: 'binary', line: 3, character: 4, endCharacter: 10 },
  ]);
});

test('does not request imports for already imported or shadowed namespaces', () => {
  const imported = `import ["binary"]
binary.ReadFile("input")`;
  const shadowed = `let binary = 1
binary.ReadFile("input")`;

  assert.deepEqual(findUnimportedUses(imported, parseImports(imported)), []);
  assert.deepEqual(findUnimportedUses(shadowed, parseImports(shadowed)), []);
});

test('recognizes ffi as a standard-library module and namespace', () => {
  const source = `import ["ffi"]
ffi.open("libexample.so")`;
  const info = parseImports(source);

  assert.deepEqual([...info.modules], ['ffi']);
  assert.deepEqual([...info.namespaces], ['ffi']);
  assert.deepEqual([...info.projectPaths], []);
  assert.deepEqual(findUnimportedUses(source, info), []);
});

test('detects ffi namespace use when its module is not imported', () => {
  const source = 'ffi.open("libexample.so")';

  assert.deepEqual(findUnimportedUses(source, parseImports(source)), [
    { ns: 'ffi', module: 'ffi', line: 0, character: 0, endCharacter: 3 },
  ]);
});

test('indexes every runtime standard-library module, namespace, and alias', () => {
  const catalogPath = path.resolve(__dirname, '../../../yscript/internal/std/catalog/catalog.go');
  const catalog = fs.readFileSync(catalogPath, 'utf8');
  const modulePattern = /\{Name:\s*"([^"]+)",\s*Namespace:\s*"([^"]+)"(?:,\s*Aliases:\s*\[\]string\{([^}]*)\})?/g;
  const modules = [...catalog.matchAll(modulePattern)];
  assert.ok(modules.length > 0);
  const moduleNames = [];
  const aliases = [];
  const namespaces = [];

  for (const [, name, namespace, aliasText = ''] of modules) {
    moduleNames.push(name);
    namespaces.push(namespace);
    assert.ok(NS_MEMBERS[namespace], `missing namespace member index for ${namespace}`);
    assert.equal(MODULE_NAMESPACE[name], namespace, `wrong namespace for module ${name}`);
    assert.equal(MODULE_CANONICAL[name], name, `wrong canonical name for module ${name}`);
    assert.equal(NAMESPACE_MODULE[namespace], name, `wrong import hint for namespace ${namespace}`);
    assert.ok(isStdModule(name), `module ${name} is not recognized`);
    assert.equal(moduleForNamespace(namespace), name);

    const info = parseImports(`import ["${name.toUpperCase()}"]\n${namespace}.`);
    assert.deepEqual([...info.modules], [name]);
    assert.deepEqual([...info.namespaces], [namespace]);
    assert.deepEqual([...info.projectPaths], []);

    for (const [, alias] of aliasText.matchAll(/"([^"]+)"/g)) {
      aliases.push(alias);
      assert.equal(MODULE_NAMESPACE[alias], namespace, `wrong namespace for alias ${alias}`);
      assert.equal(MODULE_CANONICAL[alias], name, `wrong canonical name for alias ${alias}`);
      assert.ok(isStdModule(alias), `alias ${alias} is not recognized`);

      const aliasInfo = parseImports(`import ["${alias.toUpperCase()}"]\n${namespace}.`);
      assert.deepEqual([...aliasInfo.modules], [name]);
      assert.deepEqual([...aliasInfo.namespaces], [namespace]);
      assert.deepEqual([...aliasInfo.projectPaths], []);
    }
  }

  assert.deepEqual(
    Object.keys(NS_MEMBERS).filter((namespace) => !namespace.includes('.')).sort(),
    [...new Set(namespaces)].sort(),
    'namespace member index differs from runtime catalog',
  );
  assert.deepEqual(
    Object.keys(NAMESPACE_MODULE).sort(),
    [...new Set(namespaces)].sort(),
    'namespace import hints differ from runtime catalog',
  );
  assert.deepEqual(
    Object.keys(MODULE_NAMESPACE).sort(),
    [...moduleNames, ...aliases].sort(),
    'module name index differs from runtime catalog',
  );
});

test('parses a multiline import list with the opening bracket on the next line', () => {
  const source = `package main
import
[
    "binary",
    "string",
]
`;
  const info = parseImports(source);

  assert.deepEqual([...info.modules], ['binary', 'string']);
  assert.deepEqual([...info.namespaces], ['binary', 'strings']);
  assert.equal(info.lastImportLine, 5);
});

test('adds missing modules without collapsing a multiline import list', () => {
  const source = `package main
import
[
    "binary",
]
`;
  const edits = buildImportEdit(source, parseImports(source), ['io']);

  assert.deepEqual(edits, [{
    range: {
      start: { line: 3, character: 13 },
      end: { line: 3, character: 13 },
    },
    newText: '\n    "io"',
  }]);
});

test('builds a single edit for all missing standard-library imports', () => {
  const source = 'package main\n';
  const info = parseImports(source);
  const edits = buildImportEdit(source, info, ['binary', 'io', 'binary']);

  assert.equal(edits.length, 1);
  assert.equal(edits[0].newText, 'import ["binary", "io"]\n');
});
