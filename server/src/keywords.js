"use strict";
/**
 * YScript 语言元数据：关键字、类型、内置函数。
 *
 * 供 LSP 补全、悬停、签名帮助使用。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SNIPPETS = exports.TYPE_INFERENCE_RULES = exports.TYPE_MEMBERS = exports.BUILTIN_FUNCTIONS = exports.TYPES = exports.KEYWORDS = void 0;
exports.buildAllCompletions = buildAllCompletions;
exports.buildHoverDoc = buildHoverDoc;
exports.KEYWORDS = [
    { label: 'let', kind: 'keyword', detail: '声明块级变量', insertText: 'let ${1:name} = ${0:value}', sortKey: 10 },
    { label: 'const', kind: 'keyword', detail: '声明常量', insertText: 'const ${1:NAME} = ${0:value}', sortKey: 10 },
    { label: 'var', kind: 'keyword', detail: '声明可重新赋值的变量', insertText: 'var ${1:name} = ${0:value}', sortKey: 10 },
    { label: 'func', kind: 'keyword', detail: '函数定义', insertText: 'func ${1:name}(${2:args}) {\n\t${0}\n}', sortKey: 10 },
    { label: 'init', kind: 'keyword', detail: '初始化函数（main 之前自动执行）', insertText: 'init() {\n\t${0}\n}', sortKey: 10 },
    { label: 'class', kind: 'keyword', detail: '类定义', insertText: 'class ${1:Name} {\n\t${0}\n}', sortKey: 10 },
    { label: 'struct', kind: 'keyword', detail: '结构体定义', insertText: 'struct ${1:Name} {\n\t${0}\n}', sortKey: 10 },
    { label: 'enum', kind: 'keyword', detail: '枚举定义', insertText: 'enum ${1:Name} {\n\t${0}\n}', sortKey: 10 },
    { label: 'interface', kind: 'keyword', detail: '接口定义', insertText: 'interface ${1:Name} {\n\t${0}\n}', sortKey: 10 },
    { label: 'warp', kind: 'keyword', detail: '并发协程', insertText: 'warp ${1:func}(${2:args})', sortKey: 10 },
    { label: 'if', kind: 'keyword', detail: '条件判断', insertText: 'if ${1:cond} {\n\t${0}\n}', sortKey: 10 },
    { label: 'else', kind: 'keyword', detail: '否则分支', sortKey: 11 },
    { label: 'elif', kind: 'keyword', detail: '否则如果', sortKey: 11 },
    { label: 'for', kind: 'keyword', detail: 'for-in 循环', insertText: 'for ${1:i} in ${2:iter} {\n\t${0}\n}', sortKey: 10 },
    { label: 'while', kind: 'keyword', detail: '条件循环', insertText: 'while ${1:cond} {\n\t${0}\n}', sortKey: 10 },
    { label: 'loop', kind: 'keyword', detail: '无限循环', insertText: 'loop {\n\t${0}\n}', sortKey: 10 },
    { label: 'break', kind: 'keyword', detail: '跳出循环', sortKey: 12 },
    { label: 'continue', kind: 'keyword', detail: '跳过本次循环', sortKey: 12 },
    { label: 'return', kind: 'keyword', detail: '函数返回', insertText: 'return ${0:value}', sortKey: 12 },
    { label: 'match', kind: 'keyword', detail: '模式匹配', insertText: 'match ${1:val} {\n\t${2:pattern} => ${3:body}\n\t_ => ${0:default}\n}', sortKey: 10 },
    { label: 'switch', kind: 'keyword', detail: 'switch 分支', insertText: 'switch ${1:val} {\n\tcase ${2:pat}: ${0}\n}', sortKey: 10 },
    { label: 'try', kind: 'keyword', detail: 'try-catch 块', insertText: 'try {\n\t${1}\n} catch ${2:e} {\n\t${0}\n}', sortKey: 10 },
    { label: 'catch', kind: 'keyword', detail: '异常捕获', sortKey: 11 },
    { label: 'finally', kind: 'keyword', detail: '最终块', sortKey: 11 },
    { label: 'raise', kind: 'keyword', detail: '抛出异常', insertText: 'raise ${0:err}', sortKey: 12 },
    { label: 'assert', kind: 'keyword', detail: '断言', insertText: 'assert ${1:cond}, "${0:msg}"', sortKey: 12 },
    { label: 'defer', kind: 'keyword', detail: '延迟执行', insertText: 'defer ${0:expr}', sortKey: 12 },
    { label: 'goto', kind: 'keyword', detail: '跳转到标签', sortKey: 12 },
    { label: 'import', kind: 'keyword', detail: '导入模块', insertText: 'import "${1:path}"', sortKey: 10 },
    { label: 'package', kind: 'keyword', detail: '声明包名', insertText: 'package ${1:name}', sortKey: 10 },
    { label: 'using', kind: 'keyword', detail: 'using 引用', sortKey: 11 },
    { label: 'namespace', kind: 'keyword', detail: '命名空间', insertText: 'namespace ${1:name} {\n\t${0}\n}', sortKey: 10 },
    { label: 'and', kind: 'keyword', detail: '逻辑与（&&）', sortKey: 13 },
    { label: 'or', kind: 'keyword', detail: '逻辑或（||）', sortKey: 13 },
    { label: 'not', kind: 'keyword', detail: '逻辑非（!）', sortKey: 13 },
    { label: 'xor', kind: 'keyword', detail: '异或', sortKey: 13 },
    { label: 'in', kind: 'keyword', detail: '属于（成员判断）', sortKey: 13 },
    { label: 'is', kind: 'keyword', detail: '类型判断', sortKey: 13 },
    { label: 'matches', kind: 'keyword', detail: '正则匹配', sortKey: 13 },
    { label: 'new', kind: 'keyword', detail: '实例化', sortKey: 12 },
    { label: 'self', kind: 'keyword', detail: '当前对象', sortKey: 12 },
    { label: 'this', kind: 'keyword', detail: '当前对象（同 self）', sortKey: 12 },
    { label: 'as', kind: 'keyword', detail: '类型转换', sortKey: 12 },
    { label: 'true', kind: 'constant', detail: '布尔真', sortKey: 14 },
    { label: 'false', kind: 'constant', detail: '布尔假', sortKey: 14 },
    { label: 'nil', kind: 'constant', detail: '空值', sortKey: 14 },
    { label: 'nan', kind: 'constant', detail: '非数字', sortKey: 14 },
    { label: 'inf', kind: 'constant', detail: '无穷大', sortKey: 14 },
];
exports.TYPES = [
    { label: 'byte', kind: 'type', detail: '字节类型 (0..255)' },
    { label: 'char', kind: 'type', detail: '字符类型' },
    { label: 'short', kind: 'type', detail: '16 位有符号整数' },
    { label: 'ushort', kind: 'type', detail: '16 位无符号整数' },
    { label: 'int', kind: 'type', detail: '32 位有符号整数' },
    { label: 'uint', kind: 'type', detail: '32 位无符号整数' },
    { label: 'long', kind: 'type', detail: '64 位有符号整数' },
    { label: 'ulong', kind: 'type', detail: '64 位无符号整数' },
    { label: 'float', kind: 'type', detail: '32 位浮点' },
    { label: 'double', kind: 'type', detail: '64 位浮点' },
    { label: 'bool', kind: 'type', detail: '布尔类型' },
    { label: 'string', kind: 'type', detail: '字符串类型' },
    { label: 'bytes', kind: 'type', detail: '字节数组' },
    { label: 'list', kind: 'type', detail: '列表类型 list<T>', insertText: 'list<${1:T}>' },
    { label: 'dict', kind: 'type', detail: '字典类型 dict<K,V>', insertText: 'dict<${1:K}, ${2:V}>' },
    { label: 'map', kind: 'type', detail: '映射类型 map<K,V>', insertText: 'map<${1:K}, ${2:V}>' },
    { label: 'ipv4', kind: 'type', detail: 'IPv4 地址' },
    { label: 'ipv6', kind: 'type', detail: 'IPv6 地址' },
    { label: 'command', kind: 'type', detail: 'Shell 命令对象' },
    { label: 'error', kind: 'type', detail: '错误对象' },
    { label: 'void', kind: 'type', detail: '无返回值' },
];
/** 内置函数（含签名） */
exports.BUILTIN_FUNCTIONS = [
    // I/O
    { label: 'print', kind: 'function', detail: '打印到 stdout', signature: 'print(...args) -> void', insertText: 'print(${0})' },
    { label: 'println', kind: 'function', detail: '打印并换行', signature: 'println(...args) -> void', insertText: 'println(${0})' },
    { label: 'printf', kind: 'function', detail: '格式化输出', signature: 'printf(fmt: string, ...args) -> void', insertText: 'printf("${1:fmt}", ${0:args})' },
    { label: 'sprintf', kind: 'function', detail: '格式化字符串', signature: 'sprintf(fmt: string, ...args) -> string', insertText: 'sprintf("${1:fmt}", ${0:args})' },
    { label: 'read', kind: 'function', detail: '读取输入', signature: 'read() -> string' },
    { label: 'readln', kind: 'function', detail: '读取一行', signature: 'readln() -> string' },
    // 类型转换
    { label: 'int', kind: 'function', detail: '转 int', signature: 'int(v) -> int', insertText: 'int(${0:v})' },
    { label: 'float', kind: 'function', detail: '转 float', signature: 'float(v) -> float', insertText: 'float(${0:v})' },
    { label: 'string', kind: 'function', detail: '转 string', signature: 'string(v) -> string', insertText: 'string(${0:v})' },
    { label: 'bool', kind: 'function', detail: '转 bool', signature: 'bool(v) -> bool', insertText: 'bool(${0:v})' },
    { label: 'ord', kind: 'function', detail: '字符→整数', signature: 'ord(c: char) -> int' },
    { label: 'chr', kind: 'function', detail: '整数→字符', signature: 'chr(n: int) -> char' },
    { label: 'hex', kind: 'function', detail: '整数→十六进制字符串', signature: 'hex(n: int) -> string' },
    { label: 'oct', kind: 'function', detail: '整数→八进制字符串', signature: 'oct(n: int) -> string' },
    { label: 'bin', kind: 'function', detail: '整数→二进制字符串', signature: 'bin(n: int) -> string' },
    // 容器操作
    { label: 'len', kind: 'function', detail: '取长度', signature: 'len(v) -> int' },
    { label: 'range', kind: 'function', detail: '生成范围', signature: 'range(start: int, end: int, step?: int) -> list<int>', insertText: 'range(${1:0}, ${2:10})' },
    { label: 'append', kind: 'function', detail: '追加元素', signature: 'append(list, item) -> void' },
    { label: 'push', kind: 'function', detail: '压栈（append 同义）', signature: 'push(list, item) -> void' },
    { label: 'pop', kind: 'function', detail: '弹栈', signature: 'pop(list) -> T' },
    { label: 'delete', kind: 'function', detail: '删除元素', signature: 'delete(list, idx|key) -> void' },
    { label: 'exists', kind: 'function', detail: '判断存在', signature: 'exists(dict, key) -> bool' },
    { label: 'keys', kind: 'function', detail: '取所有键', signature: 'keys(dict) -> list' },
    { label: 'values', kind: 'function', detail: '取所有值', signature: 'values(dict) -> list' },
    // 元信息
    { label: 'type', kind: 'function', detail: '取类型', signature: 'type(v) -> string' },
    { label: 'typeof', kind: 'function', detail: '取类型字符串', signature: 'typeof(v) -> string' },
    { label: 'isnil', kind: 'function', detail: '判断 nil', signature: 'isnil(v) -> bool' },
    { label: 'sizeof', kind: 'function', detail: '取大小', signature: 'sizeof(v) -> int' },
    // 字符串
    { label: 'split', kind: 'function', detail: '分割字符串', signature: 'split(s: string, sep: string) -> list<string>' },
    { label: 'join', kind: 'function', detail: '连接字符串', signature: 'join(list, sep: string) -> string' },
    { label: 'slice', kind: 'function', detail: '切片', signature: 'slice(s, start, end?) -> string|list' },
    { label: 'lower', kind: 'function', detail: '小写', signature: 'lower(s: string) -> string' },
    { label: 'upper', kind: 'function', detail: '大写', signature: 'upper(s: string) -> string' },
    { label: 'trim', kind: 'function', detail: '去两端空白', signature: 'trim(s: string) -> string' },
    { label: 'replace', kind: 'function', detail: '替换', signature: 'replace(s, old, new) -> string' },
    { label: 'contains', kind: 'function', detail: '判断包含', signature: 'contains(s, sub) -> bool' },
    { label: 'starts_with', kind: 'function', detail: '判断前缀', signature: 'starts_with(s, prefix) -> bool' },
    { label: 'ends_with', kind: 'function', detail: '判断后缀', signature: 'ends_with(s, suffix) -> bool' },
    { label: 'format', kind: 'function', detail: '格式化字符串', signature: 'format(s, ...args) -> string' },
    // 编码
    { label: 'json', kind: 'function', detail: 'JSON 编码/解码', signature: 'json.encode(v) -> string | json.decode(s) -> T' },
    { label: 'regex', kind: 'function', detail: '正则编译', signature: 'regex(pat) -> regex' },
    { label: 'base64', kind: 'function', detail: 'Base64 编解码', signature: 'base64.encode(s|bytes) -> string | base64.decode(s) -> bytes' },
    { label: 'hex_encode', kind: 'function', detail: '十六进制编码', signature: 'hex_encode(b: bytes) -> string' },
    { label: 'hex_decode', kind: 'function', detail: '十六进制解码', signature: 'hex_decode(s: string) -> bytes' },
    { label: 'url_encode', kind: 'function', detail: 'URL 编码', signature: 'url_encode(s) -> string' },
    { label: 'url_decode', kind: 'function', detail: 'URL 解码', signature: 'url_decode(s) -> string' },
    // 时间
    { label: 'time', kind: 'function', detail: '当前时间戳', signature: 'time() -> int' },
    { label: 'now', kind: 'function', detail: '当前时间对象', signature: 'now() -> time' },
    { label: 'sleep', kind: 'function', detail: '睡眠', signature: 'sleep(ms: int) -> void' },
    // 文件
    { label: 'open', kind: 'function', detail: '打开文件', signature: 'open(path, mode?) -> file' },
    { label: 'close', kind: 'function', detail: '关闭文件', signature: 'close(f) -> void' },
    { label: 'read_file', kind: 'function', detail: '读文件', signature: 'read_file(path) -> string|bytes' },
    { label: 'write_file', kind: 'function', detail: '写文件', signature: 'write_file(path, data) -> void' },
    { label: 'file_exists', kind: 'function', detail: '文件存在', signature: 'file_exists(path) -> bool' },
    { label: 'is_dir', kind: 'function', detail: '是目录', signature: 'is_dir(path) -> bool' },
    { label: 'is_file', kind: 'function', detail: '是文件', signature: 'is_file(path) -> bool' },
    { label: 'glob', kind: 'function', detail: '路径匹配', signature: 'glob(pat) -> list<string>' },
    { label: 'walk', kind: 'function', detail: '递归遍历目录', signature: 'walk(path) -> list<string>' },
    // 哈希
    { label: 'md5', kind: 'function', detail: 'MD5', signature: 'md5(s|bytes) -> string' },
    { label: 'sha1', kind: 'function', detail: 'SHA-1', signature: 'sha1(s|bytes) -> string' },
    { label: 'sha256', kind: 'function', detail: 'SHA-256', signature: 'sha256(s|bytes) -> string' },
    { label: 'hmac', kind: 'function', detail: 'HMAC', signature: 'hmac(key, data, algo) -> string' },
    // 加密
    { label: 'encrypt', kind: 'function', detail: '加密', signature: 'encrypt(algo, key, data) -> bytes' },
    { label: 'decrypt', kind: 'function', detail: '解密', signature: 'decrypt(algo, key, data) -> bytes' },
    // 随机
    { label: 'rand', kind: 'function', detail: '随机数', signature: 'rand() -> double | rand(min, max) -> int' },
    { label: 'random', kind: 'function', detail: '同 rand', signature: 'random(min?, max?) -> int' },
    // 网络
    { label: 'http_get', kind: 'function', detail: 'HTTP GET', signature: 'http_get(url, headers?) -> response' },
    { label: 'http_post', kind: 'function', detail: 'HTTP POST', signature: 'http_post(url, body, headers?) -> response' },
    { label: 'tcp_connect', kind: 'function', detail: 'TCP 连接', signature: 'tcp_connect(host, port) -> socket' },
    { label: 'udp_send', kind: 'function', detail: 'UDP 发送', signature: 'udp_send(host, port, data) -> int' },
    { label: 'ssl_connect', kind: 'function', detail: 'SSL/TLS 连接', signature: 'ssl_connect(host, port) -> socket' },
    // 并发
    { label: 'channel', kind: 'function', detail: '创建通道', signature: 'channel<T>(buf?) -> channel' },
    { label: 'mutex', kind: 'function', detail: '创建互斥锁', signature: 'mutex() -> mutex' },
    { label: 'rwlock', kind: 'function', detail: '创建读写锁', signature: 'rwlock() -> rwlock' },
    { label: 'semaphore', kind: 'function', detail: '创建信号量', signature: 'semaphore(n: int) -> sem' },
    { label: 'waitgroup', kind: 'function', detail: '等待组', signature: 'waitgroup() -> wg' },
    // 日志
    { label: 'log_info', kind: 'function', detail: '信息日志', signature: 'log_info(...args) -> void' },
    { label: 'log_warn', kind: 'function', detail: '警告日志', signature: 'log_warn(...args) -> void' },
    { label: 'log_error', kind: 'function', detail: '错误日志', signature: 'log_error(...args) -> void' },
    { label: 'log_debug', kind: 'function', detail: '调试日志', signature: 'log_debug(...args) -> void' },
    { label: 'log_trace', kind: 'function', detail: '追踪日志', signature: 'log_trace(...args) -> void' },
    // 系统
    { label: 'env', kind: 'function', detail: '环境变量', signature: 'env(key) -> string' },
    { label: 'getenv', kind: 'function', detail: '取环境变量', signature: 'getenv(key) -> string' },
    { label: 'setenv', kind: 'function', detail: '设置环境变量', signature: 'setenv(key, val) -> void' },
    { label: 'unsetenv', kind: 'function', detail: '删除环境变量', signature: 'unsetenv(key) -> void' },
    { label: 'shell', kind: 'function', detail: '执行 Shell', signature: 'shell(cmd: string) -> string' },
    { label: 'system', kind: 'function', detail: '执行系统命令', signature: 'system(cmd) -> int' },
    { label: 'exec', kind: 'function', detail: '执行并返回输出', signature: 'exec(cmd) -> string' },
    { label: 'spawn', kind: 'function', detail: '派生子进程', signature: 'spawn(cmd, args?) -> process' },
    { label: 'exit', kind: 'function', detail: '退出进程', signature: 'exit(code?: int) -> void' },
    { label: 'abort', kind: 'function', detail: '异常退出', signature: 'abort() -> void' },
    // 套接字
    { label: 'socket', kind: 'function', detail: '创建套接字', signature: 'socket(proto) -> socket' },
    { label: 'bind', kind: 'function', detail: '绑定地址', signature: 'bind(sock, addr) -> void' },
    { label: 'listen', kind: 'function', detail: '监听', signature: 'listen(sock, backlog?) -> void' },
    { label: 'accept', kind: 'function', detail: '接受连接', signature: 'accept(sock) -> socket' },
    { label: 'connect', kind: 'function', detail: '连接', signature: 'connect(sock, addr) -> void' },
    { label: 'send', kind: 'function', detail: '发送', signature: 'send(sock, data) -> int' },
    { label: 'recv', kind: 'function', detail: '接收', signature: 'recv(sock, n?) -> bytes' },
    // FFI
    { label: 'dll_load', kind: 'function', detail: '加载动态库', signature: 'dll_load(path) -> handle' },
    { label: 'dll_sym', kind: 'function', detail: '取符号地址', signature: 'dll_sym(handle, name) -> pointer' },
    { label: 'ffi_call', kind: 'function', detail: '调用 FFI', signature: 'ffi_call(ptr, ret, args...) -> any' },
    { label: 'reflect', kind: 'function', detail: '反射', signature: 'reflect(v) -> meta' },
    { label: 'call', kind: 'function', detail: '动态调用', signature: 'call(fn, args...) -> any' },
    { label: 'invoke', kind: 'function', detail: '调用方法', signature: 'invoke(obj, name, args...) -> any' },
    // 内存
    { label: 'malloc', kind: 'function', detail: '分配内存', signature: 'malloc(n: int) -> pointer' },
    { label: 'free', kind: 'function', detail: '释放内存', signature: 'free(p) -> void' },
    { label: 'memcpy', kind: 'function', detail: '内存拷贝', signature: 'memcpy(dst, src, n) -> pointer' },
    { label: 'memset', kind: 'function', detail: '内存填充', signature: 'memset(p, val, n) -> pointer' },
];
/**
 * 类型成员补全：当用户输入 `var.` 时，根据 var 的类型推荐成员。
 */
