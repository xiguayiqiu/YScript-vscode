/**
 * YScript 语言元数据：关键字、类型、内置函数。
 * 供 LSP 补全、悬停、签名帮助使用。
 */

export type CompletionKind = 'keyword' | 'type' | 'constant' | 'builtin' | 'method' | 'property' | 'snippet';

export interface CompletionItemMeta {
  label: string;
  kind: CompletionKind;
  detail: string;
  insertText?: string;
  sortKey?: number;
  /** method/property 属于哪个类型 */
  of?: string;
}

export const KEYWORDS: CompletionItemMeta[] = [
  { label: 'let', kind: 'keyword', detail: '声明块级变量', insertText: 'let ${1:name} = ${0:value}', sortKey: 10 },
  { label: 'const', kind: 'keyword', detail: '声明编译期常量', insertText: 'const ${1:NAME} = ${0:value}', sortKey: 10 },
  { label: 'func', kind: 'keyword', detail: '函数定义', insertText: 'func ${1:name}(${2:args}) {\n\t${0}\n}', sortKey: 10 },
  { label: 'init', kind: 'keyword', detail: '自动初始化（main前执行）', insertText: 'init() {\n\t${0}\n}', sortKey: 10 },
  { label: 'main', kind: 'keyword', detail: '程序入口，必须有 func main()', sortKey: 10 },
  { label: 'struct', kind: 'keyword', detail: '结构体定义', insertText: 'struct ${1:Name} {\n\t${2:field}: ${3:type}\n}', sortKey: 10 },
  { label: 'enum', kind: 'keyword', detail: '枚举定义', insertText: 'enum ${1:Name} {\n\t${0}\n}', sortKey: 10 },
  { label: 'interface', kind: 'keyword', detail: '接口定义（鸭子类型，无需 implements）', insertText: 'interface ${1:Name} {\n\t${0}\n}', sortKey: 10 },
  { label: 'warp', kind: 'keyword', detail: '启动并发线程', insertText: 'let ${1:h} = warp {\n\t${0}\n}', sortKey: 10 },
  { label: 'if', kind: 'keyword', detail: '条件判断', insertText: 'if ${1:cond} {\n\t${0}\n}', sortKey: 10 },
  { label: 'else', kind: 'keyword', detail: '否则分支', sortKey: 11 },
  { label: 'elif', kind: 'keyword', detail: 'else if 简写', sortKey: 11 },
  { label: 'for', kind: 'keyword', detail: 'for 循环', insertText: 'for ${1:item} in ${2:list} {\n\t${0}\n}', sortKey: 10 },
  { label: 'while', kind: 'keyword', detail: '条件循环', insertText: 'while ${1:cond} {\n\t${0}\n}', sortKey: 10 },
  { label: 'loop', kind: 'keyword', detail: '无限循环（=while true）', insertText: 'loop {\n\t${0}\n}', sortKey: 10 },
  { label: 'break', kind: 'keyword', detail: '跳出循环', sortKey: 12 },
  { label: 'continue', kind: 'keyword', detail: '跳过本次循环', sortKey: 12 },
  { label: 'return', kind: 'keyword', detail: '函数返回（支持多值）', insertText: 'return ${0:value}', sortKey: 12 },
  { label: 'yield', kind: 'keyword', detail: '生成器暂停点', sortKey: 12 },
  { label: 'match', kind: 'keyword', detail: '模式匹配（多分支）', insertText: 'match ${1:val} {\n\t${2:pattern} { ${3:body} }\n\t_ { ${0:default} }\n}', sortKey: 10 },
  { label: 'switch', kind: 'keyword', detail: 'C风格switch分支', insertText: 'switch ${1:val} {\n\tcase ${2:pat}:\n\t\t${0}\n}', sortKey: 10 },
  { label: 'case', kind: 'keyword', detail: 'switch 分支', sortKey: 11 },
  { label: 'default', kind: 'keyword', detail: '默认分支', sortKey: 11 },
  { label: 'panic', kind: 'keyword', detail: '抛出致命错误', insertText: 'panic("${0:msg}")', sortKey: 12 },
  { label: 'recover', kind: 'keyword', detail: 'defer内捕获panic', sortKey: 12 },
  { label: 'assert', kind: 'keyword', detail: '断言（false则panic）', insertText: 'assert ${1:cond}', sortKey: 12 },
  { label: 'defer', kind: 'keyword', detail: '延迟执行（函数返回时执行）', insertText: 'defer func() {\n\t${0}\n}()', sortKey: 12 },
  { label: 'goto', kind: 'keyword', detail: '跳转到标签', sortKey: 12 },
  { label: 'import', kind: 'keyword', detail: '导入模块', insertText: 'import "${1:path}"', sortKey: 10 },
  { label: 'package', kind: 'keyword', detail: '声明包名', insertText: 'package ${1:main}', sortKey: 10 },
  { label: 'as', kind: 'keyword', detail: '模块别名 / 类型转换', sortKey: 11 },
  { label: 'and', kind: 'keyword', detail: '逻辑与（短路求值）', sortKey: 13 },
  { label: 'or', kind: 'keyword', detail: '逻辑或（短路求值）', sortKey: 13 },
  { label: 'not', kind: 'keyword', detail: '逻辑非', sortKey: 13 },
  { label: 'xor', kind: 'keyword', detail: '逻辑异或', sortKey: 13 },
  { label: 'in', kind: 'keyword', detail: '成员包含判断: x in list', sortKey: 13 },
  { label: 'is', kind: 'keyword', detail: '类型判断: v is int', sortKey: 13 },
  { label: 'matches', kind: 'keyword', detail: '正则匹配', sortKey: 13 },
  { label: 'this', kind: 'keyword', detail: '方法内引用当前实例', sortKey: 12 },
  { label: 'true', kind: 'constant', detail: '布尔真', sortKey: 14 },
  { label: 'false', kind: 'constant', detail: '布尔假', sortKey: 14 },
  { label: 'nil', kind: 'constant', detail: '空值（引用类型默认值）', sortKey: 14 },
  { label: 'nan', kind: 'constant', detail: '非数字', sortKey: 14 },
  { label: 'inf', kind: 'constant', detail: '无穷大', sortKey: 14 },
];

