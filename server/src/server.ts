/**
 * YScript LSP Server
 *
 * 提供：诊断、悬停、补全、跳转定义、文档符号、格式化、签名帮助。
 */

import {
  createConnection,
  TextDocuments,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  CompletionItem,
  CompletionItemKind,
  CompletionParams,
  TextEdit,
  InsertTextFormat,
  Hover,
  HoverParams,
  Definition,
  DefinitionParams,
  DocumentSymbol,
  DocumentSymbolParams,
  SymbolKind,
  Position,
  Diagnostic as LSPDiagnostic,
  DiagnosticSeverity,
  DiagnosticTag,
  DocumentFormattingParams,
  DocumentRangeFormattingParams,
  MarkupKind,
  SignatureHelp,
  SignatureHelpParams,
  ParameterInformation,
  SignatureInformation,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { tokenize, analyze } from './lexer';
import {
  CompletionItemMeta,
  CompletionKind,
  buildAllCompletions,
  buildHoverDoc,
  TYPES,
  TYPE_MEMBERS,
  TYPE_INFERENCE_RULES,
} from './keywords';

const connection = createConnection();
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

const ALL_COMPLETIONS = buildAllCompletions();
const HOVER_INDEX = new Map<string, CompletionItemMeta>();
for (const m of ALL_COMPLETIONS) {
  HOVER_INDEX.set(m.label, m);
}

// TYPE_MEMBERS 是扁平数组，按 of（所属类型）分组，便于成员补全查找
const TYPE_MEMBERS_BY_TYPE = new Map<string, CompletionItemMeta[]>();
for (const m of TYPE_MEMBERS) {
  const key = m.of ?? '';
  const list = TYPE_MEMBERS_BY_TYPE.get(key) ?? [];
  list.push(m);
  TYPE_MEMBERS_BY_TYPE.set(key, list);
}

connection.onInitialize((_params: InitializeParams): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      hoverProvider: true,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['.', ':', ' ', '"', '`', '/'],
      },
      definitionProvider: true,
      documentSymbolProvider: true,
      documentFormattingProvider: true,
      documentRangeFormattingProvider: true,
      referencesProvider: false,
      signatureHelpProvider: {
        triggerCharacters: ['(', ','],
      },
      renameProvider: false,
    },
  };
});

connection.onInitialized(() => {
  connection.console.log('YScript LSP 服务器已启动 (v3)');
});

// ---------------- 辅助类型 ----------------

interface VarInfo {
  name: string;
  type?: string;
  declLine: number;
  declChar: number;
  declEndChar: number;
  kind: 'var' | 'const' | 'let';
}

interface FuncInfo {
  name: string;
  params: string[];
  declLine: number;
  declChar: number;
  declEndChar: number;
  bodyStartLine: number;
  bodyEndLine: number;
}

interface Scope {
  vars: Map<string, VarInfo>;
  parent?: Scope;
}

/** 字符串/注释内的位置 */
function isInsideStringOrComment(text: string, offset: number): boolean {
  let i = 0;
  let inString = false;
  let stringChar = '';
  let inLineComment = false;
  let inBlockComment = false;
  while (i < offset) {
    const ch = text[i];
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
    } else if (inBlockComment) {
      if (ch === '*' && text[i + 1] === '#') { inBlockComment = false; i++; }
    } else if (inString) {
      if (ch === '\\' && i + 1 < offset) i++;
      else if (ch === stringChar) inString = false;
    } else {
      if (ch === '#' && text[i + 1] !== '*') { inLineComment = true; i++; }
      else if (ch === '#' && text[i + 1] === '*') { inBlockComment = true; i++; }
      else if (ch === '"' || ch === '`') { inString = true; stringChar = ch; }
    }
    i++;
  }
  return inString || inLineComment || inBlockComment;
}

function offsetToPosition(text: string, offset: number): Position {
  let line = 0;
  let ch = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') { line++; ch = 0; }
    else ch++;
  }
  return { line, character: ch };
}

