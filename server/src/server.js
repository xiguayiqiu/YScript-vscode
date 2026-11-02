"use strict";
/**
 * YScript LSP Server
 *
 * 提供：诊断、悬停、补全、跳转定义、文档符号、格式化、签名帮助。
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("vscode-languageserver/node");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const url_1 = require("url");
const project_imports_1 = require("./project_imports");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const lexer_1 = require("./lexer");
const syntax_1 = require("./syntax");
const keywords_1 = require("./keywords");
const ns_members_1 = require("./ns_members");
const imports_1 = require("./imports");
const connection = (0, node_1.createConnection)();
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
const ALL_COMPLETIONS = (0, keywords_1.buildAllCompletions)();
const TERM_GROUPS = new Set(['env', 'cap', 'io', 'input', 'screen', 'output', 'style', 'text', 'ansi']);
const COLOR_PRINT_METHODS = [
    { name: 'red', detail: '红色输出' },
    { name: 'green', detail: '绿色输出' },
    { name: 'blue', detail: '蓝色输出' },
    { name: 'yellow', detail: '黄色输出' },
    { name: 'cyan', detail: '青色输出' },
    { name: 'magenta', detail: '品红色输出' },
    { name: 'white', detail: '白色输出' },
];
const HOVER_INDEX = new Map();
for (const m of ALL_COMPLETIONS) {
    HOVER_INDEX.set(m.label, m);
}
for (const [namespace, members] of Object.entries(ns_members_1.NS_MEMBERS)) {
    for (const name of members) {
        const label = `${namespace}.${name}`;
        const existing = HOVER_INDEX.get(label);
        if (existing) {
            existing.signature ?? (existing.signature = keywords_1.STDLIB_SIGNATURES[label]);
            continue;
        }
        const signature = keywords_1.STDLIB_SIGNATURES[label] ?? `${label}(...args)`;
        HOVER_INDEX.set(label, {
            label,
            kind: 'builtin',
            detail: `${namespace} 标准库函数`,
            signature,
            documentation: `调用形式：\`${signature}\`。\n\n` +
                `更多示例及参数说明请查看 [YScript 标准库函数速查表](https://github.com/xiguayiqiu/YScript/wiki/函数速查表)。`,
        });
    }
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
                triggerCharacters: ['.', ':', ' ', '"', '`', '/', '#', '!', '_', '>', ...'abcdefghijklmnopqrstuvwxyz'],
            },
            definitionProvider: true,
            codeActionProvider: true,
            documentSymbolProvider: true,
            semanticTokensProvider: {
                legend: {
                    tokenTypes: ['variable', 'function'],
                    tokenModifiers: ['declaration', 'readonly', 'defaultLibrary'],
                },
                full: true,
            },
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
function getWordStart(text, offset) {
    let start = Math.min(offset, text.length);
    while (start > 0 && /[A-Za-z0-9_]/.test(text[start - 1]))
        start--;
    return start;
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
/**
 * 前缀匹配：除前缀外还允许子串命中，
 * 如输入 `file` 也能补出 `io.read_file`、`write_file` 等。
 */
