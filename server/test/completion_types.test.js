const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');

/**
 * 启动 LSP 服务器并提供一个简单的请求封装，覆盖结构体/枚举/类型推断与
 * import 路径补全等「代码提示」能力。
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
  const completion = async (uri, line, character, trigger = '.') => {
    const response = await request('textDocument/completion', {
      textDocument: { uri },
      position: { line, character },
      context: { triggerKind: 2, triggerCharacter: trigger },
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

const STRUCT_SOURCE = `package main

struct Point {
    x: int
    y: int
}

func this.move(dx: int) -> Point {
    this.x = this.x + dx
    return this
}

func main() {
    let p = Point{x: 1, y: 2}
    let v = p.x
    p.
}
`;

test('struct fields and methods complete after the dot, including inside methods', async (t) => {
  const client = startServer(t);
  const uri = 'file:///tmp/yscript-types/main.ys';
  await initialize(client, 'file:///tmp/yscript-types');
  client.open(uri, STRUCT_SOURCE);

  const memberItems = await client.completion(uri, 15, '    p.'.length);
  const labels = new Set(memberItems.map((item) => item.label));
  assert.ok(labels.has('x'), `missing field x: ${[...labels].join(', ')}`);
  assert.ok(labels.has('y'), `missing field y: ${[...labels].join(', ')}`);
  assert.ok(labels.has('move'), `missing method move: ${[...labels].join(', ')}`);
  const xField = memberItems.find((item) => item.label === 'x');
  assert.ok(xField.documentation);

  // 方法体内的 this. 同样补全字段
  const thisItems = await client.completion(uri, 8, '    this.'.length);
  const thisLabels = new Set(thisItems.map((item) => item.label));
  assert.ok(thisLabels.has('x') && thisLabels.has('y'));

  // 跳转定义到字段声明
  const definition = await client.request('textDocument/definition', {
    textDocument: { uri },
    position: { line: 14, character: 14 },
  });
  assert.equal(definition.result.uri, uri);
  assert.equal(definition.result.range.start.line, 3);
});

test('enum members complete and hover explains the enum', async (t) => {
  const client = startServer(t);
  const uri = 'file:///tmp/yscript-types/enum.ys';
  await initialize(client, 'file:///tmp/yscript-types');
  client.open(uri, `package main

enum Color {
    Red,
    Green,
    Blue
}

func main() {
    let c = Color.Red
    Color.
}
`);

  const items = await client.completion(uri, 10, '    Color.'.length);
  assert.deepEqual(items.map((item) => item.label).sort(), ['Blue', 'Green', 'Red']);

  const hover = await client.request('textDocument/hover', {
    textDocument: { uri },
    position: { line: 9, character: 19 },
  });
  assert.match(hover.result.contents.value, /枚举/);
});

test('variable types infer from struct literals, function return types and new', async (t) => {
  const client = startServer(t);
  await initialize(client, 'file:///tmp/yscript-types');

  const source = `package main

struct Node {
    value: int
    next: string
}

func makeNode() -> Node {
    return Node{value: 1, next: ""}
}

func main() {
    let a = Node{value: 1, next: ""}
    let b = makeNode()
    let d = new Node()
    a.
    b.
    d.
}
`;

  for (const line of [15, 16, 17]) {
    const uri = `file:///tmp/yscript-types/infer_${line}.ys`;
    client.open(uri, source);
    const items = await client.completion(uri, line, '    a.'.length);
    const labels = new Set(items.map((item) => item.label));
    assert.ok(labels.has('value') && labels.has('next'), `line ${line} missing struct fields: ${[...labels].join(', ')}`);
  }
});

test('chained struct fields resolve through nested field types', async (t) => {
  const client = startServer(t);
  const uri = 'file:///tmp/yscript-types/chain.ys';
  await initialize(client, 'file:///tmp/yscript-types');
  client.open(uri, `package main

struct IPHeader {
    src_ip: string
    dst_ip: string
}

struct Packet {
    ip: IPHeader
    payload: bytes
}

func main() {
    let pkt = Packet{ip: IPHeader{}, payload: b""}
    pkt.ip.
}
`);

  const items = await client.completion(uri, 14, '    pkt.ip.'.length);
  const labels = new Set(items.map((item) => item.label));
  assert.ok(labels.has('src_ip') && labels.has('dst_ip'), `missing nested fields: ${[...labels].join(', ')}`);
});

test('struct literal completes remaining field names', async (t) => {
  const client = startServer(t);
  const uri = 'file:///tmp/yscript-types/literal.ys';
  await initialize(client, 'file:///tmp/yscript-types');
  const source = `package main

struct Config {
    target: string
    ports: list
    verbose: bool
}

func main() {
    let cfg = Config{target: "x", }
}
`;
  client.open(uri, source);

  const items = await client.completion(uri, 9, '    let cfg = Config{target: "x", '.length, '{');
  const labels = new Set(items.map((item) => item.label));
  assert.ok(labels.has('ports') && labels.has('verbose'), `missing literal fields: ${[...labels].join(', ')}`);
  assert.ok(!labels.has('target'), 'already-assigned fields should not be suggested again');
});

test('standard-library import paths complete inside quotes', async (t) => {
  const client = startServer(t);
  const uri = 'file:///tmp/yscript-types/import.ys';
  await initialize(client, 'file:///tmp/yscript-types');
  client.open(uri, 'package main\nimport "str"\n');

  const items = await client.completion(uri, 1, 'import "str'.length, '"');
  const labels = new Set(items.map((item) => item.label));
  assert.ok(labels.has('string'), `missing module completion: ${[...labels].join(', ')}`);
  assert.ok(labels.has('strings'));
  assert.ok(items.every((item) => item.label.toLowerCase().startsWith('str')));
});

test('import list offers module names after a comma', async (t) => {
  const client = startServer(t);
  const uri = 'file:///tmp/yscript-types/import-list.ys';
  await initialize(client, 'file:///tmp/yscript-types');
  const text = 'package main\nimport ["json", ]\n';
  client.open(uri, text);

  const items = await client.completion(uri, 1, 'import ["json", '.length, ',');
  const labels = new Set(items.map((item) => item.label));
  assert.ok(labels.has('string'), `missing module completion after comma: ${[...labels].join(', ')}`);
  assert.ok(labels.has('strings'));
});

test('relative import paths complete from the filesystem', async (t) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'yscript-imports-'));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  fs.mkdirSync(path.join(workspace, 'lib', 'util'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'lib', 'util', 'encoding_utils.ys'), 'package util\n');
  fs.writeFileSync(path.join(workspace, 'lib', 'util', 'strings.ys'), 'package util\n');

  const uri = pathToFileURL(path.join(workspace, 'main.ys')).toString();
  const client = startServer(t);
  await initialize(client, pathToFileURL(workspace).toString());
  const text = 'package main\nimport ["./lib/ut"]\n';
  client.open(uri, text);

  const items = await client.completion(uri, 1, 'import ["./lib/ut'.length, '"');
  const util = items.find((item) => item.label === 'util/');
  assert.ok(util, `missing directory completion: ${items.map((i) => i.label).join(', ')}`);
  assert.equal(util.textEdit.newText, './lib/util');
});