export const TYPES: CompletionItemMeta[] = [
  { label: 'byte', kind: 'type', detail: '8位无符号 (0~255) — Shellcode' },
  { label: 'char', kind: 'type', detail: '单个Unicode字符' },
  { label: 'short', kind: 'type', detail: '16位有符号' },
  { label: 'ushort', kind: 'type', detail: '16位无符号 (0~65535) — 端口号' },
  { label: 'int', kind: 'type', detail: '32位有符号 — 循环计数、状态码' },
  { label: 'uint', kind: 'type', detail: '32位无符号 — IPv4整数表示' },
  { label: 'long', kind: 'type', detail: '64位有符号 — 时间戳、偏移量' },
  { label: 'ulong', kind: 'type', detail: '64位无符号 — 密码学大整数' },
  { label: 'float', kind: 'type', detail: '32位浮点 — 概率计算' },
  { label: 'double', kind: 'type', detail: '64位浮点 — 高精度统计' },
  { label: 'bool', kind: 'type', detail: '布尔: true / false' },
  { label: 'string', kind: 'type', detail: '不可变UTF-8字符串' },
  { label: 'bytes', kind: 'type', detail: '原始字节序列 — Shellcode、数据包' },
  { label: 'list', kind: 'type', detail: '动态数组 list<T>', insertText: 'list<${1:T}>' },
  { label: 'dict', kind: 'type', detail: '哈希表 dict<K,V>', insertText: 'dict<${1:K}, ${2:V}>' },
  { label: 'ipv4', kind: 'type', detail: 'IPv4地址（语法糖）' },
  { label: 'ipv6', kind: 'type', detail: 'IPv6地址（语法糖）' },
  { label: 'error', kind: 'type', detail: '错误类型' },
  { label: 'any', kind: 'type', detail: '任意类型' },
];