function matchesPrefix(label, prefix) {
    if (!prefix)
        return true;
    const lower = label.toLowerCase();
    const p = prefix.toLowerCase();
    return lower.startsWith(p) || lower.includes(p);
}
/** 取尾部标识符（用于类型上下文中冒号/空格之后已输入的部分）。 */
function trailingWord(text) {
    return /([A-Za-z_][A-Za-z0-9_]*)$/.exec(text)?.[1] ?? '';
}
function collectVariableDeclarations(tokens) {
    const declarations = new Map();
    const isName = (index) => ['identifier', 'builtin', 'type'].includes(tokens[index]?.type ?? '');
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.type === 'keyword' && ['let', 'var', 'const'].includes(token.value)) {
            let target = i + 1;
            while (isName(target)) {
                declarations.set(target, token.value);
                if (tokens[target + 1]?.value !== ',')
                    break;
                target += 2;
            }
            continue;
        }
        if (!isName(i))
            continue;
        const targets = [i];
        let next = i + 1;
        while (tokens[next]?.value === ',' && isName(next + 1)) {
            targets.push(next + 1);
            next += 2;
        }
        if (tokens[next]?.value === '<-') {
            for (const tokenIndex of targets)
                declarations.set(tokenIndex, 'let');
        }
    }
    return Array.from(declarations, ([tokenIndex, kind]) => ({ tokenIndex, kind }));
}
// ---------------- 文档符号 + 作用域分析 ----------------
/** 从源码中提取作用域（粗略：找 func/init 后匹配的 { ... } 块） */
function analyzeDocument(doc) {
    const text = doc.getText();
    const symbols = [];
    const scopes = [];
    const funcs = new Map();
    const varTypes = new Map();
    const structs = new Map();
    const enums = new Map();
    const funcReturnTypes = new Map();
    const lines = text.split('\n');
    const tokens = (0, lexer_1.tokenize)(text);
    const variableDeclarations = collectVariableDeclarations(tokens);
    // 2. Extract declarations from tokens so comments and multiline signatures do not affect symbols.
    let lastStructName = '';
    let braceDepth = 0;
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.type === 'comment')
            continue;
        if (token.value === '{') {
            braceDepth++;
            continue;
        }
        if (token.value === '}') {
            braceDepth = Math.max(0, braceDepth - 1);
            continue;
        }
        if (braceDepth !== 0)
            continue;
        if (token.value === 'struct' || token.value === 'class') {
            const typeName = tokens[i + 1];
            if (typeName?.type === 'identifier' || typeName?.type === 'builtin' || typeName?.type === 'type') {
                lastStructName = typeName.value;
                const bounds = findBlockBounds(tokens, i + 2);
                if (bounds) {
                    const body = text.slice(tokens[bounds.open].end, tokens[bounds.close].start);
                    structs.set(typeName.value, {
                        name: typeName.value,
                        fields: parseStructFields(body, tokens[bounds.open].end, text, doc.uri),
                        parent: findStructParent(tokens, i + 2, bounds.open),
                        uri: doc.uri,
                    });
                }
            }
            continue;
        }
        if (token.value === 'enum') {
            const typeName = tokens[i + 1];
            if (typeName?.type === 'identifier' || typeName?.type === 'builtin' || typeName?.type === 'type') {
                const bounds = findBlockBounds(tokens, i + 2);
                if (bounds) {
                    const body = text.slice(tokens[bounds.open].end, tokens[bounds.close].start);
                    enums.set(typeName.value, {
                        name: typeName.value,
                        members: parseEnumMembers(body),
                        uri: doc.uri,
                    });
                }
            }
            continue;
        }
        if (token.value !== 'func' && token.value !== 'init')
            continue;
        const kind = token.value;
        let nameIndex = i + 1;
        let isMethod = false;
        if (kind === 'func' && tokens[nameIndex]?.value === 'this' && tokens[nameIndex + 1]?.value === '.') {
            isMethod = true;
            nameIndex += 2;
        }
        const nameToken = kind === 'init' ? token : tokens[nameIndex];
        if (!nameToken || (kind === 'func' && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(nameToken.value)))
            continue;
        const openParen = kind === 'init' ? i + 1 : nameIndex + 1;
        if (tokens[openParen]?.value !== '(')
            continue;
        const closeParen = matchingTokenIndex(tokens, openParen, '(', ')');
        if (closeParen < 0)
            continue;
        const params = splitParameterList(text.slice(tokens[openParen].end, tokens[closeParen].start));
        let bodyOpen = closeParen + 1;
        while (bodyOpen < tokens.length && tokens[bodyOpen].value !== '{' &&
            tokens[bodyOpen].value !== ';' && tokens[bodyOpen].line <= (tokens[closeParen].line + 1))
            bodyOpen++;
        const bodyClose = tokens[bodyOpen]?.value === '{'
            ? matchingTokenIndex(tokens, bodyOpen, '{', '}')
            : -1;
        const bodyStartLine = bodyClose >= 0 ? tokens[bodyOpen].line : token.line;
        const bodyEndLine = bodyClose >= 0 ? tokens[bodyClose].line : token.line;
        const returnType = findReturnType(tokens, closeParen + 1, bodyOpen);
        const lineIndex = token.line - 1;
        const name = kind === 'init' ? 'init' : nameToken.value;
        const startChar = nameToken.col - 1;
        const start = { line: nameToken.line - 1, character: startChar };
        const end = { line: nameToken.line - 1, character: startChar + name.length };
        const owner = isMethod ? lastStructName : undefined;
        symbols.push({
            name: kind === 'init' ? 'init()' : owner ? `${owner}.${name}` : name,
            kind: owner ? node_1.SymbolKind.Method : node_1.SymbolKind.Function,
            range: {
                start: { line: lineIndex, character: 0 },
                end: {
                    line: Math.max(lineIndex, bodyEndLine - 1),
                    character: lines[Math.max(lineIndex, bodyEndLine - 1)]?.length ?? 0,
                },
            },
            selectionRange: { start, end },
            detail: kind === 'init'
                ? 'init()'
                : `func ${owner ? 'this.' : ''}${name}(${text.slice(tokens[openParen].end, tokens[closeParen].start).trim()})`,
            children: [],
        });
        if (kind === 'func') {
            const key = owner ? `${owner}.${name}` : name;
            funcs.set(key, {
                name,
                params,
                documentation: extractNamedFunctionDocumentation(text, name),
                methodOwner: owner,
                returnType,
                uri: doc.uri,
                declLine: nameToken.line - 1,
                declChar: startChar,
                declEndChar: startChar + name.length,
                bodyStartLine: bodyStartLine - 1,
                bodyEndLine: bodyEndLine - 1,
            });
            if (returnType)
                funcReturnTypes.set(key, returnType);
        }
    }
    // 1. 收集变量类型（依赖函数返回类型，故在声明索引之后进行）
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const inferredDecl = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*<-\s*/.exec(line);
        const inferenceLine = inferredDecl
            ? line.replace('<-', '=')
            : line;
        // 显式类型标注: let x: int = ...
        const m2 = /^\s*(let|const|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_<>,\s]*?)\s*=/.exec(line);
        if (m2) {
            varTypes.set(m2[2], m2[3].trim().split(/\s/)[0]);
            continue;
        }
        const m = /^\s*(let|const|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*[:=]/.exec(line);
        const name = m?.[2] ?? inferredDecl?.[1];
        if (!name)
            continue;
        // 结构体字面量: let p = Point{...}
        const structLiteral = /^\s*(?:(?:let|const|var)\s+)?[A-Za-z_][A-Za-z0-9_]*\s*(?::[^=]+)?=\s*([A-Za-z_][A-Za-z0-9_]*)\s*\{/.exec(inferenceLine);
        if (structLiteral) {
            varTypes.set(name, structLiteral[1]);
            continue;
        }
        // new Type()
        const newMatch = /=\s*new\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(inferenceLine);
        if (newMatch) {
            varTypes.set(name, newMatch[1]);
            continue;
        }
        // 函数调用返回值: let x = makePoint() / let x = this.makePoint()
        const callMatch = /=\s*([A-Za-z_][A-Za-z0-9_.]*)\s*\(/.exec(inferenceLine);
        if (callMatch) {
            const funcName = callMatch[1];
            const returnTypeOf = funcReturnTypes.get(funcName)
                ?? funcReturnTypes.get(funcName.split('.').pop() ?? funcName);
            if (returnTypeOf) {
                varTypes.set(name, returnTypeOf);
                continue;
            }
        }
        for (const rule of keywords_1.TYPE_INFERENCE_RULES) {
            if (rule.regex.test(inferenceLine)) {
                varTypes.set(name, rule.type);
                break;
            }
        }
    }
    // 1.5 函数参数类型：`func f(s: string)` 内的 `s.` 能直接补全 string 成员
    for (const func of funcs.values()) {
        for (const param of func.params) {
            const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/.exec(param);
            if (!m || varTypes.has(m[1]))
                continue;
            varTypes.set(m[1], normalizeTypeName(m[2]));
        }
    }
    // 3. Index each name in variable declarations, including multi-name declarations.
    for (const declaration of variableDeclarations) {
        const token = tokens[declaration.tokenIndex];
        const start = { line: token.line - 1, character: token.col - 1 };
        const end = { line: token.line - 1, character: token.col - 1 + token.value.length };
        symbols.push({
            name: token.value,
            kind: declaration.kind === 'const' ? node_1.SymbolKind.Constant : node_1.SymbolKind.Variable,
            range: { start, end },
            selectionRange: { start, end },
            detail: varTypes.get(token.value) ? `let ${token.value}: ${varTypes.get(token.value)}` : token.value,
        });
    }
    // 4. Types, imports and package symbols.
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        let m = /^(struct|class|enum|interface)\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(trimmed);
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
    return { symbols, scopes, funcs, varTypes, structs, enums, funcReturnTypes };
}
/** 找到一个声明体的 `{ ... }` 边界（用于 struct/class/enum）。 */
function findBlockBounds(tokens, fromIndex) {
    const stop = new Set(['func', 'struct', 'class', 'enum', 'interface', 'import', 'package', 'let', 'const', 'var', 'return', 'if', 'for', 'while']);
    let open = -1;
    for (let i = fromIndex; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.value === '{') {
            open = i;
            break;
        }
        if (token.value === ';')
            return null;
        if (token.type === 'keyword' && stop.has(token.value))
            return null;
    }
    if (open < 0)
        return null;
    const close = matchingTokenIndex(tokens, open, '{', '}');
    return close < 0 ? null : { open, close };
}
/** 读取 `struct X extends Parent {` 中的 Parent。 */
function findStructParent(tokens, fromIndex, openIndex) {
    for (let i = fromIndex; i < openIndex; i++) {
        if (tokens[i].value !== 'extends')
            continue;
        const parent = tokens[i + 1];
        if (parent && (parent.type === 'identifier' || parent.type === 'builtin' || parent.type === 'type')) {
            return parent.value;
        }
    }
    return undefined;
}
/** 读取 `func name(...) -> Type {` 中的返回类型。 */
function findReturnType(tokens, fromIndex, toIndex) {
    for (let i = fromIndex; i < toIndex && i < tokens.length; i++) {
        if (tokens[i].value !== '->')
            continue;
        const type = tokens[i + 1];
        if (type && (type.type === 'identifier' || type.type === 'builtin' || type.type === 'type')) {
            return type.value;
        }
        return undefined;
    }
    return undefined;
}
/** 去掉注释内容（等长替换，保留换行与列位置），供结构体/枚举体解析使用。 */
function stripBlockComments(source) {
    let out = '';
    let quote = '';
    let lineComment = false;
    let blockComment = false;
    for (let i = 0; i < source.length; i++) {
        const c = source[i];
        const next = source[i + 1];
        if (lineComment) {
            if (c === '\n') {
                lineComment = false;
                out += '\n';
            }
            else
                out += ' ';
            continue;
        }
        if (blockComment) {
            if (c === '*' && next === '#') {
                blockComment = false;
                out += '  ';
                i++;
            }
            else
                out += c === '\n' ? '\n' : ' ';
            continue;
        }
        if (quote) {
            out += c;
            if (c === '\\') {
                out += next ?? '';
                i++;
            }
            else if (c === quote)
                quote = '';
            continue;
        }
        if (c === '"' || c === "'" || c === '`') {
            quote = c;
            out += c;
            continue;
        }
        if (c === '#' && next === '*') {
            blockComment = true;
            out += '  ';
            i++;
            continue;
        }
        if (c === '#') {
            lineComment = true;
            out += ' ';
            continue;
        }
        out += c;
    }
    return out;
}
/** 在深度 0 处按逗号/换行拆分（忽略括号与尖括号内的分隔符）。 */
function splitTopLevelMembers(source) {
    const parts = [];
    let depth = 0;
    let quote = '';
    let start = 0;
    for (let i = 0; i < source.length; i++) {
        const c = source[i];
        if (quote) {
            if (c === '\\')
                i++;
            else if (c === quote)
                quote = '';
            continue;
        }
        if (c === '"' || c === "'" || c === '`') {
            quote = c;
            continue;
        }
        if (c === '(' || c === '[' || c === '{' || c === '<')
            depth++;
        else if (c === ')' || c === ']' || c === '}' || c === '>')
            depth = Math.max(0, depth - 1);
        else if ((c === ',' || c === '\n') && depth === 0) {
            parts.push(source.slice(start, i));
            start = i + 1;
        }
    }
    parts.push(source.slice(start));
    return parts.map((p) => p.trim()).filter(Boolean);
}
/** 解析结构体 body 中的字段：`name: type [= default]`。 */
function parseStructFields(body, bodyStart, text, uri) {
    const fields = [];
    const clean = stripBlockComments(body);
    const seen = new Set();
    let cursor = 0;
    for (const part of splitTopLevelMembers(clean)) {
        const idx = clean.indexOf(part, cursor);
        if (idx >= 0)
            cursor = idx + part.length;
        const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([\s\S]+)$/.exec(part);
        if (!m)
            continue;
        const fieldName = m[1];
        if (seen.has(fieldName))
            continue;
        seen.add(fieldName);
        const type = m[2].replace(/\s*=[\s\S]*$/, '').trim();
        const nameOffset = (idx >= 0 ? idx : 0) + part.indexOf(fieldName);
        const pos = offsetToPosition(text, bodyStart + nameOffset);
        fields.push({
            name: fieldName,
            type,
            detail: `${fieldName}: ${type}`,
            uri,
            declLine: pos.line,
            declChar: pos.character,
            declEndChar: pos.character + fieldName.length,
        });
    }
    return fields;
}
/** 解析枚举 body 中的成员名（`A` / `B = 2` / `C = "x"`）。 */
function parseEnumMembers(body) {
    const members = [];
    for (const part of splitTopLevelMembers(stripBlockComments(body))) {
        const m = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(part);
        if (m)
            members.push(m[1]);
    }
    return members;
}
/** 去掉类型名的泛型参数：`list<T>` → `list`。 */
function normalizeTypeName(type) {
    const base = type.trim().replace(/\s*<.*$/, '').trim();
    return base.replace(/^[?@>]+/, '');
}
/** 沿继承链查找字段信息。 */
function findFieldInfo(typeName, fieldName, structs) {
    const seen = new Set();
    let current = structs.get(normalizeTypeName(typeName));
    while (current && !seen.has(current.name)) {
        seen.add(current.name);
        const field = current.fields.find((f) => f.name === fieldName);
        if (field)
            return field;
        current = current.parent ? structs.get(current.parent) : undefined;
    }
    return undefined;
}
/** 沿继承链查找字段类型。 */
function findFieldType(typeName, fieldName, structs) {
    const field = findFieldInfo(typeName, fieldName, structs);
    return field ? normalizeTypeName(field.type) : undefined;
}
/** 收集结构体自身及继承链上的全部字段（自身优先）。 */
function collectStructFields(typeName, structs) {
    const out = [];
    const seenTypes = new Set();
    const seenFields = new Set();
    let current = structs.get(normalizeTypeName(typeName));
    while (current && !seenTypes.has(current.name)) {
        seenTypes.add(current.name);
        for (const field of current.fields) {
            if (seenFields.has(field.name))
                continue;
            seenFields.add(field.name);
            out.push(field);
        }
        current = current.parent ? structs.get(current.parent) : undefined;
    }
    return out;
}
/** 收集结构体自身及继承链（自身在前），用于补全/查找继承的方法。 */
function collectStructMethodOwners(typeName, structs) {
    const owners = [];
    const seen = new Set();
    let current = structs.get(normalizeTypeName(typeName));
    while (current && !seen.has(current.name)) {
        seen.add(current.name);
        owners.push(current.name);
        current = current.parent ? structs.get(current.parent) : undefined;
    }
    return owners;
}
/**
 * 解析接收者的类型，支持链式访问：
 *   p        -> varTypes['p']
 *   this     -> 当前方法所属结构体
 *   pkt.ip   -> Packet.ip 的字段类型 IPHeader
 *   Color    -> 结构体/枚举名本身
 */