exports.TYPE_MEMBERS = {
    string: [
        { label: 'len', kind: 'method', detail: '字节数', signature: 'string.len() -> int', insertText: 'len()' },
        { label: 'split', kind: 'method', detail: '分割', signature: 'string.split(sep: string) -> list<string>', insertText: 'split(${1:sep})' },
        { label: 'join', kind: 'method', detail: '连接', signature: 'string.join(parts) -> string', insertText: 'join(${0:parts})' },
        { label: 'lower', kind: 'method', detail: '转小写', signature: 'string.lower() -> string', insertText: 'lower()' },
        { label: 'upper', kind: 'method', detail: '转大写', signature: 'string.upper() -> string', insertText: 'upper()' },
        { label: 'trim', kind: 'method', detail: '去空白', signature: 'string.trim() -> string', insertText: 'trim()' },
        { label: 'replace', kind: 'method', detail: '替换', signature: 'string.replace(old, new) -> string', insertText: 'replace(${1:old}, ${2:new})' },
        { label: 'contains', kind: 'method', detail: '包含', signature: 'string.contains(sub) -> bool', insertText: 'contains(${0:sub})' },
        { label: 'starts_with', kind: 'method', detail: '起始判断', signature: 'string.starts_with(s) -> bool', insertText: 'starts_with(${0:s})' },
        { label: 'ends_with', kind: 'method', detail: '结尾判断', signature: 'string.ends_with(s) -> bool', insertText: 'ends_with(${0:s})' },
        { label: 'slice', kind: 'method', detail: '切片', signature: 'string.slice(start, end?) -> string', insertText: 'slice(${1:0}, ${2:1})' },
        { label: 'index', kind: 'method', detail: '查找位置', signature: 'string.index(sub) -> int', insertText: 'index(${0:sub})' },
        { label: 'format', kind: 'method', detail: '格式化', signature: 'string.format(...args) -> string', insertText: 'format(${0:args})' },
        { label: 'is_empty', kind: 'method', detail: '判断空', signature: 'string.is_empty() -> bool', insertText: 'is_empty()' },
    ],
    list: [
        { label: 'len', kind: 'method', detail: '元素数', signature: 'list.len() -> int', insertText: 'len()' },
        { label: 'push', kind: 'method', detail: '追加', signature: 'list.push(x) -> void', insertText: 'push(${0:x})' },
        { label: 'append', kind: 'method', detail: '追加（同 push）', signature: 'list.append(x) -> void', insertText: 'append(${0:x})' },
        { label: 'pop', kind: 'method', detail: '弹末位', signature: 'list.pop() -> T', insertText: 'pop()' },
        { label: 'shift', kind: 'method', detail: '弹首位', signature: 'list.shift() -> T', insertText: 'shift()' },
        { label: 'unshift', kind: 'method', detail: '头部插入', signature: 'list.unshift(x) -> void', insertText: 'unshift(${0:x})' },
        { label: 'insert', kind: 'method', detail: '插入', signature: 'list.insert(idx, x) -> void', insertText: 'insert(${1:0}, ${0:x})' },
        { label: 'delete', kind: 'method', detail: '删除', signature: 'list.delete(idx) -> void', insertText: 'delete(${0:idx})' },
        { label: 'remove', kind: 'method', detail: '按值删除', signature: 'list.remove(x) -> void', insertText: 'remove(${0:x})' },
        { label: 'slice', kind: 'method', detail: '切片', signature: 'list.slice(start, end?) -> list', insertText: 'slice(${1:0}, ${2:1})' },
        { label: 'contains', kind: 'method', detail: '包含', signature: 'list.contains(x) -> bool', insertText: 'contains(${0:x})' },
        { label: 'index', kind: 'method', detail: '查找位置', signature: 'list.index(x) -> int', insertText: 'index(${0:x})' },
        { label: 'reverse', kind: 'method', detail: '反转', signature: 'list.reverse() -> list', insertText: 'reverse()' },
        { label: 'sort', kind: 'method', detail: '排序', signature: 'list.sort() -> list', insertText: 'sort()' },
        { label: 'unique', kind: 'method', detail: '去重', signature: 'list.unique() -> list', insertText: 'unique()' },
        { label: 'map', kind: 'method', detail: '映射', signature: 'list.map(fn) -> list', insertText: 'map(${0:fn})' },
        { label: 'filter', kind: 'method', detail: '过滤', signature: 'list.filter(fn) -> list', insertText: 'filter(${0:fn})' },
        { label: 'reduce', kind: 'method', detail: '归约', signature: 'list.reduce(init, fn) -> T', insertText: 'reduce(${1:0}, ${0:fn})' },
        { label: 'join', kind: 'method', detail: '连接为字符串', signature: 'list.join(sep: string) -> string', insertText: 'join(${0:","})' },
        { label: 'is_empty', kind: 'method', detail: '判断空', signature: 'list.is_empty() -> bool', insertText: 'is_empty()' },
    ],
    dict: [
        { label: 'len', kind: 'method', detail: '条目数', signature: 'dict.len() -> int', insertText: 'len()' },
        { label: 'keys', kind: 'method', detail: '所有键', signature: 'dict.keys() -> list', insertText: 'keys()' },
        { label: 'values', kind: 'method', detail: '所有值', signature: 'dict.values() -> list', insertText: 'values()' },
        { label: 'get', kind: 'method', detail: '取键值', signature: 'dict.get(k, default?) -> V', insertText: 'get(${0:k})' },
        { label: 'set', kind: 'method', detail: '设键值', signature: 'dict.set(k, v) -> void', insertText: 'set(${0:k}, ${0:v})' },
        { label: 'delete', kind: 'method', detail: '删除键', signature: 'dict.delete(k) -> void', insertText: 'delete(${0:k})' },
        { label: 'contains', kind: 'method', detail: '判断键', signature: 'dict.contains(k) -> bool', insertText: 'contains(${0:k})' },
        { label: 'has', kind: 'method', detail: '同 contains', signature: 'dict.has(k) -> bool', insertText: 'has(${0:k})' },
        { label: 'merge', kind: 'method', detail: '合并', signature: 'dict.merge(other) -> dict', insertText: 'merge(${0:other})' },
        { label: 'is_empty', kind: 'method', detail: '判断空', signature: 'dict.is_empty() -> bool', insertText: 'is_empty()' },
    ],
    bytes: [
        { label: 'len', kind: 'method', detail: '字节数', signature: 'bytes.len() -> int', insertText: 'len()' },
        { label: 'slice', kind: 'method', detail: '切片', signature: 'bytes.slice(start, end?) -> bytes', insertText: 'slice(${1:0}, ${2:1})' },
        { label: 'hex', kind: 'method', detail: '转 hex 字符串', signature: 'bytes.hex() -> string', insertText: 'hex()' },
        { label: 'base64', kind: 'method', detail: '转 base64 字符串', signature: 'bytes.base64() -> string', insertText: 'base64()' },
        { label: 'string', kind: 'method', detail: '解码为字符串', signature: 'bytes.string() -> string', insertText: 'string()' },
    ],
    int: [
        { label: 'to_string', kind: 'method', detail: '转字符串', signature: 'int.to_string() -> string', insertText: 'to_string()' },
        { label: 'hex', kind: 'method', detail: '十六进制', signature: 'int.hex() -> string', insertText: 'hex()' },
        { label: 'oct', kind: 'method', detail: '八进制', signature: 'int.oct() -> string', insertText: 'oct()' },
        { label: 'bin', kind: 'method', detail: '二进制', signature: 'int.bin() -> string', insertText: 'bin()' },
        { label: 'to_float', kind: 'method', detail: '转 float', signature: 'int.to_float() -> float', insertText: 'to_float()' },
        { label: 'abs', kind: 'method', detail: '绝对值', signature: 'int.abs() -> int', insertText: 'abs()' },
    ],
    float: [
        { label: 'to_string', kind: 'method', detail: '转字符串', signature: 'float.to_string(p?) -> string', insertText: 'to_string()' },
        { label: 'to_int', kind: 'method', detail: '转 int', signature: 'float.to_int() -> int', insertText: 'to_int()' },
        { label: 'floor', kind: 'method', detail: '向下取整', signature: 'float.floor() -> int', insertText: 'floor()' },
        { label: 'ceil', kind: 'method', detail: '向上取整', signature: 'float.ceil() -> int', insertText: 'ceil()' },
        { label: 'round', kind: 'method', detail: '四舍五入', signature: 'float.round() -> int', insertText: 'round()' },
        { label: 'abs', kind: 'method', detail: '绝对值', signature: 'float.abs() -> float', insertText: 'abs()' },
    ],
    ipv4: [
        { label: 'to_string', kind: 'method', detail: '字符串', signature: 'ipv4.to_string() -> string', insertText: 'to_string()' },
        { label: 'is_private', kind: 'method', detail: '判断私网', signature: 'ipv4.is_private() -> bool', insertText: 'is_private()' },
        { label: 'is_loopback', kind: 'method', detail: '判断回环', signature: 'ipv4.is_loopback() -> bool', insertText: 'is_loopback()' },
    ],
    socket: [
        { label: 'send', kind: 'method', detail: '发送', signature: 'socket.send(data) -> int', insertText: 'send(${0:data})' },
        { label: 'recv', kind: 'method', detail: '接收', signature: 'socket.recv(n?) -> bytes', insertText: 'recv(${0:1024})' },
        { label: 'close', kind: 'method', detail: '关闭', signature: 'socket.close() -> void', insertText: 'close()' },
        { label: 'set_timeout', kind: 'method', detail: '设置超时', signature: 'socket.set_timeout(ms) -> void', insertText: 'set_timeout(${0:ms})' },
    ],
};
/**
 * 已知类型 → 推断的类型映射（用于从 let 语句推测变量的类型）
 */