export const BUILTIN_FUNCTIONS: CompletionItemMeta[] = [
  // 基础 I/O
  { label: 'print', kind: 'builtin', detail: '输出到stdout（不换行）', insertText: 'print(${0})' },
  { label: 'println', kind: 'builtin', detail: '输出到stdout（换行）', insertText: 'println(${0})' },
  { label: 'printf', kind: 'builtin', detail: '格式化输出', insertText: 'printf("${1:fmt}", ${0})' },
  { label: 'sprintf', kind: 'builtin', detail: '格式化返回字符串', insertText: 'sprintf("${1:fmt}", ${0})' },

  // 类型/元
  { label: 'len', kind: 'builtin', detail: '返回长度: string/bytes/list/dict' },
  { label: 'type', kind: 'builtin', detail: '返回类型名: type(v) → "int"' },
  { label: 'eval', kind: 'builtin', detail: '动态执行代码字符串' },
  { label: 'next', kind: 'builtin', detail: '从生成器取下一个值' },
  { label: 'hex', kind: 'builtin', detail: '转为十六进制: hex(255) → "0xff"' },

  // 类型转换
  { label: 'string', kind: 'builtin', detail: '转为字符串' },
  { label: 'int', kind: 'builtin', detail: '转为整数' },
  { label: 'float', kind: 'builtin', detail: '转为浮点' },
  { label: 'bool', kind: 'builtin', detail: '转为布尔' },
  { label: 'byte', kind: 'builtin', detail: '转为单字节' },
  { label: 'bytes', kind: 'builtin', detail: '转为字节序列' },
  { label: 'char', kind: 'builtin', detail: '转为单字符' },

  // IP 地址
  { label: 'ipv4', kind: 'builtin', detail: '构造IPv4: ipv4("192.168.1.1")', insertText: 'ipv4("${1}")' },
  { label: 'ipv6', kind: 'builtin', detail: '构造IPv6: ipv6("::1")', insertText: 'ipv6("${1}")' },

  // 错误
  { label: 'panic', kind: 'builtin', detail: '抛出致命错误', insertText: 'panic("${0}")' },
  { label: 'recover', kind: 'builtin', detail: 'defer内捕获panic' },
  { label: 'assert', kind: 'builtin', detail: '断言（false则panic）', insertText: 'assert ${0}' },

  // === 命名空间速查（高频） ===
  { label: 'io.read_file', kind: 'builtin', detail: '读取文本文件→string' },
  { label: 'io.read_bytes', kind: 'builtin', detail: '读取二进制文件→bytes' },
  { label: 'io.write_file', kind: 'builtin', detail: '覆盖写入文件' },
  { label: 'io.append_file', kind: 'builtin', detail: '追加写入文件' },
  { label: 'io.file_exists', kind: 'builtin', detail: '路径是否存在' },
  { label: 'io.is_file', kind: 'builtin', detail: '是否为普通文件' },
  { label: 'io.is_dir', kind: 'builtin', detail: '是否为目录' },
  { label: 'io.walk', kind: 'builtin', detail: '递归遍历目录' },
  { label: 'io.mkdir', kind: 'builtin', detail: '创建单层目录' },
  { label: 'io.mkdir_all', kind: 'builtin', detail: '递归创建多层目录' },
  { label: 'io.read_dir', kind: 'builtin', detail: '读取目录内容' },
  { label: 'io.copy', kind: 'builtin', detail: '复制文件' },
  { label: 'io.rename', kind: 'builtin', detail: '移动/重命名文件' },
  { label: 'io.remove', kind: 'builtin', detail: '删除文件/空目录' },
  { label: 'io.remove_all', kind: 'builtin', detail: '递归删除' },
  { label: 'io.chmod', kind: 'builtin', detail: '修改文件权限' },
  { label: 'io.temp_file', kind: 'builtin', detail: '创建临时文件' },
  { label: 'io.temp_dir', kind: 'builtin', detail: '创建临时目录' },
  { label: 'io.symlink', kind: 'builtin', detail: '创建软链接' },
  { label: 'io.readlink', kind: 'builtin', detail: '读取软链接目标' },

  { label: 'path.join', kind: 'builtin', detail: '拼接路径' },
  { label: 'path.basename', kind: 'builtin', detail: '取文件名' },
  { label: 'path.dirname', kind: 'builtin', detail: '取目录部分' },
  { label: 'path.ext', kind: 'builtin', detail: '取扩展名: .bin' },
  { label: 'path.stem', kind: 'builtin', detail: '无扩展名文件名' },
  { label: 'path.is_abs', kind: 'builtin', detail: '是否绝对路径' },
  { label: 'path.abs', kind: 'builtin', detail: '转为绝对路径' },

  { label: 'json.parse', kind: 'builtin', detail: '解析JSON→dict/list' },
  { label: 'json.stringify', kind: 'builtin', detail: '序列化为JSON' },
  { label: 'json.pretty_print', kind: 'builtin', detail: '漂亮格式输出' },
  { label: 'json.from_file', kind: 'builtin', detail: '从文件读取JSON' },
  { label: 'json.to_file', kind: 'builtin', detail: '写入JSON到文件' },
  { label: 'json.query', kind: 'builtin', detail: 'JSONPath查询: $.path' },

  { label: 'regex.match', kind: 'builtin', detail: '正则是否匹配' },
  { label: 'regex.find', kind: 'builtin', detail: '查找第一个匹配' },
  { label: 'regex.find_all', kind: 'builtin', detail: '查找全部匹配' },
  { label: 'regex.replace', kind: 'builtin', detail: '正则替换' },

  { label: 'encoding.base64_encode', kind: 'builtin', detail: 'Base64编码' },
  { label: 'encoding.base64_decode', kind: 'builtin', detail: 'Base64解码' },
  { label: 'encoding.hex_encode', kind: 'builtin', detail: '十六进制编码' },
  { label: 'encoding.hex_decode', kind: 'builtin', detail: '十六进制解码' },
  { label: 'encoding.url_encode', kind: 'builtin', detail: 'URL编码' },
  { label: 'encoding.url_decode', kind: 'builtin', detail: 'URL解码' },

  { label: 'crypto.MD5', kind: 'builtin', detail: 'MD5哈希' },
  { label: 'crypto.SHA1', kind: 'builtin', detail: 'SHA1哈希' },
  { label: 'crypto.SHA256', kind: 'builtin', detail: 'SHA256哈希' },
  { label: 'crypto.SHA512', kind: 'builtin', detail: 'SHA512哈希' },
  { label: 'crypto.HMAC_SHA256', kind: 'builtin', detail: 'HMAC-SHA256' },

  { label: 'aes.Encrypt', kind: 'builtin', detail: 'AES加密(CBC/CTR)' },
  { label: 'aes.Decrypt', kind: 'builtin', detail: 'AES解密' },
  { label: 'aes.RandomKey', kind: 'builtin', detail: '生成随机AES密钥' },

  { label: 'rsa.GenerateKeyPair', kind: 'builtin', detail: '生成RSA密钥对' },
  { label: 'rsa.Encrypt', kind: 'builtin', detail: 'RSA加密' },
  { label: 'rsa.Decrypt', kind: 'builtin', detail: 'RSA解密' },
  { label: 'rsa.Sign', kind: 'builtin', detail: 'RSA签名' },
  { label: 'rsa.Verify', kind: 'builtin', detail: 'RSA验证' },

  { label: 'net.Dial', kind: 'builtin', detail: 'TCP/UDP连接' },
  { label: 'net.DialTCP', kind: 'builtin', detail: 'TCP连接' },
  { label: 'net.DialTimeout', kind: 'builtin', detail: '带超时连接' },
  { label: 'net.DialUDP', kind: 'builtin', detail: 'UDP连接' },
  { label: 'net.Listen', kind: 'builtin', detail: '监听端口' },
  { label: 'net.HTTPGet', kind: 'builtin', detail: 'HTTP GET请求' },
  { label: 'net.HTTPPost', kind: 'builtin', detail: 'HTTP POST请求' },
  { label: 'net.HTTPDo', kind: 'builtin', detail: 'HTTP通用请求' },
  { label: 'net.HTTPSetTimeout', kind: 'builtin', detail: '设置HTTP超时(秒)' },
  { label: 'net.HTTPSetProxy', kind: 'builtin', detail: '设置HTTP代理' },
  { label: 'net.LookupHost', kind: 'builtin', detail: 'DNS正向解析' },
  { label: 'net.LookupIP', kind: 'builtin', detail: 'DNS解析返回IP对象' },
  { label: 'net.LookupMX', kind: 'builtin', detail: 'DNS MX记录' },
  { label: 'net.LookupNS', kind: 'builtin', detail: 'DNS NS记录' },
  { label: 'net.CIDR', kind: 'builtin', detail: 'CIDR子网计算' },

  { label: 'ssl.GetServerCertificate', kind: 'builtin', detail: '获取服务器TLS证书' },
  { label: 'ssl.ParseCertificate', kind: 'builtin', detail: '解析X.509证书' },
  { label: 'ssl.Connect', kind: 'builtin', detail: '建立TLS连接' },

  { label: 'yaml.parse', kind: 'builtin', detail: '解析YAML' },
  { label: 'yaml.from_file', kind: 'builtin', detail: '从文件读取YAML' },
  { label: 'toml.parse', kind: 'builtin', detail: '解析TOML' },
  { label: 'toml.from_file', kind: 'builtin', detail: '从文件读取TOML' },
  { label: 'ini.parse', kind: 'builtin', detail: '解析INI' },
  { label: 'ini.from_file', kind: 'builtin', detail: '从文件读取INI' },

  { label: 'sync.Mutex', kind: 'builtin', detail: '创建互斥锁' },
  { label: 'sync.RWMutex', kind: 'builtin', detail: '创建读写锁' },
  { label: 'sync.Chan', kind: 'builtin', detail: '创建通道' },
  { label: 'sync.Semaphore', kind: 'builtin', detail: '创建信号量(n)' },
  { label: 'sync.Atomic', kind: 'builtin', detail: '创建原子变量(init)' },
  { label: 'sync.WaitGroup', kind: 'builtin', detail: '创建等待组' },
  { label: 'sync.WorkerPool', kind: 'builtin', detail: '创建工作池(n)' },

  { label: 'time.now', kind: 'builtin', detail: '当前时间' },
  { label: 'time.format', kind: 'builtin', detail: '格式化: "2006-01-02 15:04:05"' },
  { label: 'time.parse', kind: 'builtin', detail: '解析时间字符串' },
  { label: 'time.duration', kind: 'builtin', detail: '持续时间: time.duration("5s")' },
  { label: 'time.sleep', kind: 'builtin', detail: '暂停: "2s" / "500ms"' },
  { label: 'time.Timer', kind: 'builtin', detail: '一次性计时器' },
  { label: 'time.Ticker', kind: 'builtin', detail: '周期性定时器' },

  { label: 'rand.int', kind: 'builtin', detail: '随机整数 [min,max]' },
  { label: 'rand.string', kind: 'builtin', detail: '随机字符串: rand.string(16,"alnum")' },
  { label: 'rand.bytes', kind: 'builtin', detail: '随机字节: rand.bytes(32)' },
  { label: 'rand.choice', kind: 'builtin', detail: '从列表中随机选' },
  { label: 'rand.uuid', kind: 'builtin', detail: 'UUID v4' },

  { label: 'sys.CPU', kind: 'builtin', detail: 'CPU信息(.cores/.model/.usage)' },
  { label: 'sys.Memory', kind: 'builtin', detail: '内存信息(.total/.free)' },
  { label: 'sys.NetInterfaces', kind: 'builtin', detail: '网络接口列表' },
  { label: 'sys.process_list', kind: 'builtin', detail: '进程列表' },
  { label: 'sys.process_info', kind: 'builtin', detail: '进程详情' },
  { label: 'sys.process_find', kind: 'builtin', detail: '按名查找进程' },
  { label: 'sys.process_kill', kind: 'builtin', detail: '终止进程' },

  { label: 'os.exec', kind: 'builtin', detail: '执行外部程序' },
  { label: 'os.shell', kind: 'builtin', detail: '通过Shell执行' },
  { label: 'os.exit', kind: 'builtin', detail: '退出进程' },
  { label: 'os.sleep', kind: 'builtin', detail: '暂停: "2s"/"500ms"' },
  { label: 'os.getpid', kind: 'builtin', detail: '当前进程ID' },
  { label: 'os.getenv', kind: 'builtin', detail: '读取环境变量' },
  { label: 'os.setenv', kind: 'builtin', detail: '设置环境变量' },
  { label: 'os.environ', kind: 'builtin', detail: '所有环境变量(dict)' },
  { label: 'os.hostname', kind: 'builtin', detail: '主机名' },

  { label: 'log.debug', kind: 'builtin', detail: 'DEBUG级别日志' },
  { label: 'log.info', kind: 'builtin', detail: 'INFO级别日志' },
  { label: 'log.warn', kind: 'builtin', detail: 'WARN级别日志' },
  { label: 'log.error', kind: 'builtin', detail: 'ERROR级别日志' },
  { label: 'log.set_level', kind: 'builtin', detail: '设置日志级别' },

  { label: 'stdio.input', kind: 'builtin', detail: '提示+读取一行' },
  { label: 'stdio.prompt', kind: 'builtin', detail: '带默认值的输入' },
  { label: 'stdio.confirm', kind: 'builtin', detail: 'y/n确认' },
  { label: 'stdio.select', kind: 'builtin', detail: '多选一菜单' },
  { label: 'stdio.clear', kind: 'builtin', detail: '清屏' },

  { label: 'color.Red', kind: 'builtin', detail: '红色' },
  { label: 'color.Green', kind: 'builtin', detail: '绿色' },
  { label: 'color.Yellow', kind: 'builtin', detail: '黄色' },
  { label: 'color.RGB', kind: 'builtin', detail: '自定义RGB(r,g,b)' },
  { label: 'color.Println', kind: 'builtin', detail: '带颜色打印+换行' },

  { label: 'reflect.type_of', kind: 'builtin', detail: '获取类型名' },
  { label: 'reflect.fields', kind: 'builtin', detail: '获取struct字段列表' },
  { label: 'reflect.to_json', kind: 'builtin', detail: 'struct→JSON' },
  { label: 'reflect.from_json', kind: 'builtin', detail: 'JSON→struct' },

  { label: 'errors.new', kind: 'builtin', detail: '创建错误' },
  { label: 'errors.new_with_code', kind: 'builtin', detail: '创建带错误码的错误' },
  { label: 'errors.wrap', kind: 'builtin', detail: '包装错误（添加上下文）' },

  { label: 'ffi.open', kind: 'builtin', detail: '加载.so/.dll动态库' },
  { label: 'ffi.bind', kind: 'builtin', detail: '绑定C函数到变量' },
  { label: 'ffi.call', kind: 'builtin', detail: '调用C函数' },

  { label: 'cuda.DeviceCount', kind: 'builtin', detail: 'GPU设备数' },
  { label: 'cuda.BatchMD5', kind: 'builtin', detail: 'GPU批量MD5' },
  { label: 'cuda.BatchSHA256', kind: 'builtin', detail: 'GPU批量SHA256' },
  { label: 'cuda.BatchNTLM', kind: 'builtin', detail: 'GPU批量NTLM' },
];

