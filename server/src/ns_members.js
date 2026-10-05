"use strict";
/**
 * 标准库成员表 —— 由 `yscript/tools/gen_ns_members.py` 从实现自动生成。
 *
 * ⚠ 请勿手工编辑：改了 internal/std/*.go 后重新生成即可。
 *
 * 覆盖来源：
 *   1. MakeNS("ns", map[string]value.BuiltinFunc{...})  各命名空间注册表
 *   2. buildCFuncNames()                                c 模块（动态组装）
 *
 * 重新生成：
 *   cd yscript && python3 tools/gen_ns_members.py > ../vscode/server/src/ns_members.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODULE_NAMESPACE = exports.ALL_NAMESPACES = exports.NS_MEMBERS = void 0;
exports.resolveNamespace = resolveNamespace;
/** 命名空间 -> 成员名列表（用于 `ns.` 之后的补全） */
exports.NS_MEMBERS = {
    aes: ['Decrypt', 'Encrypt', 'RandomKey'],
    array: ['BinarySearch', 'Chunk', 'Cols', 'Contains', 'Copy', 'Difference', 'Dim', 'Fill', 'Filter', 'Get', 'Intersect', 'Len', 'Map', 'New', 'New2D', 'Range', 'Reduce', 'Reshape', 'Rows', 'Set', 'Sort', 'Union', 'Unique', 'Zip'],
    binary: ['And', 'AppendFile', 'Base64Decode', 'Base64Encode', 'BigEndian', 'BufferBytes', 'BufferCap', 'BufferLen', 'BufferRead', 'BufferReset', 'BufferSeek', 'BufferString', 'BufferWrite', 'Bytes', 'BytesWritten', 'Chunk', 'CloseBuffer', 'CloseReader', 'CloseWriter', 'Compare', 'Concat', 'Contains', 'Create', 'EOF', 'FileClose', 'FileRead', 'FileSeek', 'FileStat', 'FileSync', 'FileWrite', 'Float32', 'Float64', 'FromUTF8', 'Grow', 'HexDecode', 'HexEncode', 'Index', 'Int16', 'Int32', 'Int64', 'Int8', 'Len', 'LittleEndian', 'NewBuffer', 'NewReader', 'NewWriter', 'Not', 'Open', 'OpenMode', 'Or', 'PadLeft', 'PadRight', 'PatchEqual', 'PutFloat32', 'PutFloat64', 'PutInt16', 'PutInt32', 'PutInt64', 'PutInt8', 'PutUint16', 'PutUint32', 'PutUint64', 'PutUint8', 'RFind', 'Read', 'ReadAll', 'ReadByte', 'ReadFile', 'Repeat', 'Replace', 'ReplaceAll', 'Seek', 'Skip', 'Slice', 'Split', 'String', 'Trim', 'Truncate', 'UTF8', 'Uint16', 'Uint32', 'Uint64', 'Uint8', 'Write', 'WriteByte', 'WriteFile', 'WriteFloat32', 'WriteFloat64', 'WriteInt16', 'WriteInt32', 'WriteInt64', 'WriteInt8', 'WriteString', 'WriteUint16', 'WriteUint32', 'WriteUint64', 'WriteUint8', 'WriterBytes', 'Xor'],
    c: ['abs', 'access', 'acos', 'asin', 'atan', 'atan2', 'atof', 'atoi', 'atol', 'atoll', 'bind', 'call', 'callback', 'callback_free', 'calloc', 'cbrt', 'ceil', 'chdir', 'clock', 'close', 'compile', 'compile_load', 'compile_obj', 'compiler', 'compilers', 'cos', 'cosh', 'difftime', 'dup', 'dup2', 'exp', 'exp2', 'fabs', 'fclose', 'feof', 'ferror', 'fflush', 'find', 'floor', 'fmax', 'fmin', 'fmod', 'fopen', 'fputc', 'fputs', 'fread', 'free', 'fseek', 'ftell', 'fwrite', 'getchar', 'getcwd', 'getenv', 'getpid', 'getppid', 'getuid', 'header_bind', 'hypot', 'isalnum', 'isalpha', 'isatty', 'iscntrl', 'isdigit', 'isgraph', 'islower', 'isnan', 'isprint', 'ispunct', 'isspace', 'isupper', 'isxdigit', 'link', 'load', 'log', 'log10', 'log2', 'lseek', 'malloc', 'memcmp', 'memcpy', 'memmove', 'memset', 'mkdir', 'parse_header', 'perror', 'pow', 'putchar', 'rand', 'read', 'realloc', 'remove', 'rename', 'rmdir', 'round', 'sin', 'sinh', 'sleep', 'sqrt', 'srand', 'strcat', 'strchr', 'strcmp', 'strcpy', 'strdup', 'stricmp', 'strlen', 'strncmp', 'strncpy', 'strrchr', 'strstr', 'strtod', 'strtol', 'tan', 'tanh', 'time', 'tolower', 'toupper', 'trunc', 'unlink', 'unload', 'usleep', 'write'],
    color: ['Bg', 'Blink', 'Blue', 'Bold', 'Color256', 'Cyan', 'Green', 'Italic', 'Magenta', 'Print', 'Println', 'RGB', 'RGBA', 'Red', 'Reset', 'Reverse', 'Sprint', 'Sprintf', 'Underline', 'White', 'Yellow'],
    compress: ['gunzip', 'gzip'],
    crypto: ['AES_GCM_Decrypt', 'AES_GCM_Encrypt', 'Base58Decode', 'Base58Encode', 'Base64URLDecode', 'Base64URLEncode', 'BcryptHash', 'BcryptVerify', 'ChaCha20_Decrypt', 'ChaCha20_Encrypt', 'ECDSA_Keygen', 'ECDSA_Sign', 'ECDSA_Verify', 'Ed25519_Keygen', 'Ed25519_Sign', 'Ed25519_Verify', 'HMAC_SHA256', 'HMAC_SHA3', 'HMAC_SHA512', 'HashFile', 'MD5', 'PBKDF2', 'SHA1', 'SHA256', 'SHA3_256', 'SHA3_384', 'SHA3_512', 'SHA512', 'SHAKE128', 'SHAKE256', 'WPA2_Decrypt', 'WPA2_Encrypt', 'WPA2_MIC_Verify', 'WPA2_PMK', 'WPA2_PTK'],
    csv: ['Parse', 'Read', 'Write'],
    cuda: ['Device_Info', 'HMAC_SHA1_Batch', 'HMAC_SHA256_Batch', 'HMAC_SHA512_Batch', 'MD4_Batch', 'MD5_Batch', 'NTLM_Batch', 'PBKDF2_Batch', 'SHA256_Batch', 'SHA256d_Batch', 'SHA512_Batch', 'Set_Device', 'Sync', 'WPA2_PMK_Batch', 'available', 'device_count', 'device_memory', 'device_name'],
    encoding: ['base64_decode', 'base64_encode', 'hex_decode', 'hex_encode', 'html_decode', 'html_encode', 'url_decode', 'url_encode'],
    errors: ['cause', 'format', 'is', 'new', 'new_with_code', 'with_type', 'wrap'],
    ffi: ['alloc', 'bind', 'call', 'find', 'free', 'open', 'read', 'str', 'write'],
    from: ['Appendf', 'Errorf', 'Formats', 'Fprintf', 'Fscanf', 'Print', 'Println', 'Scan', 'Scanf', 'Scanln', 'Sprintf', 'Sscanf'],
    ini: ['from_file', 'parse'],
    io: ['Bytes', 'Close', 'Copy', 'EOF', 'ErrClosed', 'ErrSeekUnsupported', 'LimitReader', 'MultiReader', 'NewReadWriter', 'NewReader', 'NewWriter', 'Read', 'ReadAll', 'ReadByte', 'Skip', 'Stderr', 'Stdin', 'Stdout', 'String', 'Write', 'WriteString', 'append_file', 'chmod', 'chown', 'close', 'copy', 'create', 'file_exists', 'file_info', 'file_mode', 'file_mtime', 'file_size', 'glob', 'hardlink', 'http_get', 'http_post', 'http_request', 'is_dir', 'is_file', 'is_symlink', 'lock', 'mkdir', 'mkdir_all', 'open', 'read', 'read_bytes', 'read_dir', 'read_file', 'read_lines', 'read_with', 'read_with_size', 'readlink', 'realpath', 'remove', 'remove_all', 'rename', 'stderr', 'stdin', 'stdout', 'symlink', 'temp_dir', 'temp_file', 'unlock', 'walk', 'which', 'write_bytes', 'write_file'],
    iter: ['bytes', 'chain', 'filter', 'items', 'lines', 'map', 'take'],
    json: ['from_file', 'parse', 'pretty_print', 'query', 'stringify', 'to_file'],
    log: ['close', 'debug', 'error', 'flush', 'get_level', 'info', 'log', 'set_color', 'set_json', 'set_level', 'set_output', 'set_rotate', 'set_ts', 'to_json', 'warn'],
    net: ['Accept', 'CIDR', 'CIDR_contains', 'CIDR_merge', 'ConnClose', 'ConnRead', 'ConnWrite', 'DialTCP', 'DialTimeout', 'DialUDP', 'IPVersion', 'InterfaceBy', 'Interfaces', 'IsIP', 'Listen', 'LookupAddr', 'LookupHost', 'LookupMX', 'LookupNS', 'LookupPort', 'LookupSRV', 'LookupTXT', 'ResolveTCP', 'ResolveUDP', 'dial', 'dial_tcp', 'dial_udp', 'listen_tcp', 'udp_bind', 'udp_dial'],
    os: ['environ', 'exec', 'exec_shell', 'exit', 'getenv', 'getpid', 'hostname', 'kill', 'running', 'setenv', 'shell', 'shell_background', 'signal_notify', 'sleep', 'temp_dir', 'wait'],
    path: ['abs', 'basename', 'clean', 'dirname', 'expand', 'ext', 'is_abs', 'is_rel', 'join', 'normalize', 'rel', 'split', 'stem', 'to_native', 'to_unix', 'volume'],
    rand: ['bytes', 'choice', 'filename', 'float', 'int', 'intn', 'shuffle', 'string', 'uuid'],
    raw: ['BuildDNS', 'BuildEthernet', 'BuildIPv4', 'BuildTCP', 'BuildUDP', 'Close', 'MACToString', 'OpenSocket', 'ParseDNS', 'ParseEthernet', 'ParseIPv4', 'ParseTCP', 'ParseUDP', 'PcapClose', 'PcapFilter', 'PcapNext', 'PcapOpen', 'PcapReadFile', 'PcapWriteFile', 'Receive', 'Send', 'StringToMAC'],
    reflect: ['call', 'call_method', 'convert', 'deep_copy', 'fields', 'from_json', 'get', 'has', 'is_collection', 'is_number', 'set', 'to_json', 'type_of'],
    regex: ['compile', 'find', 'find_all', 'match', 'named', 'replace', 'replace_fn', 'split'],
    rsa: ['Decrypt', 'Encrypt', 'GenerateKeyPair', 'Sign', 'Verify'],
    socket: ['Socket', 'default_timeout', 'port_scan', 'tcp_probe', 'tcp_request', 'tls_request', 'udp_request'],
    ssl: ['Connect', 'DecodePEM', 'EncodePEM', 'GetCertificateInfo', 'GetServerCertificate', 'ParseCertificate', 'ParseCertificates', 'ParseCipherSuite', 'ParseTLSHandshake', 'ParseTLSRecord', 'ParseTLSVersion', 'VerifyCertificate'],
    stdio: ['bell', 'clear', 'clear_line', 'color', 'colorln', 'confirm', 'eof', 'err_print', 'err_printf', 'err_println', 'flush', 'getchar', 'has_input', 'hide_cursor', 'input', 'move_cursor', 'password', 'print', 'printf', 'println', 'prompt', 'put', 'putf', 'putln', 'puts', 'read', 'read_all', 'read_bool', 'read_float', 'read_int', 'read_line', 'select', 'show_cursor'],
    strings: ['Capitalize', 'Compare', 'Contains', 'Count', 'EqualFold', 'FromRunes', 'HasPrefix', 'HasSuffix', 'Index', 'IsBlank', 'IsControl', 'IsDigit', 'IsLetter', 'IsSpace', 'Join', 'LastIndex', 'Repeat', 'Replace', 'ReplaceN', 'RuneCount', 'Runes', 'Split', 'SplitN', 'ToLower', 'ToRunes', 'ToUpper', 'Trim', 'TrimLeft', 'TrimRight', 'TrimSpace'],
    sync: ['Atomic', 'Chan', 'Cond', 'Mutex', 'Once', 'RWMutex', 'Semaphore', 'TLS', 'WaitGroup', 'WorkerPool', 'case', 'default', 'select'],
    sys: ['cpu_info', 'current_user', 'default_gateway', 'disk_info', 'find_process', 'is_executable', 'is_linux', 'is_readable', 'is_root', 'is_windows', 'is_writable', 'kill_process', 'mem_info', 'net_interfaces', 'os_info', 'primary_mac', 'process_info', 'process_list', 'service_restart', 'service_start', 'service_status', 'service_stop', 'user_groups'],
    thread: ['parent', 'self', 'sigstop'],
    time: ['DAY', 'HOUR', 'MILLISECOND', 'MINUTE', 'RFC3339', 'SECOND', 'add', 'after', 'after_chan', 'day', 'days_between', 'diff_days', 'duration', 'format', 'from_unix', 'in_tz', 'local', 'millisecond', 'month', 'new_ticker', 'new_timer', 'now', 'now_ms', 'now_ns', 'now_us', 'parse', 'second', 'sub', 'timestamp', 'tz_offset', 'utc', 'year'],
    toml: ['from_file', 'parse'],
    url: ['Decode', 'Encode', 'Parse'],
    xml: ['Parse', 'ParseFile'],
    yaml: ['from_file', 'parse'],
};
/** 全部命名空间（判断 `xxx.` 是否为库调用时用） */
exports.ALL_NAMESPACES = Object.keys(exports.NS_MEMBERS);
/**
 * import 名 -> 运行时命名空间名。
 *
 * 历史遗留：`import "string"` 之后用的是 `strings.xxx`（多一个 s），
 * `error` 的命名空间名是 `errors`。
 */
exports.MODULE_NAMESPACE = {
    string: 'strings',
    error: 'errors',
};
/** 解析 import 名对应的运行时命名空间 */
function resolveNamespace(module) {
    return exports.MODULE_NAMESPACE[module] || module;
}
//# sourceMappingURL=ns_members.js.map