/**
 * YScript 词法分析器
 * 简单的基于正则的 tokenizer，为 LSP 服务器提供词法支持。
 * 不追求完整解析，仅用于诊断、补全、悬停等语言服务。
 */

export type TokenType =
  | 'keyword'
  | 'type'
  | 'builtin'
  | 'literal'
  | 'number'
  | 'string'
  | 'shell'
  | 'bytes'
  | 'comment'
  | 'operator'
  | 'identifier'
  | 'punctuation'
  | 'test'
  | 'whitespace'
  | 'unknown';

export interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
  line: number;
  col: number;
}

const KEYWORDS = new Set([
  'let', 'const', 'func', 'struct', 'enum', 'interface',
  'if', 'else', 'elif', 'switch', 'case', 'default',
  'for', 'in', 'range', 'while', 'loop', 'break', 'continue',
  'return', 'yield', 'goto', 'assert',
  'defer', 'match', 'warp', 'import', 'package', 'as', 'do',
  'and', 'or', 'not', 'xor', 'matches', 'is',
  'this', 'main', 'init', 'panic', 'recover',
  'try', 'catch', 'finally',
]);

const TYPES = new Set([
  'byte', 'char', 'short', 'ushort', 'int', 'uint', 'long', 'ulong',
  'float', 'double', 'bool', 'string', 'bytes', 'list', 'dict',
  'ipv4', 'ipv6', 'command', 'error', 'void',
]);

const BUILTINS = new Set([
  'print', 'println', 'printf', 'sprintf',
  'len', 'type', 'eval', 'next',
  'string', 'int', 'float', 'bool', 'byte', 'char', 'bytes', 'hex',
  'ipv4', 'ipv6',
  'panic', 'recover', 'assert',
  'json', 'regex', 'encoding',
  'net', 'io', 'os', 'sys', 'path', 'strings', 'binary',
  'crypto', 'aes', 'rsa', 'ssl', 'raw', 'ffi',
  'sync', 'time', 'rand', 'log', 'stdio', 'color',
  'yaml', 'toml', 'ini',
  'reflect', 'errors', 'compress', 'cuda',
]);