export const TYPE_MEMBERS: CompletionItemMeta[] = [
  // === string methods ===
  { of: 'string', label: 'contains', kind: 'method', detail: '是否包含子串' },
  { of: 'string', label: 'index', kind: 'method', detail: '首次出现位置' },
  { of: 'string', label: 'last_index', kind: 'method', detail: '末次出现位置' },
  { of: 'string', label: 'count', kind: 'method', detail: '出现次数' },
  { of: 'string', label: 'has_prefix', kind: 'method', detail: '是否以..开头' },
  { of: 'string', label: 'has_suffix', kind: 'method', detail: '是否以..结尾' },
  { of: 'string', label: 'replace', kind: 'method', detail: '替换（首个）' },
  { of: 'string', label: 'replace_all', kind: 'method', detail: '全部替换' },
  { of: 'string', label: 'split', kind: 'method', detail: '按分隔符分割' },
  { of: 'string', label: 'split_lines', kind: 'method', detail: '按行分割' },
  { of: 'string', label: 'join', kind: 'method', detail: '用分隔符拼接列表' },
  { of: 'string', label: 'trim', kind: 'method', detail: '去首尾字符' },
  { of: 'string', label: 'trim_prefix', kind: 'method', detail: '去前缀' },
  { of: 'string', label: 'trim_suffix', kind: 'method', detail: '去后缀' },
  { of: 'string', label: 'lower', kind: 'method', detail: '转小写' },
  { of: 'string', label: 'upper', kind: 'method', detail: '转大写' },
  { of: 'string', label: 'capitalize', kind: 'method', detail: '首字母大写' },
  { of: 'string', label: 'pad_left', kind: 'method', detail: '左填充' },
  { of: 'string', label: 'pad_right', kind: 'method', detail: '右填充' },
  { of: 'string', label: 'repeat', kind: 'method', detail: '重复n次' },
  { of: 'string', label: 'matches', kind: 'method', detail: '正则匹配' },
  { of: 'string', label: 'find', kind: 'method', detail: '正则查找' },
  { of: 'string', label: 'find_all', kind: 'method', detail: '正则查找全部' },
  { of: 'string', label: 'len', kind: 'property', detail: '字符串长度(只读)' },
  { of: 'string', label: 'is_empty', kind: 'property', detail: '是否为空' },

  // === bytes methods ===
  { of: 'bytes', label: 'contains', kind: 'method', detail: '是否包含子字节' },
  { of: 'bytes', label: 'index', kind: 'method', detail: '首次出现位置' },
  { of: 'bytes', label: 'replace', kind: 'method', detail: '替换' },
  { of: 'bytes', label: 'replace_all', kind: 'method', detail: '全部替换' },
  { of: 'bytes', label: 'split', kind: 'method', detail: '按分隔符分割' },
  { of: 'bytes', label: 'chunk', kind: 'method', detail: '固定大小分块' },
  { of: 'bytes', label: 'to_hex', kind: 'method', detail: '转十六进制字符串' },
  { of: 'bytes', label: 'to_base64', kind: 'method', detail: '转Base64字符串' },
  { of: 'bytes', label: 'to_utf8', kind: 'method', detail: '转UTF-8字符串' },
  { of: 'bytes', label: 'pad_right', kind: 'method', detail: '右侧填充' },
  { of: 'bytes', label: 'pad_left', kind: 'method', detail: '左侧填充' },
  { of: 'bytes', label: 'truncate', kind: 'method', detail: '截断' },

  // === dict methods ===
  { of: 'dict', label: 'get', kind: 'method', detail: '取值(带默认): d.get("k", def)' },
  { of: 'dict', label: 'set', kind: 'method', detail: '设置键值' },
  { of: 'dict', label: 'delete', kind: 'method', detail: '删除键' },
  { of: 'dict', label: 'has', kind: 'method', detail: '是否包含键' },
  { of: 'dict', label: 'keys', kind: 'method', detail: '所有键列表' },
  { of: 'dict', label: 'values', kind: 'method', detail: '所有值列表' },
  { of: 'dict', label: 'items', kind: 'method', detail: '键值对列表' },
  { of: 'dict', label: 'merge', kind: 'method', detail: '合并另一dict' },
  { of: 'dict', label: 'copy', kind: 'method', detail: '深拷贝' },
  { of: 'dict', label: 'clear', kind: 'method', detail: '清空' },
  { of: 'dict', label: 'size', kind: 'property', detail: '键值对数量(只读)' },
  { of: 'dict', label: 'empty', kind: 'property', detail: '是否为空(只读)' },

  // === list methods ===
  { of: 'list', label: 'append', kind: 'method', detail: '末尾添加' },
  { of: 'list', label: 'prepend', kind: 'method', detail: '开头添加' },
  { of: 'list', label: 'insert', kind: 'method', detail: '指定位置插入' },
  { of: 'list', label: 'pop', kind: 'method', detail: '弹出' },
  { of: 'list', label: 'remove', kind: 'method', detail: '按值删除' },
  { of: 'list', label: 'sort', kind: 'method', detail: '排序(升序)' },
  { of: 'list', label: 'sort_by', kind: 'method', detail: '自定义排序' },
  { of: 'list', label: 'reverse', kind: 'method', detail: '反转' },
  { of: 'list', label: 'map', kind: 'method', detail: '对每个元素做变换' },
  { of: 'list', label: 'filter', kind: 'method', detail: '过滤元素' },
  { of: 'list', label: 'reduce', kind: 'method', detail: '累积' },
  { of: 'list', label: 'flat', kind: 'method', detail: '展平嵌套列表' },
  { of: 'list', label: 'unique', kind: 'method', detail: '去重' },
  { of: 'list', label: 'copy', kind: 'method', detail: '浅拷贝' },
  { of: 'list', label: 'clear', kind: 'method', detail: '清空' },
  { of: 'list', label: 'len', kind: 'property', detail: '元素数量(只读)' },
  { of: 'list', label: 'empty', kind: 'property', detail: '是否为空(只读)' },
  { of: 'list', label: 'first', kind: 'property', detail: '第一个元素(只读)' },
  { of: 'list', label: 'last', kind: 'property', detail: '最后一个元素(只读)' },

  // === ipv4 members ===
  { of: 'ipv4', label: 'string', kind: 'property', detail: 'IP字符串(只读)' },
  { of: 'ipv4', label: 'is_private', kind: 'property', detail: '是否私有IP(只读)' },
  { of: 'ipv4', label: 'is_loopback', kind: 'property', detail: '是否回环(只读)' },
  { of: 'ipv4', label: 'is_multicast', kind: 'property', detail: '是否组播(只读)' },
  { of: 'ipv4', label: 'is_global', kind: 'property', detail: '是否全球IP(只读)' },
  { of: 'ipv4', label: 'version', kind: 'property', detail: 'IP版本: 4(只读)' },

  // === ipv6 members ===
  { of: 'ipv6', label: 'string', kind: 'property', detail: 'IP字符串(只读)' },
  { of: 'ipv6', label: 'expanded', kind: 'property', detail: '展开格式(只读)' },
  { of: 'ipv6', label: 'is_loopback', kind: 'property', detail: '是否回环(只读)' },
  { of: 'ipv6', label: 'is_private', kind: 'property', detail: '是否私有(只读)' },
  { of: 'ipv6', label: 'version', kind: 'property', detail: 'IP版本: 6(只读)' },
];

