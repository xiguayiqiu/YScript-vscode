"use strict";
/**
 * YScript LSP Server
 *
 * 提供：诊断、悬停、补全、跳转定义、文档符号、格式化、签名帮助。
 */
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const lexer_1 = require("./lexer");
const keywords_1 = require("./keywords");
const connection = (0, node_1.createConnection)();
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
const ALL_COMPLETIONS = (0, keywords_1.buildAllCompletions)();
const HOVER_INDEX = new Map();
for (const m of ALL_COMPLETIONS) {
    HOVER_INDEX.set(m.label, m);
}
// TYPE_MEMBERS 是扁平数组，按 of（所属类型）分组，便于成员补全查找
const TYPE_MEMBERS_BY_TYPE = new Map();
for (const m of keywords_1.TYPE_MEMBERS) {
    const key = m.of ?? '';
    const list = TYPE_MEMBERS_BY_TYPE.get(key) ?? [];
    list.push(m);
    TYPE_MEMBERS_BY_TYPE.set(key, list);
}
connection.onInitialize((_params) => {
    return {
        capabilities: {
            textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
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
/** 字符串/注释内的位置 */
function isInsideStringOrComment(text, offset) {
    let i = 0;
    let inString = false;
    let stringChar = '';
    let inLineComment = false;
    let inBlockComment = false;
    while (i < offset) {
        const ch = text[i];
        if (inLineComment) {
            if (ch === '\n')
                inLineComment = false;
        }
        else if (inBlockComment) {
            if (ch === '*' && text[i + 1] === '#') {
                inBlockComment = false;
                i++;
            }
        }
        else if (inString) {
            if (ch === '\\' && i + 1 < offset)
                i++;
            else if (ch === stringChar)
                inString = false;
        }
        else {
            if (ch === '#' && text[i + 1] !== '*') {
                inLineComment = true;
                i++;
            }
            else if (ch === '#' && text[i + 1] === '*') {
                inBlockComment = true;
                i++;
            }
            else if (ch === '"' || ch === '`') {
                inString = true;
                stringChar = ch;
            }
        }
        i++;
    }
    return inString || inLineComment || inBlockComment;
}
function offsetToPosition(text, offset) {
    let line = 0;
    let ch = 0;
    for (let i = 0; i < offset && i < text.length; i++) {
        if (text[i] === '\n') {
            line++;
            ch = 0;
        }
        else
            ch++;
    }
    return { line, character: ch };
}
function positionToOffset(text, pos) {
    let line = 0;
    let ch = 0;
    for (let i = 0; i < text.length; i++) {
        if (line === pos.line && ch === pos.character)
            return i;
        if (text[i] === '\n') {
            line++;
            ch = 0;
        }
        else
            ch++;
    }
    return text.length;
}
function lineStartOffset(text, lineIndex) {
    let off = 0;
    let curLine = 0;
    for (let i = 0; i < text.length; i++) {
        if (curLine === lineIndex)
            return off;
        if (text[i] === '\n') {
            curLine++;
            off = i + 1;
        }
    }
    return off;
}
function getWordAt(text, offset) {
    if (offset < 0 || offset > text.length)
        return null;
    let start = offset;
    while (start > 0 && /[A-Za-z0-9_]/.test(text[start - 1]))
        start--;
    let end = offset;
    while (end < text.length && /[A-Za-z0-9_]/.test(text[end]))
        end++;
    if (start === end)
        return null;
    return text.slice(start, end);
}
function getWordPrefix(text, offset) {
    let start = offset;
    while (start > 0 && /[A-Za-z0-9_]/.test(text[start - 1]))
        start--;
    return text.slice(start, offset);
}
function isIdentStart(ch) {
    return !!ch && /[A-Za-z_]/.test(ch);
}
function isIdentChar(ch) {
    return !!ch && /[A-Za-z0-9_]/.test(ch);
}
function isIdent(name) {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}
// ---------------- 文档符号 + 作用域分析 ----------------
/** 从源码中提取作用域（粗略：找 func/init 后匹配的 { ... } 块） */
function analyzeDocument(doc) {
    const text = doc.getText();
    const symbols = [];
    const scopes = [];
    const funcs = new Map();
    const varTypes = new Map();
    const lines = text.split('\n');
    // 1. 收集变量类型（先做类型推断）
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const m = /^\s*(let|const|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*[:=]/.exec(line);
        if (m) {
            const name = m[2];
            for (const rule of keywords_1.TYPE_INFERENCE_RULES) {
                if (rule.regex.test(line)) {
                    const t = rule.type;
                    const match = /new\s+(\w+)/.exec(line);
                    if (match)
                        varTypes.set(name, match[1]);
                    else
                        varTypes.set(name, t);
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
            const start = { line: i, character: startChar };
            const end = { line: i, character: startChar + name.length };
            const symbolKind = kind === 'init' ? node_1.SymbolKind.Function : node_1.SymbolKind.Function;
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
            const start = { line: i, character: startChar };
            const end = { line: i, character: startChar + name.length };
            symbols.push({
                name,
                kind: kw === 'const' ? node_1.SymbolKind.Constant : node_1.SymbolKind.Variable,
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
            const start = { line: i, character: startChar };
            const end = { line: i, character: startChar + name.length };
            symbols.push({
                name,
                kind: m[1] === 'struct' ? node_1.SymbolKind.Struct : m[1] === 'enum' ? node_1.SymbolKind.Enum : node_1.SymbolKind.Interface,
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
                kind: node_1.SymbolKind.Module,
                range: { start: { line: i, character: 0 }, end: { line: i, character: line.length } },
                selectionRange: { start: { line: i, character: 0 }, end: { line: i, character: trimmed.length } },
                detail: 'import',
            });
        }
        m = /^package\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(trimmed);
        if (m) {
            symbols.push({
                name: m[1],
                kind: node_1.SymbolKind.Package,
                range: { start: { line: i, character: 0 }, end: { line: i, character: line.length } },
                selectionRange: { start: { line: i, character: 0 }, end: { line: i, character: trimmed.length } },
                detail: 'package',
            });
        }
    }
    return { symbols, scopes, funcs, varTypes };
}
function findMatchingBrace(text, fromOffset) {
    for (let i = fromOffset; i < text.length; i++) {
        if (text[i] === '{')
            return i;
    }
    return -1;
}
function findMatchingCloseBrace(text, openOffset) {
    let depth = 0;
    for (let i = openOffset; i < text.length; i++) {
        if (isInsideStringOrComment(text, i))
            continue;
        if (text[i] === '{')
            depth++;
        else if (text[i] === '}') {
            depth--;
            if (depth === 0)
                return i;
        }
    }
    return -1;
}
// ---------------- 诊断 ----------------
function validate(doc) {
    const text = doc.getText();
    const out = [];
    // 1. 词法层诊断
    const tokens = (0, lexer_1.tokenize)(text);
    const lexerDiags = (0, lexer_1.analyze)(tokens, text);
    for (const d of lexerDiags) {
        out.push({
            range: d.range,
            message: d.message,
            severity: d.severity === 'error'
                ? node_1.DiagnosticSeverity.Error
                : d.severity === 'warning'
                    ? node_1.DiagnosticSeverity.Warning
                    : node_1.DiagnosticSeverity.Information,
            source: 'yscript',
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
connection.onHover(({ textDocument, position }) => {
    const doc = documents.get(textDocument.uri);
    if (!doc)
        return null;
    const text = doc.getText();
    const offset = positionToOffset(text, position);
    if (isInsideStringOrComment(text, offset))
        return null;
    const word = getWordAt(text, offset);
    if (!word)
        return null;
    // 已知符号
    const meta = HOVER_INDEX.get(word);
    if (meta) {
        return { contents: { kind: node_1.MarkupKind.Markdown, value: (0, keywords_1.buildHoverDoc)(meta) } };
    }
    // 用户定义
    const { funcs, varTypes, symbols } = analyzeDocument(doc);
    for (const sym of symbols) {
        if (sym.name === word) {
            const detail = sym.detail ?? '';
            const t = varTypes.get(word);
            return {
                contents: {
                    kind: node_1.MarkupKind.Markdown,
                    value: `**${word}** _(${symbolKindLabel(sym.kind)})_` +
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
                    kind: node_1.MarkupKind.Markdown,
                    value: `**${word}** _(函数)_\n\n\`\`\`yscript\nfunc ${word}(${f.params.join(', ')})\n\`\`\``,
                },
            };
        }
    }
    return null;
});
function symbolKindLabel(k) {
    switch (k) {
        case node_1.SymbolKind.Function: return '函数';
        case node_1.SymbolKind.Variable: return '变量';
        case node_1.SymbolKind.Constant: return '常量';
        case node_1.SymbolKind.Class: return '类';
        case node_1.SymbolKind.Struct: return '结构体';
        case node_1.SymbolKind.Enum: return '枚举';
        case node_1.SymbolKind.Interface: return '接口';
        case node_1.SymbolKind.Namespace: return '命名空间';
        case node_1.SymbolKind.Package: return '包';
        case node_1.SymbolKind.Module: return '模块';
        case node_1.SymbolKind.Method: return '方法';
        case node_1.SymbolKind.Field: return '字段';
        default: return '符号';
    }
}
// ---------------- 补全 ----------------
connection.onCompletion((params) => {
    const { textDocument, position } = params;
    const doc = documents.get(textDocument.uri);
    if (!doc)
        return [];
    const text = doc.getText();
    const offset = positionToOffset(text, position);
    if (isInsideStringOrComment(text, offset))
        return [];
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
            { label: '"${1:path}"', kind: node_1.CompletionItemKind.Snippet, insertText: '"${1:path}"', detail: '模块路径' },
        ];
    }
    // 3. import / package 关键字后
    if (/(?:^|\n)\s*import\s*$/.test(beforeImport) || /(?:^|\n)\s*package\s*$/.test(beforeImport)) {
        return [
            { label: '"${1:path}"', kind: node_1.CompletionItemKind.Snippet, insertText: '"${1:path}"' },
        ];
    }
    // 4. 标准补全：关键字 + 类型 + 函数 + 局部符号
    const items = [];
    const seen = new Set();
    // 内置项
    for (const m of ALL_COMPLETIONS) {
        if (prefix && !m.label.toLowerCase().startsWith(prefix.toLowerCase()))
            continue;
        if (seen.has(m.label))
            continue;
        seen.add(m.label);
        items.push(metaToCompletion(m));
    }
    // 用户符号
    const { symbols, varTypes, funcs } = analyzeDocument(doc);
    for (const s of symbols) {
        if (prefix && !s.name.toLowerCase().startsWith(prefix.toLowerCase()))
            continue;
        if (seen.has(s.name))
            continue;
        seen.add(s.name);
        const k = s.kind === node_1.SymbolKind.Function ? node_1.CompletionItemKind.Function
            : s.kind === node_1.SymbolKind.Constant ? node_1.CompletionItemKind.Constant
                : s.kind === node_1.SymbolKind.Class ? node_1.CompletionItemKind.Class
                    : s.kind === node_1.SymbolKind.Struct ? node_1.CompletionItemKind.Struct
                        : s.kind === node_1.SymbolKind.Enum ? node_1.CompletionItemKind.Enum
                            : s.kind === node_1.SymbolKind.Interface ? node_1.CompletionItemKind.Interface
                                : s.kind === node_1.SymbolKind.Module ? node_1.CompletionItemKind.Module
                                    : node_1.CompletionItemKind.Variable;
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
                if (prefix && !p.toLowerCase().startsWith(prefix.toLowerCase()))
                    continue;
                if (seen.has(p))
                    continue;
                seen.add(p);
                items.push({
                    label: p,
                    kind: node_1.CompletionItemKind.Variable,
                    detail: `参数（${f.name}）`,
                });
            }
        }
    }
    return items;
});
/** `.` 触发的成员补全 */
function getMemberCompletions(doc, text, dotOffset) {
    // 向左扫描一个标识符
    let i = dotOffset - 1;
    while (i >= 0 && isIdentChar(text[i]))
        i--;
    const nameStart = i + 1;
    const receiver = text.slice(nameStart, dotOffset);
    if (!receiver)
        return [];
    // 解析类型
    const { varTypes } = analyzeDocument(doc);
    const type = varTypes.get(receiver);
    const members = [];
    // 若类型未知，给出通用 list/string 方法
    const candidateTypes = [];
    if (type)
        candidateTypes.push(type);
    if (candidateTypes.length === 0) {
        candidateTypes.push('list', 'string', 'dict', 'bytes', 'int', 'float', 'socket');
    }
    for (const t of candidateTypes) {
        const ms = TYPE_MEMBERS_BY_TYPE.get(t);
        if (!ms)
            continue;
        for (const m of ms) {
            members.push({
                label: m.label,
                kind: node_1.CompletionItemKind.Method,
                detail: m.detail,
                documentation: m.signature,
                insertText: m.insertText,
                insertTextFormat: m.insertText?.includes('$') ? node_1.InsertTextFormat.Snippet : node_1.InsertTextFormat.PlainText,
            });
        }
    }
    return members;
}
connection.onCompletionResolve((item) => {
    // 补全时若没设置 detail/documentation，resolve 阶段补充
    if (item.documentation)
        return item;
    const meta = HOVER_INDEX.get(item.label);
    if (meta) {
        if (!item.detail)
            item.detail = meta.detail;
        item.documentation = { kind: node_1.MarkupKind.Markdown, value: (0, keywords_1.buildHoverDoc)(meta) };
    }
    return item;
});
// ---------------- 跳转定义 ----------------
connection.onDefinition((params) => {
    const { textDocument, position } = params;
    const doc = documents.get(textDocument.uri);
    if (!doc)
        return null;
    const text = doc.getText();
    const offset = positionToOffset(text, position);
    if (isInsideStringOrComment(text, offset))
        return null;
    const word = getWordAt(text, offset);
    if (!word)
        return null;
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
connection.onDocumentSymbol((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc)
        return [];
    return analyzeDocument(doc).symbols;
});
// ---------------- 签名帮助 ----------------
connection.onSignatureHelp((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc)
        return null;
    const text = doc.getText();
    const offset = positionToOffset(text, params.position);
    // 找到左侧最近的 ( 且匹配的 func
    let depth = 0;
    let i = offset - 1;
    while (i > 0) {
        const ch = text[i];
        if (isInsideStringOrComment(text, i)) {
            i--;
            continue;
        }
        if (ch === ')')
            depth++;
        else if (ch === '(') {
            if (depth === 0)
                break;
            depth--;
        }
        i--;
    }
    if (i < 0 || text[i] !== '(')
        return null;
    // 提取函数名
    let j = i - 1;
    while (j >= 0 && (isIdentChar(text[j]) || text[j] === '.'))
        j--;
    const callName = text.slice(j + 1, i).trim();
    if (!callName)
        return null;
    // 参数索引
    let paramIdx = 0;
    let d2 = 0;
    for (let k = offset - 1; k > i; k--) {
        if (isInsideStringOrComment(text, k))
            continue;
        if (text[k] === ')')
            d2++;
        else if (text[k] === '(') {
            if (d2 > 0)
                d2--;
        }
        else if (text[k] === ',' && d2 === 0)
            paramIdx++;
    }
    // 查签名
    const meta = HOVER_INDEX.get(callName) ?? HOVER_INDEX.get(callName.split('.').pop() || '');
    if (!meta) {
        // 用户定义函数
        const { funcs } = analyzeDocument(doc);
        const f = funcs.get(callName);
        if (f) {
            const sig = {
                label: `${callName}(${f.params.map((p, i) => `${p}: T${i + 1}`).join(', ')})`,
                parameters: f.params.map((p, i) => node_1.ParameterInformation.create(`${p}: T${i + 1}`)),
            };
            return { signatures: [sig], activeSignature: 0, activeParameter: Math.min(paramIdx, f.params.length) };
        }
        return null;
    }
    const signature = metaSignature(meta);
    const sig = {
        label: signature,
        parameters: signature.match(/[A-Za-z_][A-Za-z0-9_]*\s*\??/g)?.slice(0, 3).map(p => node_1.ParameterInformation.create(p)) ?? [],
    };
    return { signatures: [sig], activeSignature: 0, activeParameter: paramIdx };
});
/** 从补全元数据推导函数签名 */
function metaSignature(m) {
    if (m.signature)
        return m.signature;
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
connection.onDocumentFormatting((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc)
        return [];
    return formatYScript(doc.getText(), params.options.tabSize ?? 4);
});
connection.onDocumentRangeFormatting((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc)
        return [];
    return formatYScript(doc.getText(), params.options.tabSize ?? 4);
});
/** YScript 格式化：核心逻辑在 lexer.ts 的 formatSource（词法 token 感知） */
function formatYScript(text, tabSize) {
    const newText = (0, lexer_1.formatSource)(text, tabSize);
    if (newText === text)
        return [];
    return [
        node_1.TextEdit.replace({ start: { line: 0, character: 0 }, end: offsetToPosition(text, text.length) }, newText),
    ];
}
// ---------------- 补全元数据转换 ----------------
function metaToCompletion(m) {
    const isSnippet = m.kind === 'snippet' || (m.insertText?.includes('$') ?? false);
    return {
        label: m.label,
        kind: completionKind(m.kind),
        detail: m.detail,
        documentation: m.signature ? { kind: node_1.MarkupKind.Markdown, value: (0, keywords_1.buildHoverDoc)(m) } : m.documentation,
        insertText: m.insertText ?? m.label,
        insertTextFormat: isSnippet ? node_1.InsertTextFormat.Snippet : node_1.InsertTextFormat.PlainText,
        sortText: String(m.sortKey ?? 50).padStart(4, '0') + '_' + m.label,
        filterText: m.label,
    };
}
function completionKind(k) {
    switch (k) {
        case 'keyword': return node_1.CompletionItemKind.Keyword;
        case 'type': return node_1.CompletionItemKind.TypeParameter;
        case 'constant': return node_1.CompletionItemKind.Constant;
        case 'builtin': return node_1.CompletionItemKind.Function;
        case 'method': return node_1.CompletionItemKind.Method;
        case 'property': return node_1.CompletionItemKind.Property;
        case 'snippet': return node_1.CompletionItemKind.Snippet;
        case 'function': return node_1.CompletionItemKind.Function;
        case 'variable': return node_1.CompletionItemKind.Variable;
        case 'field': return node_1.CompletionItemKind.Field;
        case 'class': return node_1.CompletionItemKind.Class;
        case 'struct': return node_1.CompletionItemKind.Struct;
        case 'enum': return node_1.CompletionItemKind.Enum;
        case 'interface': return node_1.CompletionItemKind.Interface;
        case 'module': return node_1.CompletionItemKind.Module;
        default: return node_1.CompletionItemKind.Text;
    }
}
// ---------------- 启动 ----------------
documents.listen(connection);
connection.listen();
//# sourceMappingURL=server.js.map