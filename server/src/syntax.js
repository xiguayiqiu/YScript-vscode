"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syntaxDiagnostics = syntaxDiagnostics;
function diagnostic(token, message) {
    return {
        range: {
            start: { line: token.line - 1, character: token.col - 1 },
            end: { line: token.line - 1, character: Math.max(token.col, token.col - 1 + token.value.length) },
        },
        message,
        severity: 'error',
        source: 'yscript',
    };
}
function findClosingToken(tokens, start, open, close) {
    let depth = 0;
    for (let i = start; i < tokens.length; i++) {
        if (tokens[i].value === open)
            depth++;
        else if (tokens[i].value === close && --depth === 0)
            return i;
    }
    return -1;
}
function validName(token) {
    return token?.type === 'identifier' || token?.type === 'type' || token?.type === 'builtin' ||
        (token?.type === 'keyword' && (token.value === 'main' || token.value === 'init'));
}
function skipTypeParameters(tokens, start) {
    if (tokens[start]?.value !== '<')
        return { next: start };
    let i = start + 1;
    let expectName = true;
    let sawParameter = false;
    while (i < tokens.length) {
        if (expectName) {
            if (tokens[i]?.value === '>' && sawParameter)
                return { next: i + 1 };
            if (tokens[i]?.type !== 'identifier')
                return { next: i, error: tokens[i] };
            sawParameter = true;
            i++;
            if (tokens[i]?.value === ':') {
                i++;
                if (!validName(tokens[i]))
                    return { next: i, error: tokens[i] };
                i++;
            }
            expectName = false;
            continue;
        }
        if (tokens[i]?.value === ',') {
            i++;
            expectName = true;
        }
        else if (tokens[i]?.value === '>') {
            return { next: i + 1 };
        }
        else {
            return { next: i, error: tokens[i] };
        }
    }
    return { next: i, error: tokens[start] };
}
function genericClosingOperators(tokens) {
    const openings = [];
    const closings = new Set();
    const isTypeName = (token) => token?.type === 'identifier' || token?.type === 'type' || token?.type === 'builtin';
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.value === '<' && isTypeName(tokens[i - 1])) {
            openings.push(i);
            continue;
        }
        if (token.value !== '>' && token.value !== '>>')
            continue;
        const count = token.value === '>>' ? 2 : 1;
        if (openings.length < count)
            continue;
        const matchedOpenings = openings.splice(openings.length - count, count);
        const validContents = matchedOpenings.every((open) => tokens.slice(open + 1, i).every((part) => isTypeName(part) || [',', ':', '<', '>', '>>'].includes(part.value)));
        const next = tokens[i + 1];
        const validEnd = next && (next.line > token.line ||
            ['(', ')', '[', ']', '{', '}', ',', ';', ':', '=', '->', '.', '?.'].includes(next.value));
        if (validContents && validEnd)
            closings.add(i);
    }
    return closings;
}
function hasClosingQuote(value, quote) {
    if (!value.endsWith(quote))
        return false;
    let escapes = 0;
    for (let i = value.length - 2; i >= 0 && value[i] === '\\'; i--)
        escapes++;
    return escapes % 2 === 0;
}
function validateParameterList(tokens, open, close) {
    if (close === open + 1)
        return null;
    let expectName = true;
    let parens = 0;
    let brackets = 0;
    let braces = 0;
    for (let i = open + 1; i < close; i++) {
        const token = tokens[i];
        if (parens === 0 && brackets === 0 && braces === 0) {
            if (expectName && !validName(token))
                return token;
            if (token.value === ',') {
                if (expectName)
                    return token;
                expectName = true;
                continue;
            }
            if (expectName) {
                expectName = false;
                continue;
            }
        }
        if (token.value === '(')
            parens++;
        else if (token.value === ')')
            parens--;
        else if (token.value === '[')
            brackets++;
        else if (token.value === ']')
            brackets--;
        else if (token.value === '{')
            braces++;
        else if (token.value === '}')
            braces--;
    }
    return expectName ? tokens[close - 1] : null;
}
function validateImportList(tokens, open, close) {
    let i = open + 1;
    let count = 0;
    while (i < close) {
        while (tokens[i]?.type === 'comment')
            i++;
        if (i >= close)
            break;
        if (tokens[i].type !== 'string')
            return { token: tokens[i], message: 'import 列表项必须是字符串路径' };
        if (tokens[i].value.length <= 2)
            return { token: tokens[i], message: 'import 路径不能为空' };
        count++;
        i++;
        while (tokens[i]?.type === 'comment')
            i++;
        if (tokens[i]?.value === 'as') {
            i++;
            if (tokens[i]?.type !== 'identifier') {
                return { token: tokens[i] ?? tokens[i - 1], message: 'as 后需要别名' };
            }
            i++;
        }
        while (tokens[i]?.type === 'comment')
            i++;
        if (i < close && tokens[i].value === ',')
            i++;
        else if (i < close)
            return { token: tokens[i], message: 'import 列表元素之间需要用 , 分隔' };
    }
    if (count === 0)
        return { token: tokens[open], message: 'import 列表不能为空' };
    return null;
}
/** Syntax checks kept in the language server so editing and run checks need no ysc process. */
function syntaxDiagnostics(tokens) {
    const diagnostics = [];
    const reported = new Set();
    const genericClosings = genericClosingOperators(tokens);
    const report = (token, message) => {
        const key = `${token.start}:${message}`;
        if (reported.has(key))
            return;
        reported.add(key);
        diagnostics.push(diagnostic(token, message));
    };
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.type === 'unknown')
            report(token, `无法识别的字符 '${token.value}'`);
        if (token.type === 'string' || token.type === 'bytes' || token.type === 'shell') {
            const quote = token.type === 'bytes' || token.value.startsWith('$"') ? '"' : token.value[0];
            if (token.value.length < (token.type === 'bytes' ? 3 : 2) || !hasClosingQuote(token.value, quote)) {
                report(token, '字符串字面量未闭合');
            }
        }
        if (token.type === 'comment' &&
            ((token.value.startsWith('#*') && !token.value.endsWith('*#')) ||
                (token.value.startsWith('/*') && !token.value.endsWith('*/')))) {
            report(token, '块注释未闭合');
        }
        if (token.value === 'let' || token.value === 'var' || token.value === 'const') {
            if (!validName(tokens[i + 1]))
                report(token, '变量声明后需要变量名');
        }
        if (token.value === '<-') {
            const previous = tokens[i - 1];
            const next = tokens[i + 1];
            const beforePrevious = tokens[i - 2];
            const hasExpressionReceiver = beforePrevious?.line === token.line &&
                (beforePrevious.type === 'operator' || ['.', '?.', ']', ')'].includes(beforePrevious.value));
            if ((previous?.type !== 'identifier' && previous?.type !== 'type') || hasExpressionReceiver) {
                report(token, '<- 左侧必须是单个变量名');
            }
            if (!next || ['}', ')', ']', ';', ','].includes(next.value)) {
                report(token, '<- 后需要初始化表达式');
            }
        }
        if (['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='].includes(token.value)) {
            const next = tokens[i + 1];
            if (!next || ['}', ')', ']', ';', ','].includes(next.value)) {
                report(token, '赋值运算符后需要表达式');
            }
        }
        if (!genericClosings.has(i) && ['+', '-', '*', '/', '%', '==', '!=', '<', '>', '<=', '>=', '&&', '||', '<<', '>>',
            '&', '|', '^', '|>', 'in', 'matches', 'is', 'and', 'or', 'xor', '?', 'not'].includes(token.value)) {
            const next = tokens[i + 1];
            if (!next || ['}', ')', ']', ';', ','].includes(next.value)) {
                report(token, `运算符 '${token.value}' 后需要表达式`);
            }
        }
        if ((token.value === 'if' || token.value === 'while' || token.value === 'switch' || token.value === 'match') &&
            tokens[i + 1]?.value === '{') {
            report(tokens[i + 1], `${token.value} 后需要条件表达式`);
        }
    }
    let packageName = '';
    let packageCount = 0;
    let mainCount = 0;
    let lastTypeName = '';
    let braceDepth = 0;
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.value === '{') {
            braceDepth++;
            continue;
        }
        if (token.value === '}') {
            braceDepth = Math.max(0, braceDepth - 1);
            continue;
        }
        if (braceDepth !== 0 || token.type === 'comment')
            continue;
        if (token.value === 'package') {
            packageCount++;
            const name = tokens[i + 1];
            if (!validName(name))
                report(token, 'package 后需要包名');
            else
                packageName = name.value;
            if (packageCount > 1)
                report(token, '源文件只能声明一个 package');
            continue;
        }
        if (token.value === 'import') {
            const next = tokens[i + 1];
            if (next?.value === '[') {
                const close = findClosingToken(tokens, i + 1, '[', ']');
                if (close < 0)
                    report(next, 'import 列表未闭合');
                else {
                    const invalidItem = validateImportList(tokens, i + 1, close);
                    if (invalidItem)
                        report(invalidItem.token, invalidItem.message);
                    i = close;
                }
            }
            else if (next?.type !== 'string') {
                report(token, 'import 后需要模块路径或 [ 模块列表 ]');
            }
            else {
                i++;
            }
            continue;
        }
        if (token.value === 'struct' || token.value === 'class') {
            const name = tokens[i + 1];
            if (!validName(name)) {
                report(token, `${token.value} 后需要名称`);
                continue;
            }
            lastTypeName = name.value;
            let open = i + 2;
            const typeParams = skipTypeParameters(tokens, open);
            if (typeParams.error)
                report(typeParams.error, '泛型类型参数格式不正确');
            open = typeParams.next;
            if (tokens[open]?.value === 'extends')
                open += 2;
            if (tokens[open]?.value !== '{')
                report(tokens[open] ?? name, `${token.value} 声明后需要 {`);
            continue;
        }
        if (token.value === 'enum' || token.value === 'interface') {
            const name = tokens[i + 1];
            if (!validName(name))
                report(token, `${token.value} 后需要名称`);
            else if (tokens[i + 2]?.value !== '{')
                report(tokens[i + 2] ?? name, `${token.value} 声明后需要 {`);
            continue;
        }
        if (token.value !== 'func' && token.value !== 'init')
            continue;
        let nameIndex = i + 1;
        let method = false;
        if (token.value === 'func' && tokens[nameIndex]?.value === 'this' && tokens[nameIndex + 1]?.value === '.') {
            method = true;
            nameIndex += 2;
            if (!lastTypeName)
                report(token, 'func this.method 必须关联到前置的 struct/class 声明');
        }
        const name = token.value === 'init' ? token : tokens[nameIndex];
        if (token.value === 'func' && !validName(name)) {
            report(token, 'func 后需要函数名');
            continue;
        }
        if (!method && name.value === 'main') {
            mainCount++;
            if (packageName && packageName !== 'main')
                report(token, 'func main() 只能在 package main 下声明');
            if (mainCount > 1)
                report(token, 'func main() 重复定义');
        }
        let open = token.value === 'init' ? i + 1 : nameIndex + 1;
        if (!method && token.value === 'func') {
            const typeParams = skipTypeParameters(tokens, open);
            if (typeParams.error)
                report(typeParams.error, '泛型函数类型参数格式不正确');
            open = typeParams.next;
        }
        if (tokens[open]?.value !== '(') {
            report(tokens[open] ?? name, token.value === 'init' ? 'init 后缺少 (' : '函数名后缺少 (');
            continue;
        }
        const close = findClosingToken(tokens, open, '(', ')');
        if (close < 0) {
            report(tokens[open], '参数列表未闭合');
            continue;
        }
        const invalidParam = validateParameterList(tokens, open, close);
        if (invalidParam)
            report(invalidParam, '函数参数列表格式不正确');
        let body = close + 1;
        if (tokens[body]?.value === '->') {
            body++;
            if (tokens[body]?.value === '{') {
                body = findClosingToken(tokens, body, '{', '}');
                if (body < 0)
                    report(tokens[close + 1], '函数体未闭合');
            }
            else if (!tokens[body] || tokens[body].value === '}' || tokens[body].value === ';') {
                report(tokens[close + 1], '箭头函数体不能为空');
            }
            else {
                while (body < tokens.length && tokens[body].line === tokens[body - 1].line)
                    body++;
                body--;
            }
        }
        else if (tokens[body]?.value === '{') {
            body = findClosingToken(tokens, body, '{', '}');
            if (body < 0)
                report(tokens[close + 1], '函数体未闭合');
        }
        else {
            report(tokens[body] ?? tokens[close], '函数声明后需要函数体');
            continue;
        }
        i = Math.max(i, body);
        if (!method && name.value === 'main' && packageName !== 'main') {
            report(token, 'func main() 必须在 package main 下声明');
        }
    }
    return diagnostics;
}
//# sourceMappingURL=syntax.js.map