const LITERALS = new Set(['true', 'false', 'nil', 'nan', 'inf']);

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const len = source.length;

  const push = (type: TokenType, value: string, start: number, end: number, l: number, c: number) => {
    if (type !== 'whitespace') tokens.push({ type, value, start, end, line: l, col: c });
  };

  while (i < len) {
    const ch = source[i];
    const start = i;
    const startLine = line;
    const startCol = col;

    // 换行
    if (ch === '\n') {
      push('whitespace', ch, start, i + 1, startLine, startCol);
      i++; line++; col = 1;
      continue;
    }
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      push('whitespace', ch, start, i + 1, startLine, startCol);
      i++; col++;
      continue;
    }

    // 行注释 (# ...)
    if (ch === '#' && source[i + 1] !== '*') {
      let j = i;
      while (j < len && source[j] !== '\n') j++;
      push('comment', source.slice(i, j), start, j, startLine, startCol);
      col += (j - i); i = j;
      continue;
    }
    // 块注释 (#* ... *#)
    if (ch === '#' && source[i + 1] === '*') {
      let j = i + 2;
      while (j < len && !(source[j] === '*' && source[j + 1] === '#')) {
        if (source[j] === '\n') { line++; col = 1; j++; continue; }
        j++;
      }
      j = Math.min(j + 2, len);
      push('comment', source.slice(i, j), start, j, startLine, startCol);
      col += (j - i); i = j;
      continue;
    }

    // Shell 命令（反引号）
    if (ch === '`') {
      let j = i + 1;
      while (j < len && source[j] !== '`') {
        if (source[j] === '\n') { line++; col = 1; j++; continue; }
        j++;
      }
      j = Math.min(j + 1, len);
      push('shell', source.slice(i, j), start, j, startLine, startCol);
      col += (j - i); i = j;
      continue;
    }

    // bytes 字面量
    if (ch === 'b' && source[i + 1] === '"') {
      let j = i + 2;
      while (j < len && source[j] !== '"') {
        if (source[j] === '\\') j++;
        if (source[j] === '\n') { line++; col = 1; j++; continue; }
        j++;
      }
      j = Math.min(j + 1, len);
      push('bytes', source.slice(i, j), start, j, startLine, startCol);
      col += (j - i); i = j;
      continue;
    }

    // 普通字符串
    if (ch === '"') {
      let j = i + 1;
      while (j < len && source[j] !== '"') {
        if (source[j] === '\\') j++;
        if (source[j] === '\n') { line++; col = 1; j++; continue; }
        j++;
      }
      j = Math.min(j + 1, len);
      push('string', source.slice(i, j), start, j, startLine, startCol);
      col += (j - i); i = j;
      continue;
    }

    // 数字
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(source[i + 1] || ''))) {
      let j = i;
      if (source[j] === '0' && (source[j + 1] === 'x' || source[j + 1] === 'X')) {
        j += 2;
        while (j < len && /[0-9a-fA-F_]/.test(source[j])) j++;
      } else if (source[j] === '0' && (source[j + 1] === 'b' || source[j + 1] === 'B')) {
        j += 2;
        while (j < len && /[01_]/.test(source[j])) j++;
      } else if (source[j] === '0' && (source[j + 1] === 'o' || source[j + 1] === 'O')) {
        j += 2;
        while (j < len && /[0-7_]/.test(source[j])) j++;
      } else {
        while (j < len && /[0-9_]/.test(source[j])) j++;
        if (source[j] === '.') {
          j++;
          while (j < len && /[0-9_]/.test(source[j])) j++;
        }
        if (source[j] === 'e' || source[j] === 'E') {
          j++;
          if (source[j] === '+' || source[j] === '-') j++;
          while (j < len && /[0-9_]/.test(source[j])) j++;
        }
      }
      push('number', source.slice(i, j), start, j, startLine, startCol);
      col += (j - i); i = j;
      continue;
    }

    // test 操作符
    if (ch === '-' && /[a-zA-Z]/.test(source[i + 1] || '')) {
      let j = i + 1;
      while (j < len && /[a-zA-Z]/.test(source[j])) j++;
      const op = source.slice(i, j);
      if (['-e', '-f', '-d', '-r', '-w', '-x', '-s', '-L', '-h', '-b', '-c', '-p', '-S',
        '-z', '-n', '-eq', '-ne', '-gt', '-lt', '-ge', '-le'].includes(op)) {
        push('test', op, start, j, startLine, startCol);
        col += (j - i); i = j;
        continue;
      }
    }

    // 标识符 / 关键字
    if (/[_a-zA-Z]/.test(ch)) {
      let j = i;
      while (j < len && /[_a-zA-Z0-9]/.test(source[j])) j++;
      const word = source.slice(i, j);
      let type: TokenType = 'identifier';
      if (KEYWORDS.has(word)) type = 'keyword';
      else if (TYPES.has(word)) type = 'type';
      else if (BUILTINS.has(word)) type = 'builtin';
      else if (LITERALS.has(word)) type = 'literal';
      push(type, word, start, j, startLine, startCol);
      col += (j - i); i = j;
      continue;
    }

    // 多字符操作符
    const two = source.slice(i, i + 2);
    const three = source.slice(i, i + 3);
    if (three === '<<=' || three === '>>=' || three === '||' && source[i] === '|') {
      // skip, fall to single char handle
    }
    if (['==', '!=', '<=', '>=', '&&', '||', '<<', '>>', '+=', '-=', '*=', '/=', '%=',
      '&=', '|=', '^=', '=>', '::', '?:', '?.'].includes(two)) {
      push('operator', two, start, i + 2, startLine, startCol);
      col += 2; i += 2;
      continue;
    }

    // 单字符操作符 / 标点
    if (/[+\-*/%<>=!&|^~?:.]/.test(ch)) {
      push('operator', ch, start, i + 1, startLine, startCol);
      i++; col++;
      continue;
    }
    if (/[{}()\[\];,@]/.test(ch)) {
      push('punctuation', ch, start, i + 1, startLine, startCol);
      i++; col++;
      continue;
    }

    // 未知
    push('unknown', ch, start, i + 1, startLine, startCol);
    i++; col++;
  }

  return tokens;
}

/** 简单的括号匹配诊断 */
export interface Diagnostic {
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
  message: string;
  severity: 'error' | 'warning' | 'information' | 'hint';
  source: string;
}