exports.TYPE_INFERENCE_RULES = [
    { regex: /^\s*(let|const|var)\s+\w+\s*=\s*range\s*\(/i, type: 'list' },
    { regex: /^\s*(let|const|var)\s+\w+\s*=\s*\[\s*\]/, type: 'list' },
    { regex: /^\s*(let|const|var)\s+\w+\s*=\s*\{\s*\}/, type: 'dict' },
    { regex: /^\s*(let|const|var)\s+\w+\s*=\s*"[^"]*"/, type: 'string' },
    { regex: /^\s*(let|const|var)\s+\w+\s*=\s*b"/, type: 'bytes' },
    { regex: /^\s*(let|const|var)\s+\w+\s*=\s*'(.+)'/, type: 'char' },
    { regex: /^\s*(let|const|var)\s+\w+\s*=\s*\d+L\b/, type: 'long' },
    { regex: /^\s*(let|const|var)\s+\w+\s*=\s*\d+\.\d+/, type: 'float' },
    { regex: /^\s*(let|const|var)\s+\w+\s*=\s*-?\d+\s*$/, type: 'int' },
    { regex: /^\s*(let|const|var)\s+\w+\s*=\s*(true|false)\b/, type: 'bool' },
    { regex: /^\s*(let|const|var)\s+\w+\s*=\s*(nil|nan|inf)\b/, type: 'string' },
    { regex: /^\s*(let|const|var)\s+\w+\s*=\s*tcp_connect\s*\(/, type: 'socket' },
    { regex: /^\s*(let|const|var)\s+\w+\s*=\s*socket\s*\(/, type: 'socket' },
    { regex: /^\s*(let|const|var)\s+\w+\s*=\s*http_(get|post)\s*\(/, type: 'dict' },
    { regex: /^\s*(let|const|var)\s+\w+\s*=\s*new\s+(\w+)/, type: '$2' },
];
/** 简单代码片段（高频使用） */
exports.SNIPPETS = [
    { label: 'forr', kind: 'snippet', detail: 'for range 循环', insertText: 'for ${1:i} in range(${2:0}, ${3:10}) {\n\t${0}\n}', sortKey: 5 },
    { label: 'forl', kind: 'snippet', detail: 'for list 循环', insertText: 'for ${1:item} in ${2:list} {\n\t${0}\n}', sortKey: 5 },
    { label: 'iff', kind: 'snippet', detail: 'if-else 块', insertText: 'if ${1:cond} {\n\t${2}\n} else {\n\t${0}\n}', sortKey: 5 },
    { label: 'tryc', kind: 'snippet', detail: 'try-catch 块', insertText: 'try {\n\t${1}\n} catch ${2:e} {\n\t${0}\n}', sortKey: 5 },
    { label: 'fn', kind: 'snippet', detail: 'func 块', insertText: 'func ${1:name}(${2:args}) {\n\t${0}\n}', sortKey: 5 },
    { label: 'main', kind: 'snippet', detail: 'init 入口', insertText: 'init() {\n\t${0}\n}', sortKey: 5 },
    { label: 'ifmain', kind: 'snippet', detail: 'main 守护', insertText: 'if "${1}" == __main__ {\n\tinit() {\n\t\t${0}\n\t}\n}', sortKey: 5 },
    { label: 'println', kind: 'snippet', detail: 'println 调试', insertText: 'println(${0})', sortKey: 5 },
    { label: 'printerr', kind: 'snippet', detail: 'log_error', insertText: 'log_error(${0})', sortKey: 5 },
    { label: 'doc', kind: 'snippet', detail: '文档注释', insertText: '/** ${1:description}\n * @param ${2:x} ${0:desc}\n */', sortKey: 5 },
];
/** 合并所有补全项（去重） */
function buildAllCompletions() {
    const seen = new Map();
    for (const m of [...exports.KEYWORDS, ...exports.TYPES, ...exports.BUILTIN_FUNCTIONS, ...exports.SNIPPETS]) {
        seen.set(m.label, m);
    }
    return Array.from(seen.values());
}
/** Hover 文档：把 CompletionItemMeta 渲染为 Markdown */
function buildHoverDoc(m) {
    const sig = m.signature ?? m.label;
    const lines = [];
    lines.push('```yscript');
    lines.push(sig);
    lines.push('```');
    if (m.detail)
        lines.push(`**${m.detail}**`);
    if (m.documentation)
        lines.push('', m.documentation);
    return lines.join('\n');
}
//# sourceMappingURL=keywords.js.map