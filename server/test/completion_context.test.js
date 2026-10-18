const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

/**
 * 覆盖「代码提示强化」能力：
 * 类型上下文（注解/参数/->/new/extends/is）、带类型参数的成员补全、
 * 字符串插值补全、作用域感知与子串匹配、继承方法补全。
 */
function startServer(t) {
  const serverPath = path.resolve(__dirname, '../out/server.js');
  const server = spawn(process.execPath, [serverPath, '--stdio'], { stdio: ['pipe', 'pipe', 'pipe'] });
  t.after(() => server.kill());

  let buffer = Buffer.alloc(0);
  let nextId = 1;
  let stderr = '';
  const pending = new Map();

  server.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  server.stdout.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) break;
      const length = Number(/Content-Length: (\d+)/i.exec(buffer.subarray(0, headerEnd).toString())?.[1]);
      if (!Number.isFinite(length) || buffer.length < headerEnd + 4 + length) break;
      const message = JSON.parse(buffer.subarray(headerEnd + 4, headerEnd + 4 + length).toString());
      buffer = buffer.subarray(headerEnd + 4 + length);
      const waiter = pending.get(message.id);
      if (waiter) {
        pending.delete(message.id);
        clearTimeout(waiter.timer);
        waiter.resolve(message);
      }
    }
  });

  const send = (message) => {
    const body = Buffer.from(JSON.stringify(message));
    server.stdin.write(Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body]));
  };
  const request = (method, params) => {
    const id = nextId++;
    send({ jsonrpc: '2.0', id, method, params });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timed out waiting for ${method}: ${stderr}`));
      }, 5000);
      pending.set(id, { resolve, timer });
    });
  };
  const notify = (method, params) => send({ jsonrpc: '2.0', method, params });
  const open = (uri, text) => notify('textDocument/didOpen', {
    textDocument: { uri, languageId: 'yscript', version: 1, text },
  });
  const completion = async (uri, line, character, trigger) => {
    const response = await request('textDocument/completion', {
      textDocument: { uri },
      position: { line, character },
      context: trigger
        ? { triggerKind: 2, triggerCharacter: trigger }
        : { triggerKind: 1 },
    });
    return response.result ?? [];
  };

  return { server, send, request, notify, open, completion };
}

async function initialize(client, rootUri) {
  await client.request('initialize', {
    processId: process.pid,
    rootUri,
    capabilities: {},
  });
  client.notify('initialized', {});
}

const uriFor = (name) => `file:///tmp/yscript-context/${name}.ys`;

test('variable type annotations suggest types and user structs only', async (t) => {
  const client = startServer(t);
  const uri = uriFor('annotation');
  await initialize(client, 'file:///tmp/yscript-context');
  const source = `package main

struct Point {
    x: int
}

func main() {
    let p: 
}
`;
  client.open(uri, source);

  const items = await client.completion(uri, 7, '    let p: '.length, ':');
  const labels = new Set(items.map((item) => item.label));
  for (const expected of ['int', 'string', 'list', 'Point']) {
    assert.ok(labels.has(expected), `missing type ${expected}: ${[...labels].join(', ')}`);
  }
  assert.ok(!labels.has('print'), 'functions should not appear in type position');
  assert.ok(!labels.has('let'), 'keywords should not appear in type position');
  assert.ok(!labels.has('io.read_file'), 'namespace functions should not appear in type position');
});

test('return type after -> suggests types, structs and void', async (t) => {
  const client = startServer(t);
  const uri = uriFor('return_type');
  await initialize(client, 'file:///tmp/yscript-context');
  const source = `package main

struct Point {
    x: int
}

func make() -> 
`;
  client.open(uri, source);

  const items = await client.completion(uri, 6, 'func make() -> '.length, ' ');
  const labels = new Set(items.map((item) => item.label));
  for (const expected of ['int', 'string', 'Point', 'void']) {
    assert.ok(labels.has(expected), `missing ${expected}: ${[...labels].join(', ')}`);
  }
  assert.ok(!labels.has('println'));
});

test('parameter type after colon and struct field type after colon', async (t) => {
  const client = startServer(t);
  const uri = uriFor('param_type');
  await initialize(client, 'file:///tmp/yscript-context');
  const source = `package main

struct Config {
    retries: 
}

func send(name: ) {
}
`;
  client.open(uri, source);

  const fieldItems = await client.completion(uri, 3, '    retries: '.length, ':');
  assert.ok(new Set(fieldItems.map((i) => i.label)).has('int'), 'struct field type should complete');

  const paramItems = await client.completion(uri, 6, 'func send(name: )'.length - 1, ':');
  const paramLabels = new Set(paramItems.map((i) => i.label));
  assert.ok(paramLabels.has('string'), `param type missing: ${[...paramLabels].join(', ')}`);
  assert.ok(!paramLabels.has('println'));
});

test('new and extends suggest struct names', async (t) => {
  const client = startServer(t);
  const uri = uriFor('new_extends');
  await initialize(client, 'file:///tmp/yscript-context');
  const source = `package main

struct Animal {
    name: string
}

struct Dog extends 
`;
  client.open(uri, source);

  const extendsItems = await client.completion(uri, 6, 'struct Dog extends '.length, ' ');
  const extendsLabels = new Set(extendsItems.map((i) => i.label));
  assert.ok(extendsLabels.has('Animal'), `extends should offer Animal: ${[...extendsLabels].join(', ')}`);
  assert.ok(!extendsLabels.has('int'), 'extends should not offer builtin types');

  const newSource = `package main

struct Point {
    x: int
}

func main() {
    let p = new 
}
`;
  client.open(uri, newSource);
  const newItems = await client.completion(uri, 7, '    let p = new '.length, ' ');
  const newLabels = new Set(newItems.map((i) => i.label));
  assert.ok(newLabels.has('Point'), `new should offer Point: ${[...newLabels].join(', ')}`);
});

test('typed parameters resolve members like annotated variables', async (t) => {
  const client = startServer(t);
  const uri = uriFor('typed_param');
  await initialize(client, 'file:///tmp/yscript-context');
  const source = `package main

func greet(s: string) {
    s.
}
`;
  client.open(uri, source);

  const items = await client.completion(uri, 3, '    s.'.length, '.');
  const labels = new Set(items.map((item) => item.label));
  assert.ok(labels.has('split'), `string method missing: ${[...labels].join(', ')}`);
  assert.ok(labels.has('upper'));
  assert.ok(!labels.has('lock'), 'unrelated type members should be filtered out');
});

test('string interpolation completes visible variables', async (t) => {
  const client = startServer(t);
  const uri = uriFor('interpolation');
  await initialize(client, 'file:///tmp/yscript-context');
  const source = `package main

func main() {
    let user = "bob"
    println("hi \${us")
}
`;
  client.open(uri, source);

  const items = await client.completion(uri, 4, '    println("hi ${us'.length, 's');
  const labels = new Set(items.map((item) => item.label));
  assert.ok(labels.has('user'), `variable missing in interpolation: ${[...labels].join(', ')}`);
  const user = items.find((item) => item.label === 'user');
  assert.match(user.detail || '', /user/);
});

test('scope-aware variables hide locals of other functions and later declarations', async (t) => {
  const client = startServer(t);
  const uri = uriFor('scope');
  await initialize(client, 'file:///tmp/yscript-context');
  const source = `package main

let globalv = 1

func other() {
    let hidden = 2
}

func main() {
    let visible = 3
    println(visible)
}
`;
  client.open(uri, source);

  const items = await client.completion(uri, 11, '    println(visible)'.length, 'n');
  const labels = new Set(items.map((item) => item.label));
  assert.ok(labels.has('visible'), 'own local variable should be suggested');
  assert.ok(labels.has('globalv'), 'top-level variable should be suggested');
  assert.ok(!labels.has('hidden'), 'locals of other functions must not leak');
  const visible = items.find((item) => item.label === 'visible');
  assert.ok(visible.sortText?.startsWith('0000'), 'user symbols should rank before builtins');

  // 声明之前不可见
  const laterSource = `package main

func main() {
    println(later)
    let later = 4
}
`;
  client.open(uri, laterSource);
  const laterItems = await client.completion(uri, 3, '    println(later)'.length, 'n');
  assert.ok(!new Set(laterItems.map((i) => i.label)).has('later'), 'variables declared later must not be suggested');
});

test('substring matching surfaces io.read_file for prefix file', async (t) => {
  const client = startServer(t);
  const uri = uriFor('substring');
  await initialize(client, 'file:///tmp/yscript-context');
  const source = `package main

func main() {
    io.read_file("x")
}
`;
  client.open(uri, source);

  const items = await client.completion(uri, 3, '    io.read_file("x")'.length, 'e');
  const labels = new Set(items.map((item) => item.label));
  assert.ok(labels.has('io.read_file'), `substring match missing: ${[...labels].filter((l) => l.includes('file')).join(', ')}`);
});

test('inherited methods complete on subclass receivers', async (t) => {
  const client = startServer(t);
  const uri = uriFor('inherit');
  await initialize(client, 'file:///tmp/yscript-context');
  const source = `package main

struct Animal {
    name: string
}

func this.speak() {
    println("...")
}

struct Dog extends Animal {
    age: int
}

func main() {
    let d = Dog{name: "a", age: 1}
    d.
}
`;
  client.open(uri, source);

  const items = await client.completion(uri, 16, '    d.'.length, '.');
  const labels = new Set(items.map((item) => item.label));
  assert.ok(labels.has('speak'), `inherited method missing: ${[...labels].join(', ')}`);
  assert.ok(labels.has('name'), 'inherited field missing');
  assert.ok(labels.has('age'), 'own field missing');
});