function positionToOffset(text: string, pos: Position): number {
  let line = 0;
  let ch = 0;
  for (let i = 0; i < text.length; i++) {
    if (line === pos.line && ch === pos.character) return i;
    if (text[i] === '\n') { line++; ch = 0; }
    else ch++;
  }
  return text.length;
}

function lineStartOffset(text: string, lineIndex: number): number {
  let off = 0;
  let curLine = 0;
  for (let i = 0; i < text.length; i++) {
    if (curLine === lineIndex) return off;
    if (text[i] === '\n') { curLine++; off = i + 1; }
  }
  return off;
}

function getWordAt(text: string, offset: number): string | null {
  if (offset < 0 || offset > text.length) return null;
  let start = offset;
  while (start > 0 && /[A-Za-z0-9_]/.test(text[start - 1])) start--;
  let end = offset;
  while (end < text.length && /[A-Za-z0-9_]/.test(text[end])) end++;
  if (start === end) return null;
  return text.slice(start, end);
}

function getWordPrefix(text: string, offset: number): string {
  let start = offset;
  while (start > 0 && /[A-Za-z0-9_]/.test(text[start - 1])) start--;
  return text.slice(start, offset);
}

function isIdentStart(ch: string | undefined): boolean {
  return !!ch && /[A-Za-z_]/.test(ch);
}

function isIdentChar(ch: string | undefined): boolean {
  return !!ch && /[A-Za-z0-9_]/.test(ch);
}

function isIdent(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

// ---------------- 文档符号 + 作用域分析 ----------------

/** 从源码中提取作用域（粗略：找 func/init 后匹配的 { ... } 块） */
function analyzeDocument(doc: TextDocument): {
  symbols: DocumentSymbol[];
  scopes: Scope[];
  funcs: Map<string, FuncInfo>;
  varTypes: Map<string, string>;
} {
  const text = doc.getText();
  const symbols: DocumentSymbol[] = [];
  const scopes: Scope[] = [];
  const funcs = new Map<string, FuncInfo>();
  const varTypes = new Map<string, string>();
  const lines = text.split('\n');

  // 1. 收集变量类型（先做类型推断）
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = /^\s*(let|const|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*[:=]/.exec(line);
    if (m) {
      const name = m[2];
      for (const rule of TYPE_INFERENCE_RULES) {
        if (rule.regex.test(line)) {
          const t = rule.type;
          const match = /new\s+(\w+)/.exec(line);
          if (match) varTypes.set(name, match[1]);
          else varTypes.set(name, t);
          break;
        }
      }
    }
    // 显式类型标注: let x: int = ...
    const m2 = /^\s*(let|const|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_<>,\s]*?)\s*=/.exec(line);
    if (m2) {
      varTypes.set(m2[2], m2[3].trim().split(/\s/)[0]);
    }
  }

  // 2. 提取 func/init/class/struct/enum/interface/import/package
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    let m = /^(func|init)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/.exec(trimmed);
    if (m) {
      const kind = m[1];
      const name = m[2];
      const params = m[3].split(',').map(p => p.trim().split(/\s*[:=]/)[0]).filter(Boolean);
      const startChar = line.indexOf(name);
      const start: Position = { line: i, character: startChar };
      const end: Position = { line: i, character: startChar + name.length };
      const symbolKind: SymbolKind = kind === 'init' ? SymbolKind.Function : SymbolKind.Function;
      symbols.push({
        name: kind === 'init' ? 'init()' : name,
        kind: symbolKind,
        range: { start: { line: i, character: 0 }, end: { line: i, character: line.length } },
        selectionRange: { start, end },
        detail: kind === 'init' ? 'init()' : `func ${name}(${m[3]})`,
        children: [],
      });
      if (kind === 'func') {
        // 找函数体的 { } 范围
        const openIdx = findMatchingBrace(text, positionToOffset(text, { line: i, character: 0 }) + m[0].length);
        if (openIdx >= 0) {
          const closeIdx = findMatchingCloseBrace(text, openIdx);
          if (closeIdx >= 0) {
            const bodyStart = offsetToPosition(text, openIdx + 1);
            const bodyEnd = offsetToPosition(text, closeIdx);
            funcs.set(name, { name, params, declLine: i, declChar: startChar, declEndChar: startChar + name.length, bodyStartLine: bodyStart.line, bodyEndLine: bodyEnd.line });
          }
        }
      }
      continue;
    }

    m = /^(let|const|var)\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(trimmed);
    if (m) {
      const kw = m[1];
      const name = m[2];
      const startChar = line.indexOf(name);
      const start: Position = { line: i, character: startChar };
      const end: Position = { line: i, character: startChar + name.length };
      symbols.push({
        name,
        kind: kw === 'const' ? SymbolKind.Constant : SymbolKind.Variable,
        range: { start, end },
        selectionRange: { start, end },
        detail: varTypes.get(name) ? `let ${name}: ${varTypes.get(name)}` : line.trim(),
      });
      continue;
    }

    m = /^(struct|class|enum|interface)\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(trimmed);
    if (m) {
      const name = m[2];
      const startChar = line.indexOf(name);
      const start: Position = { line: i, character: startChar };
      const end: Position = { line: i, character: startChar + name.length };
      symbols.push({
        name,
        kind: m[1] === 'struct' ? SymbolKind.Struct : m[1] === 'enum' ? SymbolKind.Enum : SymbolKind.Interface,
        range: { start: { line: i, character: 0 }, end: { line: i, character: line.length } },
        selectionRange: { start, end },
        detail: m[1],
      });
      continue;
    }

    m = /^import\s+"([^"]+)"/.exec(trimmed);
    if (m) {
      symbols.push({
        name: m[1],
        kind: SymbolKind.Module,
        range: { start: { line: i, character: 0 }, end: { line: i, character: line.length } },
        selectionRange: { start: { line: i, character: 0 }, end: { line: i, character: trimmed.length } },
        detail: 'import',
      });
    }

    m = /^package\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(trimmed);
    if (m) {
      symbols.push({
        name: m[1],
        kind: SymbolKind.Package,
        range: { start: { line: i, character: 0 }, end: { line: i, character: line.length } },
        selectionRange: { start: { line: i, character: 0 }, end: { line: i, character: trimmed.length } },
        detail: 'package',
      });
    }
  }

  return { symbols, scopes, funcs, varTypes };
}