function resolveReceiverType(receiver, varTypes, structs, contextOwner) {
    if (receiver === 'this' || receiver === 'self')
        return contextOwner;
    const parts = receiver.split('.').filter(Boolean);
    if (parts.length === 0)
        return undefined;
    const first = parts[0];
    let current = varTypes.get(first) ?? (structs.has(first) ? first : undefined);
    for (let i = 1; i < parts.length && current; i++) {
        current = findFieldType(current, parts[i], structs);
    }
    return current;
}
function extractNamedFunctionDocumentation(source, name) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lines = source.split('\n');
    const startPattern = new RegExp(`^\\s*@${escapedName}\\s+HEAD\\s*$`);
    const endPattern = new RegExp(`^\\s*@${escapedName}\\s+END\\s*$`);
    const start = lines.findIndex((line) => startPattern.test(line));
    if (start < 0)
        return undefined;
    const end = lines.findIndex((line, index) => index > start && endPattern.test(line));
    if (end < 0)
        return undefined;
    const documentation = lines
        .slice(start + 1, end)
        .map((line) => line.replace(/^\s*# ?/, '').trimEnd())
        .join('\n')
        .trim();
    return documentation || undefined;
}
function formatFunctionDocumentation(func, kind) {
    const signature = `func ${func.methodOwner ? 'this.' : ''}${func.name}(${func.params.join(', ')})`;
    return `**${func.name}** _(${kind})_\n\n\`\`\`yscript\n${signature}\n\`\`\`` +
        (func.documentation ? `\n\n${func.documentation}` : '');
}
function matchingTokenIndex(tokens, start, open, close) {
    let depth = 0;
    for (let i = start; i < tokens.length; i++) {
        if (tokens[i].value === open)
            depth++;
        else if (tokens[i].value === close) {
            depth--;
            if (depth === 0)
                return i;
        }
    }
    return -1;
}
// ---------------- 诊断 ----------------
function topLevelCodeDiagnostics(text, tokens) {
    const out = [];
    const declarationStarts = new Set([
        'func', 'init', 'struct', 'class', 'enum', 'interface',
    ]);
    let braceDepth = 0;
    let declarationHeader = false;
    let ignoredLine = -1;
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const value = token.value;
        if (token.type === 'comment')
            continue;
        if (ignoredLine !== -1) {
            if (token.line === ignoredLine) {
                if (value === ';')
                    ignoredLine = -1;
                continue;
            }
            ignoredLine = -1;
        }
        if (braceDepth > 0) {
            if (value === '{')
                braceDepth++;
            else if (value === '}')
                braceDepth--;
            continue;
        }
        if (declarationHeader) {
            if (value === '{') {
                braceDepth = 1;
                declarationHeader = false;
            }
            continue;
        }
        if (value === ';')
            continue;
        if (value === 'package' || value === 'using') {
            ignoredLine = token.line;
            continue;
        }
        if (value === 'import') {
            if (tokens[i + 1]?.value === '[') {
                let depth = 0;
                for (let j = i + 1; j < tokens.length; j++) {
                    if (tokens[j].value === '[')
                        depth++;
                    else if (tokens[j].value === ']')
                        depth--;
                    if (depth === 0) {
                        i = j;
                        break;
                    }
                }
            }
            else {
                ignoredLine = token.line;
            }
            continue;
        }
        if (declarationStarts.has(value)) {
            declarationHeader = true;
            continue;
        }
        if (value === 'let' || value === 'const') {
            let parens = 0;
            let brackets = 0;
            let braces = 0;
            let previous = token;
            for (let j = i + 1; j < tokens.length; j++) {
                const next = tokens[j];
                if (parens === 0 && brackets === 0 && braces === 0) {
                    if (next.value === ';') {
                        i = j;
                        break;
                    }
                    const canEndExpression = (previous.type !== 'keyword' &&
                        ['identifier', 'type', 'builtin', 'literal', 'number', 'string', 'regexp', 'shell', 'bytes'].includes(previous.type)) || [')', ']', '}'].includes(previous.value);
                    if (next.line > previous.line && canEndExpression &&
                        ![',', '.', '?.', '+', '-', '*', '/', '%', '==', '!=', '<', '>', '<=', '>=', '&&', '||', '|>', '=', '<-', ':'].includes(next.value)) {
                        i = j - 1;
                        break;
                    }
                }
                if (next.value === '(')
                    parens++;
                else if (next.value === ')')
                    parens--;
                else if (next.value === '[')
                    brackets++;
                else if (next.value === ']')
                    brackets--;
                else if (next.value === '{')
                    braces++;
                else if (next.value === '}')
                    braces--;
                previous = next;
                i = j;
            }
            continue;
        }
        out.push({
            range: {
                start: offsetToPosition(text, token.start),
                end: offsetToPosition(text, token.end),
            },
            message: value === 'var'
                ? 'var 只能用于函数内部声明局部变量，顶层请用 let'
                : '顶层不能执行语句，请在 package main 的 func main() 或其他函数内编写',
            severity: node_1.DiagnosticSeverity.Error,
            source: 'yscript',
        });
        ignoredLine = token.line;
    }
    return out;
}
const PERMISSION_APIS = {
    file_read: {
        io: ['read_file', 'read_bytes', 'read_lines', 'read_with', 'read_with_size'],
        binary: ['ReadFile'],
        raw: ['PcapReadFile'],
    },
    file_write: {
        io: ['write_file', 'write_bytes', 'append_file', 'create'],
        binary: ['WriteFile', 'AppendFile'],
        raw: ['PcapWriteFile'],
        sys: ['file_truncate'],
    },
    exec: {
        os: ['exec', 'exec_shell', 'shell', 'shell_background'],
        sys: ['exec', 'process_start', 'process_replace'],
    },
    network: {
        net: [
            'Accept', 'DialTCP', 'DialTimeout', 'DialUDP', 'Listen', 'LookupAddr',
            'LookupHost', 'LookupMX', 'LookupNS', 'LookupPort', 'LookupSRV',
            'LookupTXT', 'ResolveTCP', 'ResolveUDP', 'StartTLS', 'UpgradeTLS',
            'dial', 'dial_tcp', 'dial_udp', 'listen_tcp', 'nginx', 'start_tls',
            'udp_bind', 'udp_dial', 'upgrade_tls',
        ],
        http: [
            'Delete', 'Do', 'Download', 'Form', 'Get', 'Head', 'Options', 'Patch',
            'Post', 'Put', 'Request', 'Server', 'Upload', 'http_get', 'http_post',
            'http_request',
        ],
        socket: ['Socket', 'port_scan', 'tcp_probe', 'tcp_request', 'tls_request', 'udp_request'],
        raw: ['OpenSocket', 'PcapOpen', 'PcapNext', 'Receive', 'Send'],
        ssl: [
            'Close', 'Connect', 'ConnectionState', 'GetServerCertificate', 'Read',
            'WrapSocket', 'Write',
        ],
    },
};
function declaredPermissionCategories(text) {
    const categories = new Set();
    for (const line of text.split(/\r?\n/)) {
        const match = /^\s*#!permit\s+(.+?)\s*$/.exec(line);
        if (!match)
            continue;
        for (const item of match[1].split(',')) {
            const category = item.trim().split(':', 1)[0].toLowerCase();
            if (category)
                categories.add(category);
        }
    }
    return categories;
}
function permissionDiagnostics(text, tokens) {
    const declared = declaredPermissionCategories(text);
    const hasPermitDirective = /^\s*#!permit\s+/m.test(text);
    const uses = new Map();
    const allPermissions = declared.has('all');
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.type === 'shell') {
            if (!uses.has('exec'))
                uses.set('exec', { line: token.line, start: token.start, end: token.end });
            continue;
        }
        if (token.type === 'comment' || tokens[i + 1]?.value !== '.' || !tokens[i + 2])
            continue;
        const namespace = token.value;
        const member = tokens[i + 2].value;
        for (const [category, namespaces] of Object.entries(PERMISSION_APIS)) {
            if (!namespaces[namespace]?.includes(member))
                continue;
            if (!uses.has(category)) {
                uses.set(category, { line: token.line, start: token.start, end: tokens[i + 2].end });
            }
        }
    }
    const out = [];
    for (const [category, use] of uses) {
        if (allPermissions || declared.has(category))
            continue;
        out.push({
            range: {
                start: offsetToPosition(text, use.start),
                end: offsetToPosition(text, use.end),
            },
            message: hasPermitDirective
                ? `#!permit 策略未声明 ${category} 权限；此调用可能被沙箱拦截`
                : `检测到 ${category} 敏感操作；默认不启用沙箱，添加 #!permit 可限制此类操作范围`,
            severity: hasPermitDirective ? node_1.DiagnosticSeverity.Warning : node_1.DiagnosticSeverity.Information,
            source: 'yscript-permissions',
            data: { permissionCategory: category },
        });
    }
    return out;
}
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
    for (const d of (0, syntax_1.syntaxDiagnostics)(tokens)) {
        out.push({
            range: d.range,
            message: d.message,
            severity: node_1.DiagnosticSeverity.Error,
            source: d.source,
        });
    }
    for (const d of (0, syntax_1.unusedVariableDiagnostics)(tokens)) {
        out.push({
            range: d.range,
            message: d.message,
            severity: node_1.DiagnosticSeverity.Warning,
            source: d.source,
        });
    }
    const seenFunctionNames = new Set();
    for (const symbol of analyzeDocument(doc).symbols) {
        if (symbol.kind !== node_1.SymbolKind.Function)
            continue;
        if (seenFunctionNames.has(symbol.name)) {
            out.push({
                range: symbol.selectionRange,
                message: `当前文件重复声明函数 "${symbol.name}"`,
                severity: node_1.DiagnosticSeverity.Error,
                source: 'yscript',
            });
        }
        else {
            seenFunctionNames.add(symbol.name);
        }
    }
    // 2. 普通源文件只允许声明出现在顶层，逻辑必须写在函数体内。
    out.push(...topLevelCodeDiagnostics(text, tokens));
    // 3. 敏感操作与 #!permit 策略提示
    out.push(...permissionDiagnostics(text, tokens));
    // 4. 校验第三方导入路径，便于在没有 ysc -c 的情况下发现无效库引用。
    const imports = (0, imports_1.parseImports)(text);
    const invalidShorthandPaths = new Set();
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].value !== 'import' || tokens[i + 1]?.type !== 'string')
            continue;
        const path = tokens[i + 1].value.slice(1, -1).replace(/\\(["'\\])/g, '$1');
        if (ns_members_1.ALL_NAMESPACES.includes(path.toLowerCase()) || (0, ns_members_1.isStdModule)(path))
            continue;
        invalidShorthandPaths.add(path);
        out.push({
            range: {
                start: offsetToPosition(text, tokens[i + 1].start),
                end: offsetToPosition(text, tokens[i + 1].end),
            },
            message: '单模块 import 只支持标准库；导入脚本库请使用 import ["路径"]',
            severity: node_1.DiagnosticSeverity.Error,
            source: 'yscript',
        });
    }
    for (const importPath of imports.projectPaths) {
        if (invalidShorthandPaths.has(importPath))
            continue;
        if (doc.uri.startsWith('untitled:'))
            continue;
        if ((0, project_imports_1.resolveProjectImportFiles)(importPath, doc.uri).length > 0)
            continue;
        const token = tokens.find((item) => item.type === 'string' && item.value.slice(1, -1).replace(/\\(["'\\])/g, '$1') === importPath);
        if (!token)
            continue;
        out.push({
            range: {
                start: offsetToPosition(text, token.start),
                end: offsetToPosition(text, token.end),
            },
            message: `无法解析脚本库导入 "${importPath}"；请检查相对路径、库目录或 YSC_PKG_DIR`,
            severity: node_1.DiagnosticSeverity.Error,
            source: 'yscript',
        });
    }
    if (!doc.uri.startsWith('untitled:')) {
        const ownFunctions = new Set([...analyzeDocument(doc).funcs.values()]
            .filter((func) => !func.methodOwner)
            .map((func) => func.name));
        const functionOwners = new Map();
        const reportedConflicts = new Set();
        const seenFiles = new Set();
        for (const importPath of imports.projectPaths) {
            for (const filePath of (0, project_imports_1.resolveProjectImportFiles)(importPath, doc.uri)) {
                if (seenFiles.has(filePath))
                    continue;
                seenFiles.add(filePath);
                let source;
                try {
                    source = fs.readFileSync(filePath, 'utf8');
                }
                catch {
                    continue;
                }
                const importedDoc = vscode_languageserver_textdocument_1.TextDocument.create((0, url_1.pathToFileURL)(filePath).toString(), 'yscript', 1, source);
                for (const symbol of analyzeDocument(importedDoc).symbols) {
                    if (symbol.kind !== node_1.SymbolKind.Function)
                        continue;
                    const previousOwner = ownFunctions.has(symbol.name)
                        ? '当前文件'
                        : functionOwners.get(symbol.name);
                    if (!previousOwner) {
                        functionOwners.set(symbol.name, importPath);
                        continue;
                    }
                    const conflictKey = `${importPath}\0${symbol.name}`;
                    if (reportedConflicts.has(conflictKey))
                        continue;
                    reportedConflicts.add(conflictKey);
                    const token = tokens.find((item) => item.type === 'string' && item.value.slice(1, -1).replace(/\\(["'\\])/g, '$1') === importPath);
                    if (!token)
                        continue;
                    out.push({
                        range: {
                            start: offsetToPosition(text, token.start),
                            end: offsetToPosition(text, token.end),
                        },
                        message: `导入函数 "${symbol.name}" 与 ${previousOwner} 的同名函数冲突；请重命名其中一个函数`,
                        severity: node_1.DiagnosticSeverity.Error,
                        source: 'yscript',
                    });
                }
            }
        }
    }
    // 5. 未导入的标准库：给出可一键修复的提示
    for (const u of (0, imports_1.findUnimportedUses)(text, imports)) {
        out.push({
            range: {
                start: { line: u.line, character: u.character },
                end: { line: u.line, character: u.endCharacter },
            },
            message: `未导入模块 "${u.module}"，请先写 import ["${u.module}"]` +
                `（或用快速修复自动添加）`,
            severity: node_1.DiagnosticSeverity.Warning,
            source: 'yscript',
            // data 供 onCodeAction 取用
            data: { module: u.module, ns: u.ns },
        });
    }
    return out;
}
// ---------------- 快速修复：自动补 import ----------------
connection.onCodeAction((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc)
        return [];
    const text = doc.getText();
    const actions = [];
    for (const diag of params.context.diagnostics) {
        const data = diag.data;
        if (data?.permissionCategory) {
            const category = data.permissionCategory;
            const declared = declaredPermissionCategories(text);
            if (declared.has('all') || declared.has(category))
                continue;
            const firstLine = text.split(/\r?\n/, 1)[0];
            const insertLine = /^#!\s*\//.test(firstLine) ? 1 : 0;
            const edit = {
                range: {
                    start: { line: insertLine, character: 0 },
                    end: { line: insertLine, character: 0 },
                },
                newText: `#!permit ${category}\n`,
            };
            actions.push({
                title: `添加 #!permit ${category}（授权此类别的全部目标）`,
                kind: node_1.CodeActionKind.QuickFix,
                diagnostics: [diag],
                edit: { changes: { [params.textDocument.uri]: [edit] } },
            });
            continue;
        }
        if (!data?.module)
            continue;
        const info = (0, imports_1.parseImports)(text);
        if (info.modules.has(data.module))
            continue; // 已导入，无需修复
        const edit = (0, imports_1.buildImportEdit)(text, info, [data.module]);
        if (edit.length === 0)
            continue;
        actions.push({
            title: `添加 import "${data.module}"`,
            kind: node_1.CodeActionKind.QuickFix,
            diagnostics: [diag],
            edit: { changes: { [params.textDocument.uri]: edit } },
        });
    }
    return actions;
});
const pendingAutomaticImports = new Map();
const automaticImportsInProgress = new Set();
async function applyAutomaticImports(doc) {
    const text = doc.getText();
    const info = (0, imports_1.parseImports)(text);
    const modules = [...new Set((0, imports_1.findUnimportedUses)(text, info).map((use) => use.module))];
    const edits = (0, imports_1.buildImportEdit)(text, info, modules);
    if (edits.length === 0)
        return;
    const result = await connection.workspace.applyEdit({
        label: '自动导入标准库',
        edit: {
            documentChanges: [{
                    textDocument: { uri: doc.uri, version: doc.version },
                    edits,
                }],
        },
    });
    if (!result.applied && documents.get(doc.uri)?.version === doc.version) {
        connection.console.warn(`无法为 ${doc.uri} 自动添加 import: ${result.failureReason ?? '工作区编辑未应用'}`);
    }
}
function queueAutomaticImports(doc) {
    const uri = doc.uri;
    pendingAutomaticImports.set(uri, doc);
    if (automaticImportsInProgress.has(uri))
        return;
    automaticImportsInProgress.add(uri);
    void (async () => {
        try {
            while (pendingAutomaticImports.has(uri)) {
                const latest = pendingAutomaticImports.get(uri);
                pendingAutomaticImports.delete(uri);
                await applyAutomaticImports(latest);
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            connection.console.error(`自动添加标准库 import 失败 (${uri}): ${message}`);
        }
        finally {
            automaticImportsInProgress.delete(uri);
            const latest = pendingAutomaticImports.get(uri);
            if (latest)
                queueAutomaticImports(latest);
        }
    })();
}
documents.onDidChangeContent((change) => {
    void connection.sendDiagnostics({ uri: change.document.uri, diagnostics: validate(change.document) });
    queueAutomaticImports(change.document);
});
documents.onDidClose((e) => {
    pendingAutomaticImports.delete(e.document.uri);
    void connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
});
connection.onRequest('yscript/checkDocument', (params) => {
    const doc = vscode_languageserver_textdocument_1.TextDocument.create(params.uri, 'yscript', 1, params.text);
    return validate(doc);
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
    const wordStart = getWordStart(text, offset);
    // 已知符号
    const meta = HOVER_INDEX.get(word);
    if (meta) {
        return { contents: { kind: node_1.MarkupKind.Markdown, value: (0, keywords_1.buildHoverDoc)(meta) } };
    }
    const memberReceiver = /([A-Za-z_][A-Za-z0-9_.]*)\s*\.\s*$/.exec(text.slice(0, wordStart))?.[1];
    if (memberReceiver && ns_members_1.NS_MEMBERS[memberReceiver]) {
        const memberMeta = HOVER_INDEX.get(`${memberReceiver}.${word}`);
        if (memberMeta) {
            return {
                contents: { kind: node_1.MarkupKind.Markdown, value: (0, keywords_1.buildHoverDoc)(memberMeta) },
            };
        }
    }
    const aliasedImport = memberReceiver
        ? findAliasedImportedFunction(text, memberReceiver, word, doc.uri)
        : undefined;
    if (aliasedImport) {
        return {
            contents: {
                kind: node_1.MarkupKind.Markdown,
                value: formatFunctionDocumentation(aliasedImport, '第三方函数'),
            },
        };
    }
    // 用户定义
    const { funcs, varTypes, symbols, structs, enums } = analyzeDocument(doc);
    const localMemberReceiver = /([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*$/.exec(text.slice(0, wordStart));
    if (localMemberReceiver) {
        const method = findMethodForReceiver(text, localMemberReceiver[1], word, funcs, varTypes, doc.uri, currentMethodOwner(funcs, position.line), structs);
        if (method) {
            return {
                contents: {
                    kind: node_1.MarkupKind.Markdown,
                    value: formatFunctionDocumentation(method, '方法'),
                },
            };
        }
    }
    if (memberReceiver) {
        const contextOwner = currentMethodOwner(funcs, position.line);
        const receiverType = resolveReceiverType(memberReceiver, varTypes, structs, contextOwner);
        if (receiverType) {
            const fieldType = findFieldType(receiverType, word, structs);
            if (fieldType) {
                return {
                    contents: {
                        kind: node_1.MarkupKind.Markdown,
                        value: `**${word}** _(字段)_\n\n类型: \`${fieldType}\`\n\n所属结构体: \`${receiverType}\``,
                    },
                };
            }
        }
        const enumInfo = enums.get(memberReceiver);
        if (enumInfo && enumInfo.members.includes(word)) {
            return {
                contents: {
                    kind: node_1.MarkupKind.Markdown,
                    value: `**${word}** _(枚举值)_\n\n属于枚举 \`${memberReceiver}\``,
                },
            };
        }
    }
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
        if (f.name === word && !f.methodOwner) {
            return {
                contents: {
                    kind: node_1.MarkupKind.Markdown,
                    value: formatFunctionDocumentation(f, '函数'),
                },
            };
        }
    }
    const imported = findImportedFunction(text, word, doc.uri);
    if (imported) {
        return {
            contents: {
                kind: node_1.MarkupKind.Markdown,
                value: formatFunctionDocumentation(imported, '第三方函数'),
            },
        };
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
    const permissionCompletions = getPermissionDirectiveCompletions(text, position, offset);
    if (permissionCompletions)
        return permissionCompletions;
    // import 语句内的路径补全必须在「字符串内部」守卫之前处理
    const importPathCompletions = getImportPathCompletions(doc, text, position, offset);
    if (importPathCompletions)
        return importPathCompletions;
    // 字符串插值 `${ ... }` 内补全变量与函数（同样要先于字符串守卫）
    const interpolationCompletions = getInterpolationCompletions(doc, text, offset);
    if (interpolationCompletions)
        return interpolationCompletions;
    if (isInsideStringOrComment(text, offset))
        return [];
    // 结构体字面量内补全字段名：Point{ ... }
    const structLiteralCompletions = getStructLiteralCompletions(doc, text, offset);
    if (structLiteralCompletions)
        return structLiteralCompletions;
    // 类型上下文：let x: / 参数: / struct 字段: / -> / new / extends / is
    const typeContextCompletions = getTypeContextCompletions(doc, text, offset);
    if (typeContextCompletions)
        return typeContextCompletions;
    const prefix = getWordPrefix(text, offset);
    const before = text.slice(Math.max(0, offset - 1), offset);
    const prevChar = before;
    const colorPrintPrefix = /\b(print|println)\.([A-Za-z_]\w*)?$/.exec(text.slice(0, offset));
    if (colorPrintPrefix) {
        return getColorPrintCompletions(colorPrintPrefix[1], colorPrintPrefix[2] ?? '');
    }
    // 1. 成员访问上下文
    if (prevChar === '.') {
        return getMemberCompletions(doc, text, offset - 1);
    }
    const currentWordStart = getWordStart(text, offset);
    const typedNamespace = /([A-Za-z_][A-Za-z0-9_.]*)\.$/.exec(text.slice(0, currentWordStart))?.[1];
    if (typedNamespace && ns_members_1.NS_MEMBERS[typedNamespace]) {
        return getMemberCompletions(doc, text, currentWordStart - 1);
    }
    // 命名空间名输入完成时先展示成员，选择后补上 `.member()`。
    if (ns_members_1.NS_MEMBERS[prefix]) {
        const importInfo = (0, imports_1.parseImports)(text);
        const module = (0, imports_1.moduleForNamespace)(prefix);
        const additionalTextEdits = importInfo.modules.has(module)
            ? undefined
            : (0, imports_1.buildImportEdit)(text, importInfo, [module]);
        return ns_members_1.NS_MEMBERS[prefix].map((name) => {
            const label = `${prefix}.${name}`;
            const meta = HOVER_INDEX.get(label);
            const isGroup = prefix === 'term' && TERM_GROUPS.has(name);
            return {
                label,
                kind: isGroup ? node_1.CompletionItemKind.Module : node_1.CompletionItemKind.Function,
                detail: meta?.detail ?? `${prefix} 模块成员`,
                documentation: meta
                    ? { kind: node_1.MarkupKind.Markdown, value: (0, keywords_1.buildHoverDoc)(meta) }
                    : undefined,
                textEdit: node_1.TextEdit.insert(position, isGroup ? `.${name}.` : `.${name}(\${0})`),
                insertTextFormat: isGroup ? node_1.InsertTextFormat.PlainText : node_1.InsertTextFormat.Snippet,
                additionalTextEdits,
            };
        });
    }
    // 2. 标准补全：关键字 + 类型 + 函数 + 局部符号
    const items = [];
    const seen = new Set();
    // 内置项
    for (const m of ALL_COMPLETIONS) {
        if (!matchesPrefix(m.label, prefix))
            continue;
        if (seen.has(m.label))
            continue;
        seen.add(m.label);
        items.push(metaToCompletion(m));
    }
    // 用户符号：函数/类型直接列出，变量做作用域过滤后优先展示
    const { symbols, funcs } = analyzeDocument(doc);
    for (const s of symbols) {
        if (s.kind === node_1.SymbolKind.Variable || s.kind === node_1.SymbolKind.Constant)
            continue;
        if (!matchesPrefix(s.name, prefix))
            continue;
        if (seen.has(s.name))
            continue;
        seen.add(s.name);
        const k = s.kind === node_1.SymbolKind.Function ? node_1.CompletionItemKind.Function
            : s.kind === node_1.SymbolKind.Method ? node_1.CompletionItemKind.Method
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
            sortText: `0000_${s.name}`,
            filterText: s.name,
        });
    }
    // 可见变量（排除未声明/其他函数局部变量），排序高于内置项
    for (const item of inScopeVariableItems(doc, position.line, prefix)) {
        if (seen.has(item.label))
            continue;
        seen.add(item.label);
        items.push(item);
    }
    const bareImports = getImportedFunctions(text, doc.uri);
    const importedNameCounts = new Map();
    for (const func of bareImports) {
        if (!func.methodOwner)
            importedNameCounts.set(func.name, (importedNameCounts.get(func.name) ?? 0) + 1);
    }
    for (const func of bareImports) {
        if (func.methodOwner || !matchesPrefix(func.name, prefix) || seen.has(func.name))
            continue;
        if (importedNameCounts.get(func.name) !== 1)
            continue;
        seen.add(func.name);
        items.push({
            label: func.name,
            kind: node_1.CompletionItemKind.Function,
            detail: `第三方函数: ${func.name}(${func.params.join(', ')})`,
            documentation: func.documentation
                ? { kind: node_1.MarkupKind.Markdown, value: formatFunctionDocumentation(func, '第三方函数') }
                : undefined,
            insertText: functionCallSnippet(func.name, func.params),
            insertTextFormat: node_1.InsertTextFormat.Snippet,
            sortText: `0000_${func.name}`,
        });
    }
    // 函数参数名（仅当在函数体内）
    for (const f of funcs.values()) {
        if (position.line >= f.bodyStartLine && position.line <= f.bodyEndLine) {
            for (const p of f.params) {
                const paramName = /^[A-Za-z_][A-Za-z0-9_]*/.exec(p)?.[0] ?? p;
                if (!matchesPrefix(paramName, prefix))
                    continue;
                if (seen.has(paramName))
                    continue;
                seen.add(paramName);
                items.push({
                    label: paramName,
                    kind: node_1.CompletionItemKind.Variable,
                    detail: `参数（${f.name}）`,
                    sortText: `0000_${paramName}`,
                    filterText: paramName,
                });
            }
        }
    }
    return items;
});
/** 判断 offset 是否位于某条 import 语句中（含 `import [` 列表的续行）。 */
function importContextAt(text, offset) {
    const tokens = (0, lexer_1.tokenize)(text);
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].type !== 'keyword' || tokens[i].value !== 'import')
            continue;
        let endIndex = i + 1;
        let end = tokens[i].end;
        if (tokens[endIndex]?.value === '[') {
            const close = matchingTokenIndex(tokens, endIndex, '[', ']');
            if (close < 0) {
                endIndex = tokens.length - 1;
                end = tokens[endIndex]?.end ?? end;
            }
            else {
                endIndex = close;
                end = tokens[close].end;
            }
        }
        else {
            endIndex = i;
            while (endIndex + 1 < tokens.length && tokens[endIndex + 1].line === tokens[i].line)
                endIndex++;
            end = tokens[endIndex].end;
        }
        if (offset < tokens[i].start || offset > end + 1)
            continue;
        for (let k = i + 1; k <= endIndex && k < tokens.length; k++) {
            const token = tokens[k];
            if (token.type !== 'string')
                continue;
            const quote = token.value[0];
            if (quote !== '"' && quote !== "'")
                continue;
            if (offset < token.start || offset > token.end)
                continue;
            const contentStart = token.start + 1;
            return { contentStart, partial: text.slice(contentStart, Math.min(offset, token.end - 1)) };
        }
        return { contentStart: null, partial: '' };
    }
    return null;
}
/** import 语句中的路径补全：标准库模块名 + 相对路径下的 .ys 文件/目录。 */
function getImportPathCompletions(doc, text, position, offset) {
    const context = importContextAt(text, offset);
    if (!context)
        return null;
    const lineStart = lineStartOffset(text, position.line);
    const linePrefix = text.slice(lineStart, offset).trimStart();
    if (context.contentStart === null) {
        // 尚未写引号：仅在 `import` / `import [` / 列表逗号之后给候选
        const isImportHead = /^import\s*\[?\s*$/.test(linePrefix)
            || /^import\s*\[[\s\S]*,\s*$/.test(linePrefix);
        if (!isImportHead)
            return null;
        const modules = sortedModuleNames();
        const prefix = getWordPrefix(text, offset);
        const items = [{
                label: '"${1:path}"',
                kind: node_1.CompletionItemKind.Snippet,
                detail: '模块路径或相对脚本路径',
                insertText: '"${1:path}"',
                insertTextFormat: node_1.InsertTextFormat.Snippet,
            }];
        for (const module of modules) {
            if (prefix && !module.toLowerCase().startsWith(prefix.toLowerCase()))
                continue;
            items.push({
                label: module,
                kind: node_1.CompletionItemKind.Module,
                detail: ns_members_1.MODULE_NAMESPACE[module] && ns_members_1.MODULE_NAMESPACE[module] !== module
                    ? `导入后使用 ${ns_members_1.MODULE_NAMESPACE[module]}.xxx`
                    : '内置标准库模块',
                insertText: `"${module}"`,
            });
        }
        return items;
    }
    const { partial } = context;
    const replaceRange = {
        start: offsetToPosition(text, context.contentStart),
        end: position,
    };
    const isLocalPath = partial.startsWith('.') || partial.startsWith('/') || partial.includes('/');
    const items = [];
    if (isLocalPath) {
        items.push(...filesystemImportCompletions(doc, partial, replaceRange));
    }
    else {
        for (const module of sortedModuleNames()) {
            if (partial && !module.toLowerCase().startsWith(partial.toLowerCase()))
                continue;
            items.push({
                label: module,
                kind: node_1.CompletionItemKind.Module,
                detail: ns_members_1.MODULE_NAMESPACE[module] && ns_members_1.MODULE_NAMESPACE[module] !== module
                    ? `导入后使用 ${ns_members_1.MODULE_NAMESPACE[module]}.xxx`
                    : '内置标准库模块',
                textEdit: node_1.TextEdit.replace(replaceRange, module),
            });
        }
    }
    return items;
}
function sortedModuleNames() {
    return [...new Set([...ns_members_1.ALL_NAMESPACES, ...Object.keys(ns_members_1.MODULE_NAMESPACE)])].sort();
}
/** 相对路径补全：列出目标目录下的子目录与 .ys 文件（去掉扩展名）。 */
function filesystemImportCompletions(doc, partial, range) {
    if (!doc.uri.startsWith('file:'))
        return [];
    const baseDir = path.dirname((0, url_1.fileURLToPath)(doc.uri));
    const slash = partial.lastIndexOf('/');
    const dirPart = slash >= 0 ? partial.slice(0, slash + 1) : '';
    const namePart = slash >= 0 ? partial.slice(slash + 1) : partial;
    const targetDir = path.resolve(baseDir, dirPart || '.');
    let entries;
    try {
        entries = fs.readdirSync(targetDir, { withFileTypes: true });
    }
    catch {
        return [];
    }
    const items = [];
    const lowerName = namePart.toLowerCase();
    for (const entry of entries) {
        if (entry.name.startsWith('.') && !namePart.startsWith('.') && entry.name !== '..')
            continue;
        if (entry.isDirectory()) {
            if (namePart && !entry.name.toLowerCase().startsWith(lowerName))
                continue;
            items.push({
                label: `${entry.name}/`,
                kind: node_1.CompletionItemKind.Folder,
                detail: '脚本目录',
                textEdit: node_1.TextEdit.replace(range, `${dirPart}${entry.name}`),
            });
        }
        else if (entry.isFile() && entry.name.toLowerCase().endsWith('.ys')) {
            const stem = entry.name.slice(0, -3);
            if (namePart && !stem.toLowerCase().startsWith(lowerName))
                continue;
            items.push({
                label: stem,
                kind: node_1.CompletionItemKind.File,
                detail: entry.name,
                textEdit: node_1.TextEdit.replace(range, `${dirPart}${stem}`),
            });
        }
    }
    return items;
}
// ---------------- 结构体字面量字段补全 ----------------
/** 在 `Type{ ... }` 内补全尚未赋值的字段名。 */
function getStructLiteralCompletions(doc, text, offset) {
    const before = text.slice(0, offset);
    // 找到光标前最近一个未闭合的 `{`
    let depth = 0;
    let bracePos = -1;
    for (let i = before.length - 1; i >= 0; i--) {
        const ch = before[i];
        if (ch === '}')
            depth++;
        else if (ch === '{') {
            if (depth === 0) {
                bracePos = i;
                break;
            }
            depth--;
        }
    }
    if (bracePos < 0)
        return null;
    const head = before.slice(0, bracePos);
    const nameMatch = /([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(head);
    if (!nameMatch)
        return null;
    const structName = nameMatch[1];
    const beforeName = head.slice(0, nameMatch.index).trimEnd();
    // 排除 `struct Point {`、`if x {` 等声明/控制块
    if (/(struct|class|enum|interface|func|if|for|while|switch|match|else|elif|catch|finally|loop|warp|do|using|namespace)\s*$/.test(beforeName)) {
        return null;
    }
    const { structs } = analyzeDocument(doc);
    if (!structs.has(structName))
        return null;
    const body = before.slice(bracePos + 1);
    const usedFields = new Set();
    for (const m of body.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g))
        usedFields.add(m[1]);
    const prefix = getWordPrefix(text, offset);
    const items = collectStructFields(structName, structs)
        .filter((field) => !usedFields.has(field.name))
        .filter((field) => !prefix || field.name.toLowerCase().startsWith(prefix.toLowerCase()))
        .map((field) => ({
        label: field.name,
        kind: node_1.CompletionItemKind.Field,
        detail: `${structName} 字段 · ${field.type}`,
        documentation: { kind: node_1.MarkupKind.Markdown, value: `\`\`\`yscript\n${field.detail}\n\`\`\`` },
        insertText: `${field.name}: `,
        filterText: field.name,
        sortText: `0_${field.name}`,
    }));
    return items.length > 0 ? items : null;
}
// ---------------- 作用域内变量补全 ----------------
/**
 * 收集在 line 行可见的变量/常量：
 * - 排除在光标之后才声明的变量；
 * - 排除其他函数体内的局部变量。
 */
function inScopeVariableItems(doc, line, prefix) {
    const { symbols, varTypes, funcs } = analyzeDocument(doc);
    const items = [];
    for (const s of symbols) {
        if (s.kind !== node_1.SymbolKind.Variable && s.kind !== node_1.SymbolKind.Constant)
            continue;
        const declLine = s.selectionRange.start.line;
        if (declLine > line)
            continue;
        const owner = [...funcs.values()].find((f) => declLine >= f.bodyStartLine && declLine <= f.bodyEndLine);
        if (owner && !(line >= owner.bodyStartLine && line <= owner.bodyEndLine))
            continue;
        if (prefix && !matchesPrefix(s.name, prefix))
            continue;
        const type = varTypes.get(s.name);
        items.push({
            label: s.name,
            kind: s.kind === node_1.SymbolKind.Constant ? node_1.CompletionItemKind.Constant : node_1.CompletionItemKind.Variable,
            detail: s.detail ?? s.name,
            documentation: type ? `类型: \`${type}\`` : undefined,
            sortText: `0000_${s.name}`,
            filterText: s.name,
        });
    }
    return items;
}
/**
 * 识别「应该输入类型名」的上下文：
 *   ->        函数返回类型
 *   let x:    变量类型注解
 *   f(name:   参数类型 / struct 字段类型
 *   new       实例化
 *   extends   继承
 *   is        类型判断
 */
function getTypeContextAt(text, offset) {
    const before = text.slice(Math.max(0, offset - 240), offset);
    const arrow = /->\s*([A-Za-z_][A-Za-z0-9_]*)?$/.exec(before);
    if (arrow)
        return { mode: 'types', prefix: arrow[1] ?? '' };
    const keyword = /\b(new|extends|is)\s+([A-Za-z_][A-Za-z0-9_]*)?$/.exec(before);
    if (keyword)
        return { mode: keyword[1], prefix: keyword[2] ?? '' };
    const annotation = /\b(?:let|const|var)\s+[A-Za-z_][A-Za-z0-9_]*\s*:\s*([\w\s<>,]*)$/.exec(before);
    if (annotation)
        return { mode: 'types', prefix: trailingWord(annotation[1]) };
    const paramPrefix = parameterTypePrefixAt(text, offset);
    if (paramPrefix !== null)
        return { mode: 'types', prefix: paramPrefix };
    const fieldPrefix = structFieldTypePrefixAt(text, offset);
    if (fieldPrefix !== null)
        return { mode: 'types', prefix: fieldPrefix };
    return null;
}
/** 光标是否处于函数参数列表的 `name: ` 之后；是则返回已输入的类型前缀。 */
function parameterTypePrefixAt(text, offset) {
    let depth = 0;
    let open = -1;
    for (let i = offset - 1; i >= 0; i--) {
        const ch = text[i];
        if (ch === ')')
            depth++;
        else if (ch === '(') {
            if (depth === 0) {
                open = i;
                break;
            }
            depth--;
        }
    }
    if (open < 0)
        return null;
    const segment = text.slice(open + 1, offset);
    const lastParam = segment.slice(segment.lastIndexOf(',') + 1);
    if (!/^\s*[A-Za-z_][A-Za-z0-9_]*\s*:\s*[\w\s<>,]*$/.test(lastParam))
        return null;
    return trailingWord(lastParam);
}
/** 光标是否处于 struct/class 体的 `field: ` 之后；是则返回已输入的类型前缀。 */
function structFieldTypePrefixAt(text, offset) {
    let depth = 0;
    let open = -1;
    for (let i = offset - 1; i >= 0; i--) {
        const ch = text[i];
        if (ch === '}')
            depth++;
        else if (ch === '{') {
            if (depth === 0) {
                open = i;
                break;
            }
            depth--;
        }
    }
    if (open < 0)
        return null;
    const head = text.slice(0, open);
    if (!/(^|\n)\s*(struct|class)\s+[A-Za-z_][A-Za-z0-9_]*(\s+extends\s+[A-Za-z_][A-Za-z0-9_]*)?\s*$/.test(head)) {
        return null;
    }
    const segment = text.slice(open + 1, offset);
    const lastField = segment.slice(Math.max(segment.lastIndexOf(','), segment.lastIndexOf('\n')) + 1);
    if (!/^\s*[A-Za-z_][A-Za-z0-9_]*\s*:\s*[\w\s<>,]*$/.test(lastField))
        return null;
    return trailingWord(lastField);
}
/** 类型上下文补全入口：内置类型 + 用户/第三方结构体、枚举、接口。 */
function getTypeContextCompletions(doc, text, offset) {
    const context = getTypeContextAt(text, offset);
    if (!context)
        return null;
    const { mode, prefix } = context;
    const { structs, enums, symbols } = analyzeDocument(doc);
    const importedTypeNames = mode === 'extends' || mode === 'new' || mode === 'types'
        ? getImportedTypeNames(text, doc.uri)
        : [];
    const items = [];
    const seen = new Set();
    const push = (name, kind, detail, rank, insertText) => {
        if (seen.has(name))
            return;
        if (prefix && !matchesPrefix(name, prefix))
            return;
        seen.add(name);
        items.push({
            label: name,
            kind,
            detail,
            insertText: insertText ?? name,
            insertTextFormat: insertText?.includes('$') ? node_1.InsertTextFormat.Snippet : node_1.InsertTextFormat.PlainText,
            sortText: `${String(rank).padStart(4, '0')}_${name}`,
            filterText: name,
        });
    };
    if (mode === 'types') {
        for (const t of keywords_1.TYPES) {
            push(t.label, node_1.CompletionItemKind.TypeParameter, t.detail, t.of === 'ffi' ? 2 : 0, t.insertText);
        }
        for (const s of structs.values()) {
            push(s.name, node_1.CompletionItemKind.Struct, `${s.name} 结构体${s.parent ? ` · extends ${s.parent}` : ''}`, 1);
        }
        for (const e of enums.values()) {
            push(e.name, node_1.CompletionItemKind.Enum, `${e.name} 枚举`, 1);
        }
        for (const s of symbols) {
            if (s.kind === node_1.SymbolKind.Interface)
                push(s.name, node_1.CompletionItemKind.Interface, `${s.name} 接口`, 1);
        }
        for (const name of importedTypeNames) {
            push(name, node_1.CompletionItemKind.Struct, `第三方类型: ${name}`, 1);
        }
        return items.length > 0 ? items : null;
    }
    // new / extends：用户与第三方结构体优先，new 额外给出内置类型兜底
    for (const s of structs.values()) {
        push(s.name, node_1.CompletionItemKind.Struct, `${s.name} 结构体${s.parent ? ` · extends ${s.parent}` : ''}`, 0);
    }
    for (const name of importedTypeNames) {
        push(name, node_1.CompletionItemKind.Struct, `第三方类型: ${name}`, 1);
    }
    if (mode === 'new') {
        for (const t of keywords_1.TYPES) {
            if (t.of === 'ffi')
                continue;
            push(t.label, node_1.CompletionItemKind.TypeParameter, t.detail, 2, t.insertText);
        }
    }
    return items.length > 0 ? items : null;
}
/** 收集项目导入脚本库中的结构体/枚举/接口名。 */
function getImportedTypeNames(text, importingUri) {
    const { projectPaths } = (0, imports_1.parseImports)(text);
    const names = new Set();
    const seenFiles = new Set();
    for (const importPath of projectPaths) {
        for (const filePath of (0, project_imports_1.resolveProjectImportFiles)(importPath, importingUri)) {
            if (seenFiles.has(filePath))
                continue;
            seenFiles.add(filePath);
            let source;
            try {
                source = fs.readFileSync(filePath, 'utf8');
            }
            catch {
                continue;
            }
            const importedDoc = vscode_languageserver_textdocument_1.TextDocument.create((0, url_1.pathToFileURL)(filePath).toString(), 'yscript', 1, source);
            const { structs, enums } = analyzeDocument(importedDoc);
            for (const s of structs.values())
                names.add(s.name);
            for (const e of enums.values())
                names.add(e.name);
        }
    }
    return [...names];
}
// ---------------- 字符串插值补全 ----------------
/** 光标若位于字符串 `${ ... }` 内，返回其中已输入的前缀；否则返回 null。 */
function interpolationPrefixAt(text, offset) {
    let inString = false;
    let stringChar = '';
    let inInterp = false;
    let interpStart = -1;
    let nestedQuote = '';
    let inLineComment = false;
    let inBlockComment = false;
    let i = 0;
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
            if (nestedQuote) {
                if (ch === '\\') {
                    i += 2;
                    continue;
                }
                if (ch === nestedQuote)
                    nestedQuote = '';
            }
            else if (inInterp) {
                if (ch === '"' || ch === "'" || ch === '`')
                    nestedQuote = ch;
                else if (ch === '}')
                    inInterp = false;
            }
            else if (ch === '\\') {
                i += 2;
                continue;
            }
            else if (ch === '$' && text[i + 1] === '{') {
                inInterp = true;
                interpStart = i;
                i += 2;
                continue;
            }
            else if (ch === stringChar) {
                inString = false;
            }
        }
        else if (ch === '#' && text[i + 1] === '*') {
            inBlockComment = true;
            i++;
        }
        else if (ch === '#') {
            inLineComment = true;
        }
        else if (ch === '"' || ch === '`') {
            inString = true;
            stringChar = ch;
            inInterp = false;
        }
        i++;
    }
    if (!inString || !inInterp || interpStart < 0)
        return null;
    let start = offset;
    while (start > interpStart + 2 && isIdentChar(text[start - 1]))
        start--;
    return text.slice(start, offset);
}
/** `"${...}"` 插值内补全：可见变量优先，其次用户函数与内置函数。 */
function getInterpolationCompletions(doc, text, offset) {
    const prefix = interpolationPrefixAt(text, offset);
    if (prefix === null)
        return null;
    const position = offsetToPosition(text, offset);
    const items = inScopeVariableItems(doc, position.line, prefix);
    const seen = new Set(items.map((item) => item.label));
    const { funcs } = analyzeDocument(doc);
    for (const f of funcs.values()) {
        if (f.methodOwner || !matchesPrefix(f.name, prefix) || seen.has(f.name))
            continue;
        seen.add(f.name);
        items.push({
            label: f.name,
            kind: node_1.CompletionItemKind.Function,
            detail: `函数: ${f.name}(${f.params.join(', ')})`,
            insertText: functionCallSnippet(f.name, f.params),
            insertTextFormat: node_1.InsertTextFormat.Snippet,
            sortText: `0001_${f.name}`,
        });
    }
    for (const m of ALL_COMPLETIONS) {
        if (m.kind !== 'builtin')
            continue;
        if (!matchesPrefix(m.label, prefix) || seen.has(m.label))
            continue;
        seen.add(m.label);
        items.push({
            label: m.label,
            kind: node_1.CompletionItemKind.Function,
            detail: m.detail,
            documentation: m.signature
                ? { kind: node_1.MarkupKind.Markdown, value: (0, keywords_1.buildHoverDoc)(m) }
                : undefined,
            insertText: m.insertText ?? m.label,
            insertTextFormat: m.insertText?.includes('$') ? node_1.InsertTextFormat.Snippet : node_1.InsertTextFormat.PlainText,
            sortText: `0002_${m.label}`,
        });
    }
    return items;
}
function getPermissionDirectiveCompletions(text, position, offset) {
    const lineStart = lineStartOffset(text, position.line);
    const linePrefix = text.slice(lineStart, offset);
    const indentation = /^\s*/.exec(linePrefix)?.[0] ?? '';
    const content = linePrefix.slice(indentation.length);
    const directive = '#!permit';
    const directiveStart = lineStart + indentation.length;
    if (content.startsWith('#!') && content.length < directive.length && directive.startsWith(content)) {
        const insertText = '#!permit ${1:exec}';
        return [{
                label: '#!permit',
                kind: node_1.CompletionItemKind.Keyword,
                detail: '声明沙箱权限类别',
                insertText,
                insertTextFormat: node_1.InsertTextFormat.Snippet,
                textEdit: node_1.TextEdit.replace({ start: offsetToPosition(text, directiveStart), end: position }, insertText),
            }];
    }
    if (!content.startsWith('#!permit') || !/^#!permit\s+/.test(content))
        return null;
    const categoryText = content.slice('#!permit'.length);
    const lastComma = categoryText.lastIndexOf(',');
    const categoryPrefix = categoryText.slice(lastComma + 1).trimStart();
    const replaceStart = offset - categoryPrefix.length;
    const categories = ['file_read', 'file_write', 'exec', 'network', 'all'];
    return categories
        .filter((category) => !categoryPrefix || category.startsWith(categoryPrefix.toLowerCase()))
        .map((category) => ({
        label: category,
        kind: node_1.CompletionItemKind.EnumMember,
        detail: '沙箱权限类别',
        textEdit: node_1.TextEdit.replace({ start: offsetToPosition(text, replaceStart), end: position }, category),
    }));
}
/** `.` 触发的成员补全 */
function getMemberCompletions(doc, text, dotOffset) {
    // 向左扫描一个标识符
    let i = dotOffset - 1;
    while (i >= 0 && (isIdentChar(text[i]) || text[i] === '.'))
        i--;
    const nameStart = i + 1;
    const receiver = text.slice(nameStart, dotOffset);
    if (!receiver)
        return [];
    if (receiver === 'print' || receiver === 'println') {
        return getColorPrintCompletions(receiver);
    }
    const members = [];
    const importInfo = (0, imports_1.parseImports)(text);
    const aliasPath = importInfo.projectAliases.get(receiver);
    if (aliasPath) {
        const importedFiles = new Set((0, project_imports_1.resolveProjectImportFiles)(aliasPath, doc.uri).map((filePath) => (0, url_1.pathToFileURL)(filePath).toString()));
        return getImportedFunctions(text, doc.uri)
            .filter((func) => !func.methodOwner && importedFiles.has(func.uri))
            .map((func) => ({
            label: func.name,
            kind: node_1.CompletionItemKind.Function,
            detail: `第三方库 ${receiver} 函数`,
            documentation: {
                kind: node_1.MarkupKind.Markdown,
                value: formatFunctionDocumentation(func, '第三方函数'),
            },
            insertText: functionCallSnippet(func.name, func.params),
            insertTextFormat: node_1.InsertTextFormat.Snippet,
        }));
    }
    // ── 1. 命名空间成员（binary. / c. / ffi. …）────────────────────
    // 数据来自 ns_members.ts，由 yscript/tools/gen_ns_members.py 从
    // internal/std/*.go 自动生成，故与实现始终一致。
    const nsMembers = ns_members_1.NS_MEMBERS[receiver];
    if (nsMembers) {
        const items = nsMembers.map((name) => {
            const meta = HOVER_INDEX.get(`${receiver}.${name}`);
            const isGroup = receiver === 'term' && TERM_GROUPS.has(name);
            return {
                label: name,
                kind: isGroup ? node_1.CompletionItemKind.Module : node_1.CompletionItemKind.Function,
                detail: meta?.detail ?? `${receiver} 模块成员`,
                documentation: meta
                    ? { kind: node_1.MarkupKind.Markdown, value: (0, keywords_1.buildHoverDoc)(meta) }
                    : undefined,
                insertText: isGroup ? `${name}.` : `${name}(\${0})`,
                insertTextFormat: isGroup ? node_1.InsertTextFormat.PlainText : node_1.InsertTextFormat.Snippet,
            };
        });
        // 未导入时，在列表顶部给出「一键补 import」选项
        const module = (0, imports_1.moduleForNamespace)(receiver);
        if (!importInfo.modules.has(module)) {
            const edit = (0, imports_1.buildImportEdit)(text, importInfo, [module]);
            if (edit.length > 0) {
                items.unshift({
                    label: `＋ 添加 import "${module}"`,
                    kind: node_1.CompletionItemKind.Snippet,
                    detail: `使用 ${receiver}.xxx 前必须先导入该模块`,
                    insertText: '',
                    additionalTextEdits: edit,
                });
            }
        }
        return items;
    }
    // ── 2. 枚举成员（Color.）────────────────────────────────────────
    const { varTypes, funcs, structs, enums } = analyzeDocument(doc);
    if (enums.has(receiver)) {
        return enums.get(receiver).members.map((name) => ({
            label: name,
            kind: node_1.CompletionItemKind.EnumMember,
            detail: `${receiver} 枚举值`,
            insertText: name,
            insertTextFormat: node_1.InsertTextFormat.PlainText,
        }));
    }
    // ── 3. 类型成员（list. / string. / dict. / 自定义 struct 字段与方法）──
    // 解析类型（支持 p. / this. / pkt.ip 链式字段）
    const activeLine = offsetToPosition(text, dotOffset).line;
    const enclosingMethod = [...funcs.values()].find((func) => func.methodOwner && activeLine >= func.bodyStartLine && activeLine <= func.bodyEndLine);
    const contextOwner = enclosingMethod?.methodOwner;
    const type = resolveReceiverType(receiver, varTypes, structs, contextOwner);
    // 自定义结构体字段（含继承链）
    const structType = type && structs.has(type) ? type : undefined;
    if (structType) {
        for (const field of collectStructFields(structType, structs)) {
            members.push({
                label: field.name,
                kind: node_1.CompletionItemKind.Field,
                detail: `${structType} 字段 · ${field.type}`,
                documentation: { kind: node_1.MarkupKind.Markdown, value: `\`\`\`yscript\n${field.detail}\n\`\`\`` },
                insertText: field.name,
                insertTextFormat: node_1.InsertTextFormat.PlainText,
            });
        }
    }
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
    // 自定义方法（含继承链：Dog extends Animal 时 dog. 也补出 Animal 的方法）
    const methodOwners = type ? collectStructMethodOwners(type, structs) : [];
    const customMethods = [
        ...[...funcs.values()].filter((func) => func.methodOwner && methodOwners.includes(func.methodOwner)),
        ...getImportedFunctions(text, doc.uri).filter((func) => func.methodOwner && methodOwners.includes(func.methodOwner)),
    ];
    if (receiver === 'this' || type) {
        const seenMethods = new Set(members.map((member) => member.label));
        // 自身方法优先于父类方法
        for (const owner of methodOwners) {
            for (const method of customMethods) {
                if (method.methodOwner !== owner || seenMethods.has(method.name))
                    continue;
                seenMethods.add(method.name);
                members.push({
                    label: method.name,
                    kind: node_1.CompletionItemKind.Method,
                    detail: owner === type
                        ? `${method.methodOwner ?? 'this'} 自定义方法`
                        : `继承自 ${method.methodOwner}`,
                    documentation: `func ${method.methodOwner}.${method.name}(${method.params.join(', ')})`,
                });
            }
        }
    }
    return members;
}
function getColorPrintCompletions(receiver, prefix = '') {
    return COLOR_PRINT_METHODS
        .filter((color) => color.name.startsWith(prefix.toLowerCase()))
        .map((color) => ({
        label: color.name,
        kind: node_1.CompletionItemKind.Method,
        detail: color.detail,
        documentation: {
            kind: node_1.MarkupKind.Markdown,
            value: `按需传入文本，例如：\`${receiver}.${color.name}("message")\``,
        },
        insertText: `${color.name}(\${0})`,
        insertTextFormat: node_1.InsertTextFormat.Snippet,
    }));
}
function functionCallSnippet(name, params) {
    if (params.length === 0)
        return `${name}(\${0})`;
    const args = params.map((param, index) => `\${${index + 1}:${param}}`).join(', ');
    return `${name}(${args})`;
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
    const importPath = (0, project_imports_1.importPathAtOffset)(text, offset);
    if (importPath) {
        const targetPath = (0, project_imports_1.resolveProjectImportPath)(importPath, textDocument.uri);
        if (targetPath) {
            return {
                uri: (0, url_1.pathToFileURL)(targetPath).toString(),
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
            };
        }
    }
    if (isInsideStringOrComment(text, offset))
        return null;
    const word = getWordAt(text, offset);
    if (!word)
        return null;
    const wordStart = getWordStart(text, offset);
    const wordEnd = wordStart + word.length;
    const aliasPath = (0, imports_1.parseImports)(text).projectAliases.get(word);
    if (aliasPath && /^\s*\./.test(text.slice(wordEnd))) {
        const targetPath = (0, project_imports_1.resolveProjectImportPath)(aliasPath, textDocument.uri);
        if (targetPath) {
            return {
                uri: (0, url_1.pathToFileURL)(targetPath).toString(),
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
            };
        }
    }
    const { symbols, funcs, varTypes, structs } = analyzeDocument(doc);
    const receiver = /([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*$/.exec(text.slice(0, wordStart))?.[1];
    const method = receiver
        ? findMethodForReceiver(text, receiver, word, funcs, varTypes, textDocument.uri, currentMethodOwner(funcs, position.line), structs)
        : undefined;
    if (method) {
        return {
            uri: method.uri,
            range: {
                start: { line: method.declLine, character: method.declChar },
                end: { line: method.declLine, character: method.declEndChar },
            },
        };
    }
    // 结构体字段跳转定义（支持 p.field / this.field / pkt.ip.field）
    const dottedReceiver = /([A-Za-z_][A-Za-z0-9_.]*)\s*\.\s*$/.exec(text.slice(0, wordStart))?.[1];
    if (dottedReceiver) {
        const receiverType = resolveReceiverType(dottedReceiver, varTypes, structs, currentMethodOwner(funcs, position.line));
        if (receiverType) {
            const field = findFieldInfo(receiverType, word, structs);
            if (field) {
                return {
                    uri: field.uri,
                    range: {
                        start: { line: field.declLine, character: field.declChar },
                        end: { line: field.declLine, character: field.declEndChar },
                    },
                };
            }
        }
    }
    const aliasedImport = receiver
        ? findAliasedImportedFunction(text, receiver, word, textDocument.uri)
        : undefined;
    if (aliasedImport) {
        return {
            uri: aliasedImport.uri,
            range: {
                start: { line: aliasedImport.declLine, character: aliasedImport.declChar },
                end: { line: aliasedImport.declLine, character: aliasedImport.declEndChar },
            },
        };
    }
    for (const s of symbols) {
        if (s.name === word) {
            return { uri: textDocument.uri, range: { start: s.selectionRange.start, end: s.selectionRange.end } };
        }
    }
    for (const f of funcs.values()) {
        if (f.name === word) {
            return { uri: f.uri, range: { start: { line: f.declLine, character: f.declChar }, end: { line: f.declLine, character: f.declEndChar } } };
        }
    }
    const imported = findImportedFunction(text, word, textDocument.uri);
    if (imported) {
        return {
            uri: imported.uri,
            range: {
                start: { line: imported.declLine, character: imported.declChar },
                end: { line: imported.declLine, character: imported.declEndChar },
            },
        };
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
connection.languages.semanticTokens.on((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc)
        return { data: [] };
    const analysis = analyzeDocument(doc);
    const variables = new Set(analysis.symbols
        .filter((symbol) => symbol.kind === node_1.SymbolKind.Variable || symbol.kind === node_1.SymbolKind.Constant)
        .map((symbol) => symbol.name));
    const functions = new Set();
    const declarationTokens = new Map();
    for (const symbol of analysis.symbols) {
        const position = `${symbol.selectionRange.start.line}:${symbol.selectionRange.start.character}`;
        if (symbol.kind === node_1.SymbolKind.Variable || symbol.kind === node_1.SymbolKind.Constant) {
            declarationTokens.set(position, {
                tokenType: 0,
                modifiers: 1 | (symbol.kind === node_1.SymbolKind.Constant ? 2 : 0),
            });
        }
        else if (symbol.kind === node_1.SymbolKind.Function || symbol.kind === node_1.SymbolKind.Method) {
            functions.add(symbol.name.split('.').pop() ?? symbol.name);
            declarationTokens.set(position, { tokenType: 1, modifiers: 1 });
        }
    }
    for (const func of analysis.funcs.values()) {
        for (const parameter of func.params) {
            const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(parameter)?.[0];
            if (name)
                variables.add(name);
        }
    }
    const tokens = (0, lexer_1.tokenize)(doc.getText());
    const semantic = [];
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.type !== 'identifier' && token.type !== 'builtin')
            continue;
        const line = token.line - 1;
        const character = token.col - 1;
        const declaration = declarationTokens.get(`${line}:${character}`);
        const isFunction = declaration?.tokenType === 1 || functions.has(token.value) ||
            tokens[i + 1]?.value === '(';
        if (!isFunction && !variables.has(token.value))
            continue;
        semantic.push({
            line,
            character,
            length: token.value.length,
            tokenType: isFunction ? 1 : 0,
            modifiers: declaration?.modifiers ?? (token.type === 'builtin' && isFunction ? 4 : 0),
        });
    }
    const data = [];
    let previousLine = 0;
    let previousCharacter = 0;
    for (const token of semantic) {
        const deltaLine = token.line - previousLine;
        data.push(deltaLine, deltaLine === 0 ? token.character - previousCharacter : token.character, token.length, token.tokenType, token.modifiers);
        previousLine = token.line;
        previousCharacter = token.character;
    }
    return { data };
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
    let parenDepth = 0;
    let bracketDepth = 0;
    let braceDepth = 0;
    for (let k = offset - 1; k > i; k--) {
        if (isInsideStringOrComment(text, k))
            continue;
        if (text[k] === ')')
            parenDepth++;
        else if (text[k] === '(' && parenDepth > 0)
            parenDepth--;
        else if (text[k] === ']')
            bracketDepth++;
        else if (text[k] === '[' && bracketDepth > 0)
            bracketDepth--;
        else if (text[k] === '}')
            braceDepth++;
        else if (text[k] === '{' && braceDepth > 0)
            braceDepth--;
        else if (text[k] === ',' && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0)
            paramIdx++;
    }
    // 查签名
    const meta = HOVER_INDEX.get(callName) ?? HOVER_INDEX.get(callName.split('.').pop() || '');
    if (!meta) {
        // 用户定义函数 / 自定义方法
        const { funcs, varTypes, structs } = analyzeDocument(doc);
        const functionName = callName.split('.').pop() || callName;
        const receiver = callName.includes('.') ? callName.slice(0, callName.lastIndexOf('.')) : '';
        const f = (receiver
            ? findAliasedImportedFunction(text, receiver, functionName, doc.uri)
            : undefined)
            ?? (receiver
                ? findMethodForReceiver(text, receiver, functionName, funcs, varTypes, doc.uri, currentMethodOwner(funcs, params.position.line), structs)
                : undefined)
            ?? funcs.get(callName)
            ?? funcs.get(functionName)
            ?? findImportedFunction(text, functionName, doc.uri);
        if (f) {
            const labelName = receiver && receiver !== 'this' ? callName : functionName;
            const sig = {
                label: `${labelName}(${f.params.join(', ')})`,
                parameters: f.params.map(p => node_1.ParameterInformation.create(p)),
                documentation: f.documentation
                    ? { kind: node_1.MarkupKind.Markdown, value: formatFunctionDocumentation(f, '第三方函数') }
                    : undefined,
            };
            return { signatures: [sig], activeSignature: 0, activeParameter: Math.min(paramIdx, Math.max(f.params.length - 1, 0)) };
        }
        return null;
    }
    const signature = metaSignature(meta);
    const sig = {
        label: signature,
        parameters: signatureParameters(signature).map(p => node_1.ParameterInformation.create(p)),
    };
    const parameterCount = sig.parameters?.length ?? 0;
    return { signatures: [sig], activeSignature: 0, activeParameter: Math.min(paramIdx, Math.max(parameterCount - 1, 0)) };
});
function getImportedFunctions(text, importingUri) {
    const { projectPaths } = (0, imports_1.parseImports)(text);
    const imported = [];
    const seenFiles = new Set();
    for (const importPath of projectPaths) {
        for (const filePath of (0, project_imports_1.resolveProjectImportFiles)(importPath, importingUri)) {
            if (seenFiles.has(filePath))
                continue;
            seenFiles.add(filePath);
            let source;
            try {
                source = fs.readFileSync(filePath, 'utf8');
            }
            catch {
                continue;
            }
            const importedDoc = vscode_languageserver_textdocument_1.TextDocument.create((0, url_1.pathToFileURL)(filePath).toString(), 'yscript', 1, source);
            imported.push(...analyzeDocument(importedDoc).funcs.values());
        }
    }
    return imported;
}
function findImportedFunction(text, name, importingUri) {
    const matches = getImportedFunctions(text, importingUri)
        .filter((func) => func.name === name && !func.methodOwner);
    return matches.length === 1 ? matches[0] : undefined;
}
function findAliasedImportedFunction(text, alias, name, importingUri) {
    const importPath = (0, imports_1.parseImports)(text).projectAliases.get(alias);
    if (!importPath)
        return undefined;
    const importedFiles = new Set((0, project_imports_1.resolveProjectImportFiles)(importPath, importingUri).map((filePath) => (0, url_1.pathToFileURL)(filePath).toString()));
    const matches = getImportedFunctions(text, importingUri)
        .filter((func) => func.name === name && !func.methodOwner && importedFiles.has(func.uri));
    return matches.length === 1 ? matches[0] : undefined;
}
function findMethodForReceiver(text, receiver, methodName, funcs, varTypes, importingUri, contextOwner, structs) {
    const candidates = new Set();
    const importedFunctions = getImportedFunctions(text, importingUri);
    if (receiver === 'this') {
        if (contextOwner) {
            candidates.add(contextOwner);
        }
        else {
            for (const func of funcs.values()) {
                if (func.name === methodName && func.methodOwner)
                    candidates.add(func.methodOwner);
            }
            for (const func of importedFunctions) {
                if (func.name === methodName && func.methodOwner)
                    candidates.add(func.methodOwner);
            }
        }
    }
    const explicitlyTyped = varTypes.get(receiver);
    if (explicitlyTyped) {
        candidates.add(explicitlyTyped);
        if (structs) {
            for (const owner of collectStructMethodOwners(explicitlyTyped, structs))
                candidates.add(owner);
        }
    }
    if (receiver && receiver !== 'this')
        candidates.add(receiver);
    for (const owner of candidates) {
        const direct = funcs.get(`${owner}.${methodName}`);
        if (direct)
            return direct;
        const imported = importedFunctions.find((func) => func.methodOwner === owner && func.name === methodName);
        if (imported)
            return imported;
    }
    if (receiver === 'this') {
        const ownMethod = [...funcs.values()].find((func) => func.name === methodName && func.methodOwner);
        if (ownMethod)
            return ownMethod;
        return importedFunctions.find((func) => func.name === methodName && func.methodOwner);
    }
    return undefined;
}
function currentMethodOwner(funcs, line) {
    return [...funcs.values()].find((func) => func.methodOwner && line >= func.bodyStartLine && line <= func.bodyEndLine)?.methodOwner;
}
function signatureParameters(signature) {
    const open = signature.indexOf('(');
    const close = signature.lastIndexOf(')');
    if (open < 0 || close <= open)
        return [];
    return splitParameterList(signature.slice(open + 1, close));
}
function splitParameterList(source) {
    const parts = [];
    let start = 0;
    let parens = 0;
    let brackets = 0;
    let braces = 0;
    let generics = 0;
    let inType = false;
    let quote = '';
    for (let i = 0; i < source.length; i++) {
        const ch = source[i];
        if (quote) {
            if (ch === '\\')
                i++;
            else if (ch === quote)
                quote = '';
            continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') {
            quote = ch;
            continue;
        }
        if (ch === ':' && parens === 0 && brackets === 0 && braces === 0)
            inType = true;
        else if (ch === '=' && parens === 0 && brackets === 0 && braces === 0)
            inType = false;
        else if (ch === '(')
            parens++;
        else if (ch === ')' && parens > 0)
            parens--;
        else if (ch === '[')
            brackets++;
        else if (ch === ']' && brackets > 0)
            brackets--;
        else if (ch === '{')
            braces++;
        else if (ch === '}' && braces > 0)
            braces--;
        else if (inType && ch === '<')
            generics++;
        else if (inType && ch === '>' && generics > 0)
            generics--;
        else if (ch === ',' && parens === 0 && brackets === 0 && braces === 0 && generics === 0) {
            const part = source.slice(start, i).trim();
            if (part)
                parts.push(part);
            start = i + 1;
        }
    }
    const finalPart = source.slice(start).trim();
    if (finalPart)
        parts.push(finalPart);
    return parts;
}
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