export interface TypeInferenceRule {
  regex: RegExp;
  type: string;
}

export const TYPE_INFERENCE_RULES: TypeInferenceRule[] = [
  { regex: /=\s*\d+\.\d+/, type: 'float' },
  { regex: /=\s*\d+\.\d*(?:[eE][+-]?\d+)?/, type: 'float' },
  { regex: /=\s*\d+$/, type: 'int' },
  { regex: /=\s*0x[0-9a-fA-F]+/, type: 'int' },
  { regex: /=\s*0b[01]+/, type: 'int' },
  { regex: /=\s*true|false/, type: 'bool' },
  { regex: /=\s*".*"/, type: 'string' },
  { regex: /=\s*b".*"/, type: 'bytes' },
  { regex: /=\s*\[.*\]/, type: 'list' },
  { regex: /=\s*\{.*\}/, type: 'dict' },
  { regex: /=\s*nil/, type: 'nil' },
  { regex: /=\s*ipv4\(/, type: 'ipv4' },
  { regex: /=\s*ipv6\(/, type: 'ipv6' },
  { regex: /=.*json\.parse/, type: 'dict' },
  { regex: /=.*yaml\.parse/, type: 'dict' },
];

export const SNIPPETS: CompletionItemMeta[] = [
  { label: 'pkgmain', kind: 'snippet', detail: 'package main 入口', insertText: 'package main\n\nfunc main() {\n\t${0}\n}\n', sortKey: 1 },
  { label: 'func', kind: 'snippet', detail: '函数定义', insertText: 'func ${1:name}(${2:args}) {\n\t${0}\n}\n', sortKey: 5 },
  { label: 'for', kind: 'snippet', detail: 'for-in 循环', insertText: 'for ${1:item} in ${2:list} {\n\t${0}\n}\n', sortKey: 5 },
  { label: 'if', kind: 'snippet', detail: 'if 条件', insertText: 'if ${1:cond} {\n\t${0}\n}\n', sortKey: 5 },
  { label: 'match', kind: 'snippet', detail: 'match 模式匹配', insertText: 'match ${1:val} {\n\t${2:pattern} { ${3:body} }\n\t_ { ${0:default} }\n}\n', sortKey: 5 },
  { label: 'warp', kind: 'snippet', detail: '并发线程', insertText: 'let ${1:h} = warp {\n\t${0}\n}\n', sortKey: 5 },
  { label: 'defer', kind: 'snippet', detail: '延迟执行', insertText: 'defer func() {\n\t${0}\n}()\n', sortKey: 5 },
  { label: 'shell', kind: 'snippet', detail: 'Shell 命令', insertText: '`${1:command}`', sortKey: 5 },
  { label: 'struct', kind: 'snippet', detail: '结构体定义', insertText: 'struct ${1:Name} {\n\t${2:field}: ${3:type}\n}\n', sortKey: 5 },
  { label: 'import', kind: 'snippet', detail: '导入模块', insertText: 'import "${1:path}"\n', sortKey: 5 },
];

/** 构建所有补全项 */
export function buildAllCompletions(): CompletionItemMeta[] {
  return [...KEYWORDS, ...TYPES, ...BUILTIN_FUNCTIONS, ...SNIPPETS];
}

/** 构建悬停文档索引 */
export function buildHoverDoc(word: string): string | null {
  const all = buildAllCompletions();
  for (const m of all) {
    if (m.label === word) {
      const kindLabel: Record<string, string> = {
        keyword: '关键字', type: '类型', constant: '常量',
        builtin: '内置函数', method: '方法', property: '属性'
      };
      const prefix = kindLabel[m.kind] || m.kind;
      return `**${m.label}** — ${prefix}\n\n${m.detail}`;
    }
  }
  return null;
}