function findMatchingBrace(text: string, fromOffset: number): number {
  for (let i = fromOffset; i < text.length; i++) {
    if (text[i] === '{') return i;
  }
  return -1;
}

function findMatchingCloseBrace(text: string, openOffset: number): number {
  let depth = 0;
  for (let i = openOffset; i < text.length; i++) {
    if (isInsideStringOrComment(text, i)) continue;
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// ---------------- 诊断 ----------------

function validate(doc: TextDocument): LSPDiagnostic[] {
  const text = doc.getText();
  const out: LSPDiagnostic[] = [];

  // 1. 词法层诊断
  const tokens = tokenize(text);
  const lexerDiags = analyze(tokens, text);
  for (const d of lexerDiags) {
    out.push({
      range: d.range,
      message: d.message,
      severity:
        d.severity === 'error'
          ? DiagnosticSeverity.Error
          : d.severity === 'warning'
            ? DiagnosticSeverity.Warning
            : DiagnosticSeverity.Information,
      source: 'yscript',
    });
  }

  // 2. 语义层诊断：未声明标识符
  const { funcs, varTypes } = analyzeDocument(doc);
  const builtinNames = new Set<string>();
  for (const m of ALL_COMPLETIONS) builtinNames.add(m.label);
  for (const t of TYPES) builtinNames.add(t.label);

  // 收集所有 func 名与参数
  const definedNames = new Set<string>(builtinNames);
  for (const f of funcs.values()) {
    definedNames.add(f.name);
    for (const p of f.params) definedNames.add(p);
  }
  for (const v of varTypes.keys()) definedNames.add(v);

  // 扫描标识符引用
  const idRegex = /[A-Za-z_][A-Za-z0-9_]*/g;
  let m: RegExpExecArray | null;
  while ((m = idRegex.exec(text)) !== null) {
    const name = m[0];
    if (definedNames.has(name)) continue;
    const offset = m.index;
    if (isInsideStringOrComment(text, offset)) continue;
    // 跳过 import 后的路径
    const before = text.slice(Math.max(0, offset - 20), offset);
    if (/import\s+["']?$/.test(before)) continue;
    if (/^["']/.test(text[offset + name.length] ?? '')) continue;
    const pos = offsetToPosition(text, offset);
    out.push({
      range: { start: pos, end: { line: pos.line, character: pos.character + name.length } },
      message: `未定义的标识符: '${name}'`,
      severity: DiagnosticSeverity.Warning,
      source: 'yscript',
      tags: [DiagnosticTag.Unnecessary],
    });
  }

  return out;
}

documents.onDidChangeContent((change) => {
  void connection.sendDiagnostics({ uri: change.document.uri, diagnostics: validate(change.document) });
});

documents.onDidClose((e) => {
  void connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
});

// ---------------- 悬停 ----------------

connection.onHover(({ textDocument, position }: HoverParams): Hover | null => {
  const doc = documents.get(textDocument.uri);
  if (!doc) return null;
  const text = doc.getText();
  const offset = positionToOffset(text, position);
  if (isInsideStringOrComment(text, offset)) return null;
  const word = getWordAt(text, offset);
  if (!word) return null;

  // 已知符号
  const meta = HOVER_INDEX.get(word);
  if (meta) {
    return { contents: { kind: MarkupKind.Markdown, value: buildHoverDoc(meta) } };
  }

  // 用户定义
  const { funcs, varTypes, symbols } = analyzeDocument(doc);
  for (const sym of symbols) {
    if (sym.name === word) {
      const detail = sym.detail ?? '';
      const t = varTypes.get(word);
      return {
        contents: {
          kind: MarkupKind.Markdown,
          value:
            `**${word}** _(${symbolKindLabel(sym.kind)})_` +
            (t ? `\n\n类型: \`${t}\`` : '') +
            (detail ? `\n\n\`\`\`yscript\n${detail}\n\`\`\`` : ''),
        },
      };
    }
  }
  for (const f of funcs.values()) {
    if (f.name === word) {
      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: `**${word}** _(函数)_\n\n\`\`\`yscript\nfunc ${word}(${f.params.join(', ')})\n\`\`\``,
        },
      };
    }
  }
  return null;
});

function symbolKindLabel(k: SymbolKind): string {
  switch (k) {
    case SymbolKind.Function: return '函数';
    case SymbolKind.Variable: return '变量';
    case SymbolKind.Constant: return '常量';
    case SymbolKind.Class: return '类';
    case SymbolKind.Struct: return '结构体';
    case SymbolKind.Enum: return '枚举';
    case SymbolKind.Interface: return '接口';
    case SymbolKind.Namespace: return '命名空间';
    case SymbolKind.Package: return '包';
    case SymbolKind.Module: return '模块';
    case SymbolKind.Method: return '方法';
    case SymbolKind.Field: return '字段';
    default: return '符号';
  }
}

// ---------------- 补全 ----------------

connection.onCompletion((params: CompletionParams): CompletionItem[] => {
  const { textDocument, position } = params;
  const doc = documents.get(textDocument.uri);
  if (!doc) return [];
  const text = doc.getText();
  const offset = positionToOffset(text, position);
  if (isInsideStringOrComment(text, offset)) return [];

  const prefix = getWordPrefix(text, offset);
  const before = text.slice(Math.max(0, offset - 1), offset);
  const prevChar = before;

  // 1. 成员访问上下文
  if (prevChar === '.') {
    return getMemberCompletions(doc, text, offset - 1);
  }

  // 2. import 后的路径
  const beforeImport = text.slice(Math.max(0, offset - 50), offset);
  if (/(?:^|\n)\s*import\s+["']?[^"']*$/.test(beforeImport)) {
    return [
      { label: '"${1:path}"', kind: CompletionItemKind.Snippet, insertText: '"${1:path}"', detail: '模块路径' },
    ];
  }

  // 3. import / package 关键字后
  if (/(?:^|\n)\s*import\s*$/.test(beforeImport) || /(?:^|\n)\s*package\s*$/.test(beforeImport)) {
    return [
      { label: '"${1:path}"', kind: CompletionItemKind.Snippet, insertText: '"${1:path}"' },
    ];
  }

  // 4. 标准补全：关键字 + 类型 + 函数 + 局部符号
  const items: CompletionItem[] = [];
  const seen = new Set<string>();

  // 内置项
  for (const m of ALL_COMPLETIONS) {
    if (prefix && !m.label.toLowerCase().startsWith(prefix.toLowerCase())) continue;
    if (seen.has(m.label)) continue;
    seen.add(m.label);
    items.push(metaToCompletion(m));
  }

  // 用户符号
  const { symbols, varTypes, funcs } = analyzeDocument(doc);
  for (const s of symbols) {
    if (prefix && !s.name.toLowerCase().startsWith(prefix.toLowerCase())) continue;
    if (seen.has(s.name)) continue;
    seen.add(s.name);
    const k = s.kind === SymbolKind.Function ? CompletionItemKind.Function
      : s.kind === SymbolKind.Constant ? CompletionItemKind.Constant
        : s.kind === SymbolKind.Class ? CompletionItemKind.Class
          : s.kind === SymbolKind.Struct ? CompletionItemKind.Struct
            : s.kind === SymbolKind.Enum ? CompletionItemKind.Enum
              : s.kind === SymbolKind.Interface ? CompletionItemKind.Interface
                : s.kind === SymbolKind.Module ? CompletionItemKind.Module
                  : CompletionItemKind.Variable;
    items.push({
      label: s.name,
      kind: k,
      detail: s.detail,
      documentation: varTypes.get(s.name) ? `类型: \`${varTypes.get(s.name)}\`` : undefined,
    });
  }

  // 函数参数名（仅当在函数体内）
  for (const f of funcs.values()) {
    if (position.line >= f.bodyStartLine && position.line <= f.bodyEndLine) {
      for (const p of f.params) {
        if (prefix && !p.toLowerCase().startsWith(prefix.toLowerCase())) continue;
        if (seen.has(p)) continue;
        seen.add(p);
        items.push({
          label: p,
          kind: CompletionItemKind.Variable,
          detail: `参数（${f.name}）`,
        });
      }
    }
  }

  return items;
});

/** `.` 触发的成员补全 */
function getMemberCompletions(doc: TextDocument, text: string, dotOffset: number): CompletionItem[] {
  // 向左扫描一个标识符
  let i = dotOffset - 1;
  while (i >= 0 && isIdentChar(text[i])) i--;
  const nameStart = i + 1;
  const receiver = text.slice(nameStart, dotOffset);
  if (!receiver) return [];

  // 解析类型
  const { varTypes } = analyzeDocument(doc);
  const type = varTypes.get(receiver);
  const members: CompletionItem[] = [];

  // 若类型未知，给出通用 list/string 方法
  const candidateTypes: string[] = [];
  if (type) candidateTypes.push(type);
  if (candidateTypes.length === 0) {
    candidateTypes.push('list', 'string', 'dict', 'bytes', 'int', 'float', 'socket');
  }

  for (const t of candidateTypes) {
    const ms = TYPE_MEMBERS_BY_TYPE.get(t);
    if (!ms) continue;
    for (const m of ms) {
      members.push({
        label: m.label,
        kind: CompletionItemKind.Method,
        detail: m.detail,
        documentation: m.signature,
        insertText: m.insertText,
        insertTextFormat: m.insertText?.includes('$') ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
      });
    }
  }

  return members;
}

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  // 补全时若没设置 detail/documentation，resolve 阶段补充
  if (item.documentation) return item;
  const meta = HOVER_INDEX.get(item.label);
  if (meta) {
    if (!item.detail) item.detail = meta.detail;
    item.documentation = { kind: MarkupKind.Markdown, value: buildHoverDoc(meta) };
  }
  return item;
});

// ---------------- 跳转定义 ----------------

connection.onDefinition((params: DefinitionParams): Definition | null => {
  const { textDocument, position } = params;
  const doc = documents.get(textDocument.uri);
  if (!doc) return null;
  const text = doc.getText();
  const offset = positionToOffset(text, position);
  if (isInsideStringOrComment(text, offset)) return null;
  const word = getWordAt(text, offset);
  if (!word) return null;
  const { symbols, funcs } = analyzeDocument(doc);
  for (const s of symbols) {
    if (s.name === word) {
      return { uri: textDocument.uri, range: { start: s.selectionRange.start, end: s.selectionRange.end } };
    }
  }
  for (const f of funcs.values()) {
    if (f.name === word) {
      return { uri: textDocument.uri, range: { start: { line: f.declLine, character: f.declChar }, end: { line: f.declLine, character: f.declEndChar } } };
    }
  }
  return null;
});

// ---------------- 文档符号 ----------------

connection.onDocumentSymbol((params: DocumentSymbolParams): DocumentSymbol[] => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];
  return analyzeDocument(doc).symbols;
});

// ---------------- 签名帮助 ----------------

connection.onSignatureHelp((params: SignatureHelpParams): SignatureHelp | null => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;
  const text = doc.getText();
  const offset = positionToOffset(text, params.position);
  // 找到左侧最近的 ( 且匹配的 func
  let depth = 0;
  let i = offset - 1;
  while (i > 0) {
    const ch = text[i];
    if (isInsideStringOrComment(text, i)) { i--; continue; }
    if (ch === ')') depth++;
    else if (ch === '(') {
      if (depth === 0) break;
      depth--;
    }
    i--;
  }
  if (i < 0 || text[i] !== '(') return null;
  // 提取函数名
  let j = i - 1;
  while (j >= 0 && (isIdentChar(text[j]) || text[j] === '.')) j--;
  const callName = text.slice(j + 1, i).trim();
  if (!callName) return null;

  // 参数索引
  let paramIdx = 0;
  let d2 = 0;
  for (let k = offset - 1; k > i; k--) {
    if (isInsideStringOrComment(text, k)) continue;
    if (text[k] === ')') d2++;
    else if (text[k] === '(') { if (d2 > 0) d2--; }
    else if (text[k] === ',' && d2 === 0) paramIdx++;
  }

  // 查签名
  const meta = HOVER_INDEX.get(callName) ?? HOVER_INDEX.get(callName.split('.').pop() || '');
  if (!meta) {
    // 用户定义函数
    const { funcs } = analyzeDocument(doc);
    const f = funcs.get(callName);
    if (f) {
      const sig: SignatureInformation = {
        label: `${callName}(${f.params.map((p, i) => `${p}: T${i + 1}`).join(', ')})`,
        parameters: f.params.map((p, i) => ParameterInformation.create(`${p}: T${i + 1}`)),
      };
      return { signatures: [sig], activeSignature: 0, activeParameter: Math.min(paramIdx, f.params.length) };
    }
    return null;
  }
  const signature = metaSignature(meta);
  const sig: SignatureInformation = {
    label: signature,
    parameters: signature.match(/[A-Za-z_][A-Za-z0-9_]*\s*\??/g)?.slice(0, 3).map(p => ParameterInformation.create(p)) ?? [],
  };
  return { signatures: [sig], activeSignature: 0, activeParameter: paramIdx };
});

