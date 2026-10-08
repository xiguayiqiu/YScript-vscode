"use strict";
/**
 * import 管理 —— 自动 import 的核心逻辑。
 *
 * 要解决的问题：YScript 的标准库必须先 `import` 才能用
 * （`binary.UTF8()` 用到却没 `import ["binary"]` 会编译报错）。
 * 这里负责三件事：
 *   1. 解析文件里已有的 import
 *   2. 找出「用了内置命名空间却没导入」的使用点
 *   3. 产出插入 import 语句的 TextEdit（合并进已有的，不重复加）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_NS = void 0;
exports.parseImports = parseImports;
exports.findUnimportedUses = findUnimportedUses;
exports.buildImportEdit = buildImportEdit;
exports.moduleForNamespace = moduleForNamespace;
const node_1 = require("vscode-languageserver/node");
const ns_members_1 = require("./ns_members");
/** 运行时命名空间 -> import 时要写的模块名 */
const NS_TO_MODULE = {};
for (const m of Object.keys(ns_members_1.MODULE_NAMESPACE)) {
    NS_TO_MODULE[ns_members_1.MODULE_NAMESPACE[m]] = m;
}
/** 所有内置运行时命名空间 */
const ALL_NS = Object.keys(ns_members_1.NS_MEMBERS);
exports.ALL_NS = ALL_NS;
function stripImportComments(text) {
    let out = '';
    let quote = null;
    let lineComment = false;
    let blockComment = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        const next = text[i + 1];
        if (lineComment) {
            if (c === '\n') {
                lineComment = false;
                out += '\n';
            }
            else {
                out += ' ';
            }
            continue;
        }
        if (blockComment) {
            if (c === '*' && next === '#') {
                out += '  ';
                i++;
                blockComment = false;
            }
            else {
                out += c === '\n' ? '\n' : ' ';
            }
            continue;
        }
        if (quote) {
            out += c;
            if (c === '\\' && i + 1 < text.length)
                out += text[++i];
            else if (c === quote)
                quote = null;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') {
            quote = c;
            out += c;
        }
        else if (c === '#' && next === '*') {
            out += '  ';
            i++;
            blockComment = true;
        }
        else if (c === '#') {
            out += ' ';
            lineComment = true;
        }
        else {
            out += c;
        }
    }
    return out;
}
function importListIsClosed(statement) {
    let depth = 0;
    let quote = null;
    const source = stripImportComments(statement);
    for (let i = 0; i < source.length; i++) {
        const c = source[i];
        if (quote) {
            if (c === '\\')
                i++;
            else if (c === quote)
                quote = null;
        }
        else if (c === '"' || c === "'" || c === '`') {
            quote = c;
        }
        else if (c === '[') {
            depth++;
        }
        else if (c === ']' && --depth === 0) {
            return true;
        }
    }
    return false;
}
/**
 * 解析文件中的 import 语句。
 *
 * 支持三种写法：
 *   import "string"                 单个
 *   import ["c", "ffi"]             列表
 *   import ["lib/util" as net]       带别名（别名不是内置命名空间，忽略）
 */
function parseImports(text) {
    const modules = new Set();
    const namespaces = new Set();
    const projectPaths = new Set();
    const projectAliases = new Map();
    let lastImportLine = -1;
    let hasImport = false;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const m = /^\s*import\b(.*)$/.exec(line);
        if (!m)
            continue;
        hasImport = true;
        let statement = m[1];
        let endLine = i;
        if (/^\s*\[/.test(statement)) {
            while (!importListIsClosed(statement) && endLine + 1 < lines.length) {
                statement += `\n${lines[++endLine]}`;
            }
            i = endLine;
            if (!importListIsClosed(statement))
                continue;
        }
        lastImportLine = endLine;
        // 引号里的路径（带 as 别名的取 as 前面的）
        const re = /["']([^"']+)["'](\s+as\s+\w+)?/g;
        let g;
        while ((g = re.exec(stripImportComments(statement))) !== null) {
            const path = g[1];
            // 本地文件路径（含 / 或以 ./ 开头）不是标准库，跳过
            const isStdModule = ns_members_1.NS_MEMBERS[path] !== undefined || Object.prototype.hasOwnProperty.call(ns_members_1.MODULE_NAMESPACE, path);
            if (path.includes('/') || path.startsWith('.') || !isStdModule) {
                projectPaths.add(path);
                if (g[2]) {
                    const alias = /\bas\s+(\w+)/.exec(g[2])?.[1];
                    if (alias)
                        projectAliases.set(alias, path);
                }
                continue;
            }
            modules.add(path);
            namespaces.add(ns_members_1.MODULE_NAMESPACE[path] || path);
        }
    }
    return { modules, namespaces, projectPaths, projectAliases, lastImportLine, hasImport };
}
const isIdentStart = (c) => /[A-Za-z_]/.test(c);
const isIdentPart = (c) => /[A-Za-z0-9_]/.test(c);
/**
 * 找出所有「内置命名空间成员被使用、但该模块未导入」的地方。
 *
 * 排除以下误报场景：
 *   - 字符串 / 注释内部
 *   - 局部变量或参数与命名空间同名（遮蔽），如 let binary = 1
 *   - 非成员访问，如 import 已处理
 */