export function analyze(tokens: Token[], source: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // 括号配对
  const stack: { ch: string; line: number; col: number; pos: number }[] = [];
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const lineMap = computeLineMap(source);

  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\n') { i++; continue; }
    // 跳过字符串和注释（yscript 注释：# 行注释、#* ... *# 块注释）
    if (ch === '#' && source[i + 1] !== '*') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (ch === '#' && source[i + 1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '#')) i++;
      i += 2;
      continue;
    }
    // 兼容历史遗留的 C 风格注释
    if (ch === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === '`') {
      const quote = ch;
      i++;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\' && i + 1 < source.length) i += 2;
        else i++;
      }
      i++;
      continue;
    }
    if (pairs[ch]) {
      const pos = lineMap.positionAt(i);
      stack.push({ ch, line: pos.line, col: pos.character, pos: i });
    } else if (ch === ')' || ch === ']' || ch === '}') {
      const top = stack.pop();
      if (!top || pairs[top.ch] !== ch) {
        const pos = lineMap.positionAt(i);
        diagnostics.push({
          range: {
            start: { line: pos.line, character: pos.character },
            end: { line: pos.line, character: pos.character + 1 },
          },
          message: `多余的 '${ch}'`,
          severity: 'error',
          source: 'yscript',
        });
      }
    }
    i++;
  }

  while (stack.length) {
    const t = stack.pop()!;
    diagnostics.push({
      range: {
        start: { line: t.line, character: t.col },
        end: { line: t.line, character: t.col + 1 },
      },
      message: `未闭合的 '${t.ch}'`,
      severity: 'error',
      source: 'yscript',
    });
  }

  return diagnostics;
}

interface LineMap {
  positionAt(offset: number): { line: number; character: number };
  offsetAt(line: number, character: number): number;
}

function computeLineMap(source: string): LineMap {
  const lineStarts: number[] = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\n') lineStarts.push(i + 1);
  }
  return {
    positionAt(offset) {
      let lo = 0, hi = lineStarts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (lineStarts[mid] <= offset) lo = mid;
        else hi = mid - 1;
      }
      return { line: lo, character: offset - lineStarts[lo] };
    },
    offsetAt(line, character) {
      const base = lineStarts[Math.min(line, lineStarts.length - 1)] ?? 0;
      return base + character;
    },
  };
}

export const _internal = { computeLineMap };

/**
 * 格式化 YScript 源码：基于词法 token 的智能缩进。
 * - 注释、字符串、反引号 shell、bytes 字面量内的括号不会影响缩进
 * - 多行块注释续行按当前深度重排，多行字符串/反引号续行保持原样
 * - else/elif/catch/finally 单独成行时与 if/try 对齐
 * - 逗号后补空格、赋值号两侧补空格
 * 返回格式化后的完整文本；无需改动时内容不变。
 */
export function formatSource(text: string, tabSize: number): string {
  const indent = ' '.repeat(Math.max(1, Math.min(tabSize || 4, 8)));
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);

  const lineStarts: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') lineStarts.push(i + 1);
  }
  const lineIndexOf = (offset: number): number => {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  const tokens = tokenize(text);

  // 每行的标点/运算符/关键字 token（注释与字符串内容已被词法器排除）
  const lineTokens: Token[][] = Array.from({ length: lines.length }, () => []);
  for (const t of tokens) {
    if (t.type === 'punctuation' || t.type === 'operator' || t.type === 'keyword') {
      lineTokens[lineIndexOf(t.start)].push(t);
    }
  }

  // 跨行 token 的续行标记
  const inCommentCont = new Array<boolean>(lines.length).fill(false);
  const inTextCont = new Array<boolean>(lines.length).fill(false);
  for (const t of tokens) {
    if (t.type !== 'comment' && t.type !== 'string' && t.type !== 'shell' && t.type !== 'bytes') continue;
    const newlines = (t.value.match(/\n/g) || []).length;
    if (newlines === 0) continue;
    const startLine = t.line - 1;
    const isBlockComment = t.type === 'comment' && t.value.startsWith('#*');
    for (let k = startLine + 1; k <= startLine + newlines && k < lines.length; k++) {
      if (isBlockComment) inCommentCont[k] = true;
      else inTextCont[k] = true;
    }
  }

  const out: string[] = [];
  let depth = 0;

  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li];

    // 多行字符串/反引号续行：保持原样，避免改变字符串内容
    if (inTextCont[li]) {
      out.push(raw.replace(/\s+$/, ''));
      continue;
    }
    // 多行块注释续行：按当前深度重排缩进（注释内容无运行语义，安全）
    if (inCommentCont[li]) {
      const t = raw.replace(/\t/g, indent).trim();
      out.push(t.length > 0 ? indent.repeat(depth) + t : '');
      continue;
    }

    if (raw.trim().length === 0) {
      out.push('');
      continue;
    }

    // 行内空格规整（基于 token 偏移，不会动注释/字符串）
    let line = addSpacing(raw, lineStarts[li], lineTokens[li]);
    line = line.replace(/\t/g, indent).replace(/\s+$/, '');
    const trimmed = line.trim();

    // 行首闭合括号 → 减少缩进
    const leadingCloses = (trimmed.match(/^[}\])]+/) || [''])[0].length;
    let lineDepth = Math.max(0, depth - leadingCloses);

    // else/elif/catch/finally 单独成行时与 if/try 对齐
    if (!trimmed.startsWith('}') && /^(else|elif|catch|finally)\b/.test(trimmed)) {
      lineDepth = Math.max(0, lineDepth - 1);
    }

    out.push(indent.repeat(lineDepth) + trimmed);

    // 更新缩进深度（只统计真实代码中的括号）
    let opens = 0;
    let closes = 0;
    for (const t of lineTokens[li]) {
      if (t.value === '{' || t.value === '(' || t.value === '[') opens++;
      else if (t.value === '}' || t.value === ')' || t.value === ']') closes++;
    }
    depth = Math.max(0, depth + opens - closes);
  }

  return out.join(eol);
}

