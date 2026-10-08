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


/** 命名空间 -> 成员名列表（用于 `ns.` 之后的补全） */
export const NS_MEMBERS: Record<string, string[]> = {
  aes: ['Decrypt', 'Encrypt', 'RandomKey'],
  array: ['BinarySearch', 'Chunk', 'Cols', 'Contains', 'Copy', 'Difference', 'Dim', 'Fill', 'Filter', 'Get', 'Intersect', 'Len', 'Map', 'New', 'New2D', 'Range', 'Reduce', 'Reshape', 'Rows', 'Set', 'Sort', 'Union', 'Unique', 'Zip'],
  binary: ['And', 'AppendFile', 'Base64Decode', 'Base64Encode', 'BigEndian', 'BufferBytes', 'BufferCap', 'BufferLen', 'BufferRead', 'BufferReset', 'BufferSeek', 'BufferString', 'BufferWrite', 'Bytes', 'BytesWritten', 'Chunk', 'CloseBuffer', 'CloseReader', 'CloseWriter', 'Compare', 'Concat', 'Contains', 'Create', 'EOF', 'FileClose', 'FileCopy', 'FileRead', 'FileSeek', 'FileStat', 'FileSync', 'FileWrite', 'Float32', 'Float64', 'FromUTF8', 'Grow', 'HexDecode', 'HexEncode', 'Index', 'Int16', 'Int32', 'Int64', 'Int8', 'Len', 'LittleEndian', 'NewBuffer', 'NewReader', 'NewWriter', 'Not', 'Open', 'OpenMode', 'Or', 'PadLeft', 'PadRight', 'PatchEqual', 'PutFloat32', 'PutFloat64', 'PutInt16', 'PutInt32', 'PutInt64', 'PutInt8', 'PutUint16', 'PutUint32', 'PutUint64', 'PutUint8', 'RFind', 'Read', 'ReadAll', 'ReadByte', 'ReadFile', 'Repeat', 'Replace', 'ReplaceAll', 'Seek', 'Skip', 'Slice', 'Split', 'String', 'Trim', 'Truncate', 'UTF8', 'Uint16', 'Uint32', 'Uint64', 'Uint8', 'Write', 'WriteByte', 'WriteFile', 'WriteFloat32', 'WriteFloat64', 'WriteInt16', 'WriteInt32', 'WriteInt64', 'WriteInt8', 'WriteString', 'WriteUint16', 'WriteUint32', 'WriteUint64', 'WriteUint8', 'WriterBytes', 'Xor'],
  c: ['abs', 'access', 'acos', 'asin', 'atan', 'atan2', 'atof', 'atoi', 'atol', 'atoll', 'bind', 'call', 'callback', 'callback_free', 'calloc', 'cbrt', 'ceil', 'chdir', 'clock', 'close', 'compile', 'compile_load', 'compile_obj', 'compiler', 'compilers', 'cos', 'cosh', 'difftime', 'dup', 'dup2', 'exp', 'exp2', 'fabs', 'fclose', 'feof', 'ferror', 'fflush', 'find', 'floor', 'fmax', 'fmin', 'fmod', 'fopen', 'fputc', 'fputs', 'fread', 'free', 'fseek', 'ftell', 'fwrite', 'getchar', 'getcwd', 'getenv', 'getpid', 'getppid', 'getuid', 'header_bind', 'hypot', 'isalnum', 'isalpha', 'isatty', 'iscntrl', 'isdigit', 'isgraph', 'islower', 'isnan', 'isprint', 'ispunct', 'isspace', 'isupper', 'isxdigit', 'link', 'load', 'log', 'log10', 'log2', 'lseek', 'malloc', 'memcmp', 'memcpy', 'memmove', 'memset', 'mkdir', 'parse_header', 'perror', 'pow', 'putchar', 'rand', 'read', 'realloc', 'remove', 'rename', 'rmdir', 'round', 'sin', 'sinh', 'sleep', 'sqrt', 'srand', 'strcat', 'strchr', 'strcmp', 'strcpy', 'strdup', 'stricmp', 'strlen', 'strncmp', 'strncpy', 'strrchr', 'strstr', 'strtod', 'strtol', 'tan', 'tanh', 'time', 'tolower', 'toupper', 'trunc', 'unlink', 'unload', 'usleep', 'write'],
  cli: ['New', 'Parse', 'new', 'parse'],
  color: ['Bg', 'Blink', 'Blue', 'Bold', 'Color256', 'Cyan', 'Green', 'Italic', 'Magenta', 'Print', 'Println', 'RGB', 'RGBA', 'Red', 'Reset', 'Reverse', 'Sprint', 'Sprintf', 'Underline', 'White', 'Yellow'],
  compress: ['gunzip', 'gzip'],
  crypto: ['AES_GCM_Decrypt', 'AES_GCM_Encrypt', 'BLAKE2b', 'BLAKE2s', 'Base58Decode', 'Base58Encode', 'Base64URLDecode', 'Base64URLEncode', 'BcryptHash', 'BcryptVerify', 'ChaCha20_Decrypt', 'ChaCha20_Encrypt', 'ECDSA_Keygen', 'ECDSA_Sign', 'ECDSA_Verify', 'Ed25519_Keygen', 'Ed25519_Sign', 'Ed25519_Verify', 'HMAC_SHA256', 'HMAC_SHA3', 'HMAC_SHA3_256', 'HMAC_SHA3_384', 'HMAC_SHA3_512', 'HMAC_SHA512', 'HashFile', 'MD5', 'PBKDF2', 'SHA1', 'SHA224', 'SHA256', 'SHA384', 'SHA3_224', 'SHA3_256', 'SHA3_384', 'SHA3_512', 'SHA512', 'SHA512_224', 'SHA512_256', 'SHAKE128', 'SHAKE256', 'WPA2_Decrypt', 'WPA2_Encrypt', 'WPA2_MIC_Verify', 'WPA2_PMK', 'WPA2_PTK'],
  csv: ['Parse', 'Read', 'Write'],
  cuda: ['Device_Info', 'HMAC_SHA1_Batch', 'HMAC_SHA256_Batch', 'HMAC_SHA512_Batch', 'MD4_Batch', 'MD5_Batch', 'NTLM_Batch', 'PBKDF2_Batch', 'SHA256_Batch', 'SHA256d_Batch', 'SHA512_Batch', 'Set_Device', 'Sync', 'WPA2_PMK_Batch', 'available', 'device_count', 'device_memory', 'device_name'],
  encoding: ['base64_decode', 'base64_encode', 'hex_decode', 'hex_encode', 'html_decode', 'html_encode', 'url_decode', 'url_encode'],
  errors: ['cause', 'format', 'is', 'new', 'new_with_code', 'with_type', 'wrap'],
  from: ['Appendf', 'Errorf', 'Formats', 'Fprintf', 'Fscanf', 'Print', 'Println', 'Scan', 'Scanf', 'Scanln', 'Sprintf', 'Sscanf'],
  http: ['BasicAuth', 'Body', 'ClearCookies', 'ClearHeaders', 'Cookie', 'Cookies', 'Delete', 'Do', 'Download', 'Dump', 'Form', 'Get', 'Head', 'Headers', 'Insecure', 'Json', 'LastError', 'Ok', 'Options', 'Patch', 'Post', 'Put', 'Query', 'Raw', 'Request', 'Reset', 'Server', 'Session', 'SetAfterResponse', 'SetCookie', 'SetHeader', 'SetMaxBody', 'SetProxy', 'SetRaise', 'SetRedirects', 'SetRetries', 'SetRetryBackoff', 'SetRetryDelay', 'SetTimeout', 'SetUserAgent', 'StatusCode', 'StatusText', 'Upload'],
  ini: ['from_file', 'parse'],
  io: ['Available', 'Buffered', 'Bytes', 'Close', 'Copy', 'Discard', 'EOF', 'ErrBufferFull', 'ErrClosed', 'ErrFinalToken', 'ErrInvalidUnreadByte', 'ErrInvalidUnreadRune', 'ErrNegativeCount', 'ErrNoProgress', 'ErrSeekUnsupported', 'ErrShortBuffer', 'ErrTooLarge', 'ErrUnexpectedEOF', 'Flush', 'LimitReader', 'MultiReader', 'MultiWriter', 'NewBufferedReadWriter', 'NewBufferedReader', 'NewBufferedWriter', 'NewReadWriter', 'NewReader', 'NewScanner', 'NewWriter', 'NopCloser', 'Peek', 'Pipe', 'Read', 'ReadAll', 'ReadByte', 'ReadBytes', 'ReadFrom', 'ReadLine', 'ReadRune', 'ReadSlice', 'ReadString', 'ReaderBuffered', 'ReaderDiscard', 'ReaderReset', 'ReaderSize', 'ReaderWriteTo', 'ScanBytes', 'ScanLines', 'ScanRunes', 'ScanWords', 'ScannerBuffer', 'ScannerBytes', 'ScannerErr', 'ScannerScan', 'ScannerSplit', 'ScannerText', 'SectionReader', 'Skip', 'Stderr', 'Stdin', 'Stdout', 'String', 'TeeReader', 'UnreadByte', 'UnreadRune', 'Write', 'WriteByte', 'WriteRune', 'WriteString', 'WriterBuffered', 'WriterReset', 'WriterSize', 'append_file', 'chmod', 'chown', 'close', 'copy', 'create', 'file_exists', 'file_info', 'file_mode', 'file_mtime', 'file_size', 'glob', 'hardlink', 'http_get', 'http_post', 'http_request', 'is_dir', 'is_file', 'is_symlink', 'lock', 'mkdir', 'mkdir_all', 'open', 'read', 'read_bytes', 'read_dir', 'read_file', 'read_lines', 'read_with', 'read_with_size', 'readlink', 'realpath', 'remove', 'remove_all', 'rename', 'stderr', 'stdin', 'stdout', 'symlink', 'temp_dir', 'temp_file', 'unlock', 'walk', 'which', 'write_bytes', 'write_file'],
  iter: ['bytes', 'chain', 'filter', 'items', 'lines', 'map', 'take'],
  json: ['from_file', 'parse', 'pretty_print', 'query', 'stringify', 'to_file'],
  load: ['load', 'loaded', 'reload', 'unload'],
  log: ['close', 'debug', 'error', 'flush', 'get_level', 'info', 'log', 'set_color', 'set_json', 'set_level', 'set_output', 'set_rotate', 'set_ts', 'to_json', 'warn'],
  net: ['Accept', 'CIDR', 'CIDR_contains', 'CIDR_merge', 'ConnClose', 'ConnRead', 'ConnWrite', 'DialTCP', 'DialTimeout', 'DialUDP', 'IPVersion', 'InterfaceBy', 'Interfaces', 'IsIP', 'Listen', 'LookupAddr', 'LookupHost', 'LookupMX', 'LookupNS', 'LookupPort', 'LookupSRV', 'LookupTXT', 'Nginx', 'ResolveTCP', 'ResolveUDP', 'dial', 'dial_tcp', 'dial_udp', 'listen_tcp', 'nginx', 'udp_bind', 'udp_dial'],
  ocr: ['from_file', 'get_lang', 'get_psm', 'recognize', 'set_lang', 'set_psm'],
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
  sys: ['cpu_features', 'cpu_info', 'current_user', 'cwd', 'default_gateway', 'disk_info', 'exec', 'file_close', 'file_descriptor', 'file_open', 'file_read', 'file_seek', 'file_stat', 'file_sync', 'file_truncate', 'file_write', 'find_process', 'hostname', 'identity_drop', 'is_executable', 'is_linux', 'is_readable', 'is_root', 'is_windows', 'is_writable', 'kill_process', 'mem_info', 'memory_flush', 'memory_lock', 'memory_map', 'memory_protect', 'memory_read', 'memory_unlock', 'memory_unmap', 'memory_write', 'net_interfaces', 'os_info', 'pipe', 'primary_mac', 'process_children', 'process_info', 'process_list', 'process_replace', 'process_start', 'process_wait', 'service_restart', 'service_start', 'service_status', 'service_stop', 'signal_close', 'signal_send', 'signal_subscribe', 'signal_wait', 'uptime', 'user_groups'],
  thread: ['parent', 'self', 'sigstop'],
  time: ['DAY', 'HOUR', 'MILLISECOND', 'MINUTE', 'RFC3339', 'SECOND', 'add', 'after', 'after_chan', 'day', 'days_between', 'diff_days', 'duration', 'format', 'from_unix', 'in_tz', 'local', 'millisecond', 'month', 'new_ticker', 'new_timer', 'now', 'now_ms', 'now_ns', 'now_us', 'parse', 'second', 'sub', 'timestamp', 'tz_offset', 'utc', 'year'],
  toml: ['from_file', 'parse'],
  url: ['Decode', 'Encode', 'Parse'],
  xml: ['Parse', 'ParseFile'],
  yaml: ['from_file', 'parse'],
};

/** 全部命名空间（判断 `xxx.` 是否为库调用时用） */
export const ALL_NAMESPACES: string[] = Object.keys(NS_MEMBERS);

/**
 * import 名 -> 运行时命名空间名。
 *
 * 历史遗留：`import "string"` 之后用的是 `strings.xxx`（多一个 s），
 * `error` 的命名空间名是 `errors`。
 */
export const MODULE_NAMESPACE: Record<string, string> = {
  string: 'strings',
  error: 'errors',
};

/** 解析 import 名对应的运行时命名空间 */
export function resolveNamespace(module: string): string {
  return MODULE_NAMESPACE[module] || module;
}