/** 从补全元数据推导函数签名 */
function metaSignature(m: CompletionItemMeta): string {
  if (m.signature) return m.signature;
  // 从 insertText 提取：如 "println(${0})" / "net.Dial(${1:host}, ${2:port})"
  const m2 = /^([A-Za-z_][A-Za-z0-9_.]*)\s*\(([^)]*)\)/.exec(m.insertText ?? '');
  if (m2) {
    const args = m2[2]
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p && p !== '${0}');
    return `${m2[1]}(${args.join(', ')})`;
  }
  return `${m.label}(...)`;
}

// ---------------- 格式化 ----------------

connection.onDocumentFormatting((params: DocumentFormattingParams): TextEdit[] => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];
  return formatYScript(doc.getText(), params.options.tabSize ?? 4);
});

connection.onDocumentRangeFormatting((params: DocumentRangeFormattingParams): TextEdit[] => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];
  return formatYScript(doc.getText(), params.options.tabSize ?? 4);
});

/** 简化版 YScript 格式化：基于大括号配对的智能缩进 */
function formatYScript(text: string, tabSize: number): TextEdit[] {
  const indent = ' '.repeat(Math.max(0, Math.min(tabSize, 8)));
  const lines = text.split('\n');
  const out: string[] = [];
  let depth = 0;

  for (const raw of lines) {
    let line = raw.replace(/[\t]/g, indent).replace(/\s+$/, '');
    const trimmed = line.trim();

    // 空行
    if (trimmed.length === 0) { out.push(''); continue; }
    // 注释
    if (trimmed.startsWith('#') || trimmed.startsWith('#*')) {
      out.push(indent.repeat(depth) + trimmed);
      continue;
    }

    // 闭合括号开头的行 → 减少缩进
    const leadingClose = trimmed.match(/^[}\)\]]+/);
    let localDepth = depth;
    if (leadingClose) {
      localDepth = Math.max(0, depth - leadingClose[0].length);
      // 同行的开括号也抵消回来
      const opensInLine = (trimmed.match(/[\{\(\[]/g) || []).length;
      const closesInLine = (trimmed.match(/[\}\)\]]/g) || []).length;
      localDepth = Math.max(0, depth - closesInLine + opensInLine);
    }

    out.push(indent.repeat(localDepth) + trimmed);

    // 统计开/闭括号，更新全局 depth
    const opens = (trimmed.match(/[\{\(\[]/g) || []).length;
    const closes = (trimmed.match(/[\}\)\]]/g) || []).length;
    depth = Math.max(0, depth + opens - closes);
  }

  const newText = out.join('\n');
  if (newText === text) return [];
  return [
    TextEdit.replace(
      { start: { line: 0, character: 0 }, end: offsetToPosition(text, text.length) },
      newText,
    ),
  ];
}