const BLOCK_KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'try', 'else', 'elif', 'finally',
  'do', 'match', 'warp', 'struct', 'interface', 'class', 'enum', 'loop',
  'using', 'namespace',
]);

/**
 * 在行内按 token 边界补充空格：
 * 逗号后一空格、赋值号两侧各一空格、else/elif/catch/finally 两侧空格、
 * 块开括号 { 前补空格（仅在 `)`/`]` 之后或关键字之后，避免改动 Point{...} 结构体字面量）。
 */
function addSpacing(line: string, lineStart: number, toks: Token[]): string {
  const edits: { pos: number; text: string }[] = [];
  for (const t of toks) {
    const ls = t.start - lineStart;
    const le = t.end - lineStart;
    if (t.value === ',') {
      const next = line[le];
      if (le < line.length && next !== ' ' && next !== ')' && next !== ']' && next !== '}') {
        edits.push({ pos: le, text: ' ' });
      }
    } else if (t.value === '=') {
      if (ls > 0 && line[ls - 1] !== ' ') edits.push({ pos: ls, text: ' ' });
      const next = line[le];
      if (le < line.length && next !== ' ') edits.push({ pos: le, text: ' ' });
    } else if (t.value === '{') {
      const prevChar = ls > 0 ? line[ls - 1] : '';
      const prevTok = lastTokenEndingAt(toks, lineStart, ls);
      if (
        prevChar !== ' ' && prevChar !== '\t' &&
        (prevChar === ')' || prevChar === ']' || (prevTok !== null && BLOCK_KEYWORDS.has(prevTok.value)))
      ) {
        edits.push({ pos: ls, text: ' ' });
      }
    } else if (t.value === 'else' || t.value === 'elif' || t.value === 'catch' || t.value === 'finally') {
      if (ls > 0 && line[ls - 1] !== ' ') edits.push({ pos: ls, text: ' ' });
      const next = line[le];
      if (le < line.length && next !== ' ') edits.push({ pos: le, text: ' ' });
    }
  }
  if (edits.length === 0) return line;
  edits.sort((a, b) => b.pos - a.pos);
  let lastPos = -1;
  for (const e of edits) {
    if (e.pos === lastPos) continue; // 同一位置只插入一次，避免 `} else  {` 双空格
    lastPos = e.pos;
    line = line.slice(0, e.pos) + e.text + line.slice(e.pos);
  }
  return line;
}

/** 返回该行中结束位置 <= pos 的最后一个 token（用于判断 { 前是关键字还是类型名） */
function lastTokenEndingAt(toks: Token[], lineStart: number, pos: number): Token | null {
  let found: Token | null = null;
  for (const t of toks) {
    const le = t.end - lineStart;
    if (le <= pos) found = t;
    else break;
  }
  return found;
}
