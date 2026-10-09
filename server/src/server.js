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
                triggerCharacters: ['.', ':', ' ', '"', '`', '/', '#', '!'],
            },
            definitionProvider: true,
            codeActionProvider: true,
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
// ---------------- 文档符号 + 作用域分析 ----------------
/** 从源码中提取作用域（粗略：找 func/init 后匹配的 { ... } 块） */
function analyzeDocument(doc) {
    const text = doc.getText();
    const symbols = [];
    const scopes = [];
    const funcs = new Map();
    const varTypes = new Map();
    const lines = text.split('\n');
    const tokens = (0, lexer_1.tokenize)(text);
    // 1. 收集变量类型（先做类型推断）
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const inferredDecl = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*<-\s*/.exec(line);
        const inferenceLine = inferredDecl
            ? line.replace('<-', '=')
            : line;
        const m = /^\s*(let|const|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*[:=]/.exec(line);
        const name = m?.[2] ?? inferredDecl?.[1];
        if (name) {
            const structLiteral = /^\s*(?:(?:let|const|var)\s+)?[A-Za-z_][A-Za-z0-9_]*\s*(?::[^=]+)?=\s*([A-Za-z_][A-Za-z0-9_]*)\s*\{/.exec(inferenceLine);
            if (structLiteral)
                varTypes.set(name, structLiteral[1]);
            for (const rule of keywords_1.TYPE_INFERENCE_RULES) {
                if (structLiteral)
                    break;
                if (rule.regex.test(inferenceLine)) {
                    const t = rule.type;
                    const match = /new\s+(\w+)/.exec(inferenceLine);
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
            funcs.set(owner ? `${owner}.${name}` : name, {
                name,
                params,
                methodOwner: owner,
                uri: doc.uri,
                declLine: nameToken.line - 1,
                declChar: startChar,
                declEndChar: startChar + name.length,
                bodyStartLine: bodyStartLine - 1,
                bodyEndLine: bodyEndLine - 1,
            });
        }
    }
    // 3. Variables, types, imports and package symbols.
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        let m = /^(?:(let|const|var)\s+([A-Za-z_][A-Za-z0-9_]*)|([A-Za-z_][A-Za-z0-9_]*)\s*<-)/.exec(trimmed);
        if (m) {
            const kw = m[1] ?? 'let';
            const name = m[2] ?? m[3];
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
        const isVariable = value === 'let' || value === 'const' || value === 'var';
        out.push({
            range: {
                start: offsetToPosition(text, token.start),
                end: offsetToPosition(text, token.end),
            },
            message: isVariable
                ? '顶层不能声明变量或常量，请在 func main() 或其他函数内编写逻辑'
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
            'LookupTXT', 'ResolveTCP', 'ResolveUDP', 'dial', 'dial_tcp', 'dial_udp',
            'listen_tcp', 'nginx', 'udp_bind', 'udp_dial',
        ],
        http: [
            'Delete', 'Do', 'Download', 'Form', 'Get', 'Head', 'Options', 'Patch',
            'Post', 'Put', 'Request', 'Server', 'Upload', 'http_get', 'http_post',
            'http_request',
        ],
        socket: ['Socket', 'port_scan', 'tcp_probe', 'tcp_request', 'tls_request', 'udp_request'],
        raw: ['OpenSocket', 'PcapOpen', 'PcapNext', 'Receive', 'Send'],
        ssl: ['Connect', 'GetServerCertificate'],
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
        if (ns_members_1.ALL_NAMESPACES.includes(path) || Object.prototype.hasOwnProperty.call(ns_members_1.MODULE_NAMESPACE, path))
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
documents.onDidChangeContent((change) => {
    void connection.sendDiagnostics({ uri: change.document.uri, diagnostics: validate(change.document) });
});
documents.onDidClose((e) => {
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
    // 用户定义
    const { funcs, varTypes, symbols } = analyzeDocument(doc);
    const memberReceiver = /([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*$/.exec(text.slice(0, wordStart));
    if (memberReceiver) {
        const method = findMethodForReceiver(text, memberReceiver[1], word, funcs, varTypes, doc.uri, currentMethodOwner(funcs, position.line));
        if (method) {
            return {
                contents: {
                    kind: node_1.MarkupKind.Markdown,
                    value: `**${word}** _(方法)_\n\n\`\`\`yscript\nfunc this.${word}(${method.params.join(', ')})\n\`\`\``,
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
                    value: `**${word}** _(函数)_\n\n\`\`\`yscript\nfunc ${word}(${f.params.join(', ')})\n\`\`\``,
                },
            };
        }
    }
    const imported = findImportedFunction(text, word, doc.uri);
    if (imported) {
        return {
            contents: {
                kind: node_1.MarkupKind.Markdown,
                value: `**${word}** _(第三方函数)_\n\n\`\`\`yscript\nfunc ${word}(${imported.params.join(', ')})\n\`\`\``,
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
    if (isInsideStringOrComment(text, offset))
        return [];
    const prefix = getWordPrefix(text, offset);
    const before = text.slice(Math.max(0, offset - 1), offset);
    const prevChar = before;
    // 1. 成员访问上下文
    if (prevChar === '.') {
        return getMemberCompletions(doc, text, offset - 1);
    }
    // 2. import 后的路径：补全内置模块名
    const beforeImport = text.slice(Math.max(0, offset - 50), offset);
    if (/(?:^|\n)\s*import\s+["']?[^"']*$/.test(beforeImport)) {
        const quoted = /["'][^"']*$/.test(beforeImport);
        const mods = [
            ...new Set([...ns_members_1.ALL_NAMESPACES, ...Object.keys(ns_members_1.MODULE_NAMESPACE)]),
        ].sort();
        if (quoted) {
            // 引号内：给模块名（含别名映射，string→strings、error→errors）
            return mods.map((m) => ({
                label: m,
                kind: node_1.CompletionItemKind.Module,
                detail: ns_members_1.MODULE_NAMESPACE[m] && ns_members_1.MODULE_NAMESPACE[m] !== m
                    ? `导入后使用 ${ns_members_1.MODULE_NAMESPACE[m]}.xxx`
                    : '内置标准库模块',
            }));
        }
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
            : s.kind === node_1.SymbolKind.Method ? node_1.CompletionItemKind.Method
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
    const bareImports = getImportedFunctions(text, doc.uri);
    const importedNameCounts = new Map();
    for (const func of bareImports) {
        if (!func.methodOwner)
            importedNameCounts.set(func.name, (importedNameCounts.get(func.name) ?? 0) + 1);
    }
    for (const func of bareImports) {
        if (func.methodOwner || (prefix && !func.name.toLowerCase().startsWith(prefix.toLowerCase())) || seen.has(func.name))
            continue;
        if (importedNameCounts.get(func.name) !== 1)
            continue;
        seen.add(func.name);
        items.push({
            label: func.name,
            kind: node_1.CompletionItemKind.Function,
            detail: `第三方函数: ${func.name}(${func.params.join(', ')})`,
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
    while (i >= 0 && isIdentChar(text[i]))
        i--;
    const nameStart = i + 1;
    const receiver = text.slice(nameStart, dotOffset);
    if (!receiver)
        return [];
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
            documentation: `func ${func.name}(${func.params.join(', ')})`,
        }));
    }
    // ── 1. 命名空间成员（binary. / c. / ffi. …）────────────────────
    // 数据来自 ns_members.ts，由 yscript/tools/gen_ns_members.py 从
    // internal/std/*.go 自动生成，故与实现始终一致。
    const nsMembers = ns_members_1.NS_MEMBERS[receiver];
    if (nsMembers) {
        const items = nsMembers.map((name) => ({
            label: name,
            kind: node_1.CompletionItemKind.Function,
            detail: `${receiver} 模块成员`,
        }));
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
                    // 附加字段供 onCompletionResolve 组装 WorkspaceEdit
                    data: { autoImport: module, edits: edit },
                });
            }
        }
        return items;
    }
    // ── 2. 类型成员（list. / string. / dict. …）────────────────────
    // 解析类型
    const { varTypes, funcs } = analyzeDocument(doc);
    const activeLine = offsetToPosition(text, dotOffset).line;
    const enclosingMethod = [...funcs.values()].find((func) => func.methodOwner && activeLine >= func.bodyStartLine && activeLine <= func.bodyEndLine);
    const type = varTypes.get(receiver) ?? (receiver === 'this' ? enclosingMethod?.methodOwner : undefined);
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
    const customMethods = [
        ...[...funcs.values()].filter((func) => func.methodOwner && func.methodOwner === type),
        ...getImportedFunctions(text, doc.uri).filter((func) => func.methodOwner && func.methodOwner === type),
    ];
    if (receiver === 'this' || type) {
        const seenMethods = new Set(members.map((member) => member.label));
        for (const method of customMethods) {
            if (seenMethods.has(method.name))
                continue;
            seenMethods.add(method.name);
            members.push({
                label: method.name,
                kind: node_1.CompletionItemKind.Method,
                detail: `${method.methodOwner ?? 'this'} 自定义方法`,
                documentation: `func this.${method.name}(${method.params.join(', ')})`,
            });
        }
    }
    return members;
}
connection.onCompletionResolve((item) => {
    // 自动 import 项：把 import 语句作为附加编辑带上（选中该补全项即生效）
    const d = item.data;
    if (d?.autoImport && d.edits) {
        item.additionalTextEdits = d.edits;
        item.detail = `选中即自动补上 import "${d.autoImport}"`;
        return item;
    }
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
    const { symbols, funcs, varTypes } = analyzeDocument(doc);
    const wordStart = getWordStart(text, offset);
    const receiver = /([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*$/.exec(text.slice(0, wordStart))?.[1];
    const method = receiver
        ? findMethodForReceiver(text, receiver, word, funcs, varTypes, textDocument.uri, currentMethodOwner(funcs, position.line))
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
        const { funcs, varTypes } = analyzeDocument(doc);
        const functionName = callName.split('.').pop() || callName;
        const receiver = callName.includes('.') ? callName.slice(0, callName.lastIndexOf('.')) : '';
        const f = (receiver
            ? findAliasedImportedFunction(text, receiver, functionName, doc.uri)
            : undefined)
            ?? (receiver
                ? findMethodForReceiver(text, receiver, functionName, funcs, varTypes, doc.uri, currentMethodOwner(funcs, params.position.line))
                : undefined)
            ?? funcs.get(callName)
            ?? funcs.get(functionName)
            ?? findImportedFunction(text, functionName, doc.uri);
        if (f) {
            const labelName = receiver && receiver !== 'this' ? callName : functionName;
            const sig = {
                label: `${labelName}(${f.params.join(', ')})`,
                parameters: f.params.map(p => node_1.ParameterInformation.create(p)),
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
function findMethodForReceiver(text, receiver, methodName, funcs, varTypes, importingUri, contextOwner) {
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
    if (explicitlyTyped)
        candidates.add(explicitlyTyped);
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