function findUnimportedUses(text, info) {
    const out = [];
    // 已经被本地变量遮蔽的名字：let binary = ... / func(binary) {...}
    const shadowed = new Set();
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        // 先去注释、再去字符串：否则 "binary.UTF8" 这类字面量内容会被误判为成员调用
        const code = stripStrings(stripComment(raw));
        if (code.trimStart().startsWith('import'))
            continue;
        // 收集遮蔽： let/const/var NAME  /  func NAME  /  参数 NAME
        for (const declRe of [
            /\b(?:let|const|var)\s+([A-Za-z_][A-Za-z0-9_]*)/g,
            /\b([A-Za-z_][A-Za-z0-9_]*)\s*<-/g,
            /\bfunc\s+([A-Za-z_][A-Za-z0-9_]*)/g,
        ]) {
            let d;
            while ((d = declRe.exec(code)) !== null)
                shadowed.add(d[1]);
        }
        // 扫描 NAME. 形式
        for (let j = 0; j < code.length; j++) {
            if (!isIdentStart(code[j]))
                continue;
            // 必须位于行首或前一字符是非标识符（避免 foo.binary 这类）
            if (j > 0 && isIdentPart(code[j - 1]))
                continue;
            let k = j;
            while (k < code.length && isIdentPart(code[k]))
                k++;
            const name = code.slice(j, k);
            if (code[k] !== '.')
                continue;
            // 取点号后的成员名，用于确认这确实像命名空间成员调用
            const after = code.slice(k + 1);
            const member = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(after);
            if (!member)
                continue;
            // 大写开头的一般是类型/常量（binary.EOF、json.EOF），小写多为函数
            const members = ns_members_1.NS_MEMBERS[name];
            if (!members)
                continue;
            const known = members.includes(member[1]) ||
                // 命名空间常量（如 binary.EOF / time.DAY）也认
                /^[A-Z][A-Za-z0-9_]*$/.test(member[1]);
            if (!known)
                continue;
            if (info.namespaces.has(name))
                continue;
            if (shadowed.has(name))
                continue;
            out.push({
                ns: name,
                module: NS_TO_MODULE[name] || name,
                line: i,
                character: j,
                endCharacter: j + name.length,
            });
            j = k;
        }
    }
    return out;
}
/**
 * 去掉字符串字面量内容（替换成等长空格，保持列号不变）。
 *
 * 必须做：否则 let s = "binary.UTF8" 里的内容会被当成真实的成员调用，
 * 从而给一个根本不存在的 import 报「未导入」。
 * 用等长空白替换是为了不打乱 character 偏移。
 */
function stripStrings(line) {
    let out = '';
    let quote = null;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (quote) {
            if (c === '\\') {
                out += '  ';
                i++;
                if (i < line.length)
                    out += ' ';
                continue;
            }
            out += c === quote ? c : ' ';
            if (c === quote)
                quote = null;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') {
            quote = c;
            out += c;
            continue;
        }
        out += c;
    }
    return out;
}
/** 去掉行尾注释 */
function stripComment(line) {
    // 跳过字符串里的 #
    let inStr = null;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inStr) {
            if (c === '\\')
                i++;
            else if (c === inStr)
                inStr = null;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') {
            inStr = c;
            continue;
        }
        if (c === '#')
            return line.slice(0, i);
    }
    return line;
}
/**
 * 生成补上 import 的 TextEdit。
 *
 * 策略：
 *   - 已有 `import [...]` 列表 → 往里加一项（保持列表风格）
 *   - 已有 `import "x"` 单行     → 改成列表或追加一行
 *   - 完全没有 import            → 在 package 之后插入
 */
