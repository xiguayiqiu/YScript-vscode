const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');
const { NS_MEMBERS } = require('../src/ns_members.js');

test('namespace completions appear before and after typing the dot and insert function calls', async (t) => {
  const serverPath = path.resolve(__dirname, '../out/server.js');
  const server = spawn(process.execPath, [serverPath, '--stdio'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
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

  function send(message) {
    const body = Buffer.from(JSON.stringify(message));
    server.stdin.write(Buffer.concat([
      Buffer.from(`Content-Length: ${body.length}\r\n\r\n`),
      body,
    ]));
  }

  function request(method, params) {
    const id = nextId++;
    send({ jsonrpc: '2.0', id, method, params });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timed out waiting for ${method}: ${stderr}`));
      }, 5000);
      pending.set(id, { resolve, timer });
    });
  }

  const initialized = await request('initialize', {
    processId: process.pid,
    rootUri: 'file:///tmp/yscript-completion-test',
    capabilities: {},
  });
  assert.ok(initialized.result.capabilities.completionProvider.triggerCharacters.includes('o'));
  send({ jsonrpc: '2.0', method: 'initialized', params: {} });
  const uri = 'file:///tmp/yscript-completion-test/main.ys';
  send({
    jsonrpc: '2.0',
    method: 'textDocument/didOpen',
    params: {
      textDocument: { uri, languageId: 'yscript', version: 1, text: 'stdio' },
    },
  });

  const namespaceItems = await request('textDocument/completion', {
    textDocument: { uri },
    position: { line: 0, character: 5 },
    context: { triggerKind: 2, triggerCharacter: 'o' },
  });
  const inputBeforeDot = namespaceItems.result.find((item) => item.label === 'stdio.input');
  assert.ok(inputBeforeDot);
  assert.equal(inputBeforeDot.textEdit.newText, '.input(${0})');

  send({
    jsonrpc: '2.0',
    method: 'textDocument/didChange',
    params: {
      textDocument: { uri, version: 2 },
      contentChanges: [{ text: 'stdio.in' }],
    },
  });
  const memberPrefixItems = await request('textDocument/completion', {
    textDocument: { uri },
    position: { line: 0, character: 8 },
    context: { triggerKind: 2, triggerCharacter: 'n' },
  });
  const inputPrefix = memberPrefixItems.result.find((item) => item.label === 'input');
  assert.ok(inputPrefix);
  assert.equal(inputPrefix.insertText, 'input(${0})');

  send({
    jsonrpc: '2.0',
    method: 'textDocument/didChange',
    params: {
      textDocument: { uri, version: 3 },
      contentChanges: [{ text: 'stdio.' }],
    },
  });
  const memberItems = await request('textDocument/completion', {
    textDocument: { uri },
    position: { line: 0, character: 6 },
    context: { triggerKind: 2, triggerCharacter: '.' },
  });
  const inputAfterDot = memberItems.result.find((item) => item.label === 'input');
  assert.ok(inputAfterDot);
  assert.equal(inputAfterDot.insertText, 'input(${0})');
  assert.equal(inputAfterDot.insertTextFormat, 2);
  assert.ok(inputAfterDot.documentation);

  const cudaCall = 'cuda.HMAC_SHA1_Batch(';
  send({
    jsonrpc: '2.0',
    method: 'textDocument/didChange',
    params: {
      textDocument: { uri, version: 4 },
      contentChanges: [{ text: cudaCall }],
    },
  });
  const signatureHelp = await request('textDocument/signatureHelp', {
    textDocument: { uri },
    position: { line: 0, character: cudaCall.length },
  });
  assert.equal(signatureHelp.result.signatures[0].label, 'cuda.HMAC_SHA1_Batch(key, messages)');

  const hover = await request('textDocument/hover', {
    textDocument: { uri },
    position: { line: 0, character: 'cuda.'.length },
  });
  assert.match(hover.result.contents.value, /GPU HMAC-SHA1/);

  const fallbackCall = 'url.Parse(';
  send({
    jsonrpc: '2.0',
    method: 'textDocument/didChange',
    params: {
      textDocument: { uri, version: 5 },
      contentChanges: [{ text: fallbackCall }],
    },
  });
  const fallbackSignature = await request('textDocument/signatureHelp', {
    textDocument: { uri },
    position: { line: 0, character: fallbackCall.length },
  });
  assert.equal(fallbackSignature.result.signatures[0].label, 'url.Parse(...args)');

  const fallbackHover = await request('textDocument/hover', {
    textDocument: { uri },
    position: { line: 0, character: 'url.'.length },
  });
  assert.match(fallbackHover.result.contents.value, /标准库函数速查表/);

  send({
    jsonrpc: '2.0',
    method: 'textDocument/didChange',
    params: {
      textDocument: { uri, version: 6 },
      contentChanges: [{ text: 'term.' }],
    },
  });
  const termGroups = await request('textDocument/completion', {
    textDocument: { uri },
    position: { line: 0, character: 5 },
    context: { triggerKind: 2, triggerCharacter: '.' },
  });
  const envGroup = termGroups.result.find((item) => item.label === 'env');
  assert.ok(envGroup);
  assert.equal(envGroup.insertText, 'env.');
  assert.equal(envGroup.kind, 9);
  const termGroupNames = new Set(
    Object.keys(NS_MEMBERS).filter((name) => name.startsWith('term.')).map((name) => name.slice(5)),
  );
  const termMemberLabels = new Set(termGroups.result.map((item) => item.label));
  for (const member of NS_MEMBERS.term.filter((name) => !termGroupNames.has(name))) {
    assert.ok(termMemberLabels.has(member), `missing top-level completion for term.${member}`);
  }

  send({
    jsonrpc: '2.0',
    method: 'textDocument/didChange',
    params: {
      textDocument: { uri, version: 7 },
      contentChanges: [{ text: 'term.env.' }],
    },
  });
  const termEnvMembers = await request('textDocument/completion', {
    textDocument: { uri },
    position: { line: 0, character: 9 },
    context: { triggerKind: 2, triggerCharacter: '.' },
  });
  assert.ok(termEnvMembers.result.some((item) => item.label === 'snapshot'));

  let version = 8;
  for (const [namespace, members] of Object.entries(NS_MEMBERS)) {
    if (!namespace.startsWith('term.')) continue;
    const group = namespace.slice('term.'.length);
    const text = `term.${group}.`;
    send({
      jsonrpc: '2.0',
      method: 'textDocument/didChange',
      params: {
        textDocument: { uri, version: version++ },
        contentChanges: [{ text }],
      },
    });
    const completions = await request('textDocument/completion', {
      textDocument: { uri },
      position: { line: 0, character: text.length },
      context: { triggerKind: 2, triggerCharacter: '.' },
    });
    const labels = new Set(completions.result.map((item) => item.label));
    for (const member of members) {
      assert.ok(labels.has(member), `missing completion for ${namespace}.${member}`);
    }
  }

  const yuiDocumentPath = path.resolve(__dirname, '../../../ysc-model/test/yui_plugin_fixture.ys');
  const yuiDocumentUri = pathToFileURL(yuiDocumentPath).toString();
  const yuiSource = `package main
import ["../lib/gui/yui" as yui]

func main(args) {
    yui.yui_window("App", 640, 480)
}
`;
  send({
    jsonrpc: '2.0',
    method: 'textDocument/didOpen',
    params: {
      textDocument: { uri: yuiDocumentUri, languageId: 'yscript', version: 1, text: yuiSource },
    },
  });
  const yuiMemberCompletions = await request('textDocument/completion', {
    textDocument: { uri: yuiDocumentUri },
    position: { line: 4, character: 8 },
    context: { triggerKind: 2, triggerCharacter: '.' },
  });
  const yuiWindowCompletion = yuiMemberCompletions.result.find((item) => item.label === 'yui_window');
  assert.ok(
    yuiWindowCompletion,
    `imported YUI alias members should be completed; got: ${yuiMemberCompletions.result.map((item) => item.label).join(', ')}`,
  );
  assert.match(yuiWindowCompletion.documentation.value, /窗口标题/);

  const yuiSignature = await request('textDocument/signatureHelp', {
    textDocument: { uri: yuiDocumentUri },
    position: { line: 4, character: '    yui.yui_window('.length },
  });
  assert.equal(yuiSignature.result.signatures[0].label, 'yui.yui_window(title, width, height)');
  assert.match(yuiSignature.result.signatures[0].documentation.value, /逻辑画布尺寸/);

  const yuiHover = await request('textDocument/hover', {
    textDocument: { uri: yuiDocumentUri },
    position: { line: 4, character: 11 },
  });
  assert.match(yuiHover.result.contents.value, /1 到 32768 的整数/);

  const yuiAliasDefinition = await request('textDocument/definition', {
    textDocument: { uri: yuiDocumentUri },
    position: { line: 1, character: 29 },
  });
  assert.equal(
    yuiAliasDefinition.result.uri,
    pathToFileURL(path.resolve(__dirname, '../../../ysc-model/lib/gui/yui.ys')).toString(),
  );

  const yuiReceiverDefinition = await request('textDocument/definition', {
    textDocument: { uri: yuiDocumentUri },
    position: { line: 4, character: 5 },
  });
  assert.equal(
    yuiReceiverDefinition.result.uri,
    pathToFileURL(path.resolve(__dirname, '../../../ysc-model/lib/gui/yui.ys')).toString(),
  );

  const yuiDefinition = await request('textDocument/definition', {
    textDocument: { uri: yuiDocumentUri },
    position: { line: 4, character: 11 },
  });
  assert.equal(
    yuiDefinition.result.uri,
    pathToFileURL(path.resolve(__dirname, '../../../ysc-model/lib/gui/yui.ys')).toString(),
  );
  assert.ok(yuiDefinition.result.range.start.line > 0);

  const colorUri = 'file:///tmp/yscript-completion-test/color.ys';
  send({
    jsonrpc: '2.0',
    method: 'textDocument/didOpen',
    params: {
      textDocument: { uri: colorUri, languageId: 'yscript', version: 1, text: 'println.' },
    },
  });
  const colorMembers = await request('textDocument/completion', {
    textDocument: { uri: colorUri },
    position: { line: 0, character: 'println.'.length },
    context: { triggerKind: 2, triggerCharacter: '.' },
  });
  const colorExamples = new Map(colorMembers.result.map((item) => [item.label, item.insertText]));
  for (const name of ['red', 'green', 'blue', 'yellow', 'cyan', 'magenta', 'white']) {
    assert.equal(colorExamples.get(name), `${name}(\${0})`, `missing println.${name} method`);
  }

  send({
    jsonrpc: '2.0',
    method: 'textDocument/didChange',
    params: {
      textDocument: { uri: colorUri, version: 2 },
      contentChanges: [{ text: 'println.bl' }],
    },
  });
  const bluePrefix = await request('textDocument/completion', {
    textDocument: { uri: colorUri },
    position: { line: 0, character: 'println.bl'.length },
    context: { triggerKind: 2, triggerCharacter: 'l' },
  });
  assert.deepEqual(bluePrefix.result.map((item) => item.label), ['blue']);

  send({ jsonrpc: '2.0', id: nextId++, method: 'shutdown', params: null });
  send({ jsonrpc: '2.0', method: 'exit', params: null });
});