// ---------------- 补全元数据转换 ----------------

function metaToCompletion(m: CompletionItemMeta): CompletionItem {
  const isSnippet = m.kind === 'snippet' || (m.insertText?.includes('$') ?? false);
  return {
    label: m.label,
    kind: completionKind(m.kind),
    detail: m.detail,
    documentation: m.signature ? { kind: MarkupKind.Markdown, value: buildHoverDoc(m) } : m.documentation,
    insertText: m.insertText ?? m.label,
    insertTextFormat: isSnippet ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
    sortText: String(m.sortKey ?? 50).padStart(4, '0') + '_' + m.label,
    filterText: m.label,
  };
}

function completionKind(k: CompletionKind): CompletionItemKind {
  switch (k) {
    case 'keyword': return CompletionItemKind.Keyword;
    case 'type': return CompletionItemKind.TypeParameter;
    case 'constant': return CompletionItemKind.Constant;
    case 'builtin': return CompletionItemKind.Function;
    case 'method': return CompletionItemKind.Method;
    case 'property': return CompletionItemKind.Property;
    case 'snippet': return CompletionItemKind.Snippet;
    case 'function': return CompletionItemKind.Function;
    case 'variable': return CompletionItemKind.Variable;
    case 'field': return CompletionItemKind.Field;
    case 'class': return CompletionItemKind.Class;
    case 'struct': return CompletionItemKind.Struct;
    case 'enum': return CompletionItemKind.Enum;
    case 'interface': return CompletionItemKind.Interface;
    case 'module': return CompletionItemKind.Module;
    default: return CompletionItemKind.Text;
  }
}

// ---------------- 启动 ----------------
documents.listen(connection);
connection.listen();