function buildImportEdit(text, info, modules) {
    const need = [...new Set(modules)].filter((m) => !info.modules.has(m));
    if (need.length === 0)
        return [];
    const lines = text.split('\n');
    // 情况 1：已有列表形式 import [...]
    const listRe = /^\s*import\s*\[/;
    let listLine = -1;
    for (let i = 0; i < lines.length; i++) {
        if (listRe.test(lines[i])) {
            listLine = i;
            break;
        }
    }
    if (listLine >= 0) {
        // 找到该 import 语句的结束行（] 所在行）与 ] 的列位置
        let closeLine = listLine;
        while (closeLine < lines.length && !/\]/.test(lines[closeLine]))
            closeLine++;
        const closeCol = lines[closeLine].indexOf(']');
        // 缩进推断：优先用列表内已有项的缩进；空列表则用 import 行的缩进 + 一个 tab
        let indent = '';
        for (let i = listLine + 1; i < closeLine; i++) {
            const m = /^(\s+)"/.exec(lines[i]);
            if (m) {
                indent = m[1];
                break;
            }
        }
        if (!indent) {
            const base = (lines[listLine].match(/^\s*/) || [''])[0] || '';
            indent = base + '\t';
        }
        const body = need.map((m) => `${indent}"${m}"`).join(',\n');
        if (closeCol > 0) {
            // ] 与内容同行，如 import ["json"] —— 单行风格用空格分隔，不套多行缩进
            const head = lines[closeLine].slice(0, closeCol).trimEnd();
            const sep = head.length > 0 && !head.endsWith(',') ? ', ' : '';
            const inline = need.map((m) => `"${m}"`).join(', ');
            return [node_1.TextEdit.insert({ line: closeLine, character: closeCol }, `${sep}${inline}`)];
        }
        // ] 独占一行：插到上一行末尾（插到 ] 之前会错位）
        const prev = closeLine - 1;
        const prevText = lines[prev].replace(/\s+$/, '');
        // 上一行就是 import [ 时说明列表为空，不能补逗号（否则出现 "import [," ）
        const isEmptyList = /\[\s*$/.test(prevText);
        const needsComma = !isEmptyList
            && prevText.length > 0
            && !prevText.endsWith(',');
        return [node_1.TextEdit.insert({ line: prev, character: prevText.length }, `${needsComma ? ',' : ''}\n${body}`)];
    }
    // 情况 2：已有单行 import "x"
    if (info.hasImport && info.lastImportLine >= 0) {
        const items = need.map((m) => `import "${m}"`).join('\n');
        const at = info.lastImportLine + 1;
        // 文件末尾没有换行时 at 可能等于 lines.length（等于末尾），
        // 直接用该行索引会越界，故改在最后一行末尾追加换行后再写。
        if (at < lines.length) {
            return [node_1.TextEdit.insert({ line: at, character: 0 }, items + '\n')];
        }
        const last = lines.length - 1;
        return [node_1.TextEdit.insert({ line: last, character: lines[last].length }, `\n${items}`)];
    }
    // 情况 3：没有 import —— 插到 package 行之后
    let insertLine = 0;
    for (let i = 0; i < lines.length; i++) {
        if (/^\s*package\b/.test(lines[i])) {
            insertLine = i + 1;
            break;
        }
    }
    const items = need.map((m) => `import "${m}"`).join('\n');
    const at = Math.min(insertLine, lines.length);
    return [node_1.TextEdit.insert({ line: at, character: 0 }, items + '\n')];
}
/**
 * 运行时命名空间 -> import 时要写的模块名。
 *
 * 例：strings.ToUpper 未导入时，应提示 import ["string"]（不是 "strings"）。
 */
function moduleForNamespace(ns) {
    return NS_TO_MODULE[ns] || ns;
}
//# sourceMappingURL=imports.js.map