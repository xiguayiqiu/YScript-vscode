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
  'let', 'const', 'var', 'func', 'init', 'class', 'struct', 'enum',
  'interface', 'map', 'if', 'else', 'elif', 'switch', 'case', 'default',
  'for', 'in', 'range', 'while', 'loop', 'do', 'break', 'continue',
  'return', 'yield', 'goto', 'try', 'catch', 'finally', 'raise', 'assert',
  'defer', 'match', 'warp', 'import', 'package', 'using', 'as',
  'namespace', 'and', 'or', 'not', 'xor', 'matches', 'is', 'new',
  'self', 'this',
]);

const TYPES = new Set([
  'byte', 'char', 'short', 'ushort', 'int', 'uint', 'long', 'ulong',
  'float', 'double', 'bool', 'string', 'bytes', 'list', 'dict',
  'ipv4', 'ipv6', 'command', 'error', 'void',
]);

const BUILTINS = new Set([
  'print', 'println', 'printf', 'sprintf', 'read', 'readln',
  'len', 'range', 'append', 'delete', 'exists', 'keys', 'values',
  'push', 'pop', 'shift', 'unshift', 'slice', 'join', 'split',
  'int', 'float', 'string', 'bool', 'byte', 'char', 'bytes',
  'hex', 'oct', 'bin', 'ord', 'chr',
  'errors', 'panic', 'assert', 'type', 'typeof', 'isnil', 'sizeof',
  'ipv4', 'ipv6', 'cidr',
  'json', 'regex', 'base64', 'hex_encode', 'hex_decode', 'url_encode', 'url_decode',
  'time', 'now', 'sleep', 'open', 'close', 'read_file', 'write_file',
  'file_exists', 'is_dir', 'is_file', 'glob', 'walk', 'md5', 'sha1', 'sha256',
  'hmac', 'encrypt', 'decrypt', 'rand', 'random',
  'list', 'dict', 'tuple', 'set', 'frozenset',
  'http_get', 'http_post', 'tcp_connect', 'udp_send', 'ssl_connect',
  'warp', 'channel', 'mutex', 'rwlock', 'semaphore', 'waitgroup',
  'log_info', 'log_warn', 'log_error', 'log_debug', 'log_trace',
  'stdin', 'stdout', 'stderr', 'env', 'args', 'argv', 'exit', 'abort',
  'getenv', 'setenv', 'unsetenv', 'shell', 'system', 'exec', 'spawn',
  'socket', 'bind', 'listen', 'accept', 'connect', 'send', 'recv',
  'malloc', 'free', 'memcpy', 'memset', 'pointer', 'deref', 'ref',
  'ffi_call', 'dll_load', 'dll_sym', 'reflect', 'call', 'invoke',
  'version', 'platform', 'os', 'arch', 'cwd', 'chdir', 'mkdir', 'rmdir',
  'ls', 'cp', 'mv', 'rm', 'touch', 'cat', 'head', 'tail', 'wc', 'grep',
  'awk', 'sed', 'sort', 'uniq', 'tr', 'cut', 'tee', 'xargs',
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

    // 行注释
    if (ch === '/' && source[i + 1] === '/') {
      let j = i;
      while (j < len && source[j] !== '\n') j++;
      push('comment', source.slice(i, j), start, j, startLine, startCol);
      col += (j - i); i = j;
      continue;
    }
    // 块注释
    if (ch === '/' && source[i + 1] === '*') {
      let j = i + 2;
      while (j < len && !(source[j] === '*' && source[j + 1] === '/')) {
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
    // 跳过字符串和注释
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
