# YScript VSCode 插件

为 YScript（网安专用脚本语言）提供 VSCode 完整支持：语法高亮、LSP 智能补全、悬停文档、跳转定义、代码片段。

当前适配 YScript 解释器 `v0.1.5.3`；VS Code 扩展包版本独立管理。扩展可识别并高亮 `ysc.models` / `ysc.sum` 项目依赖清单。

## 项目依赖清单

`ysc.models` 和 `ysc.sum` 使用独立的 `yscmanifest` 语法高亮，覆盖项目/依赖声明、版本、Git URL 与 `h1:` 校验值。依赖获取和同步由解释器命令 `ysc mod get` / `ysc mod sync` 执行。

## YScript v0.1.5.3

- `package` 只声明源文件所属包；多文件包的声明文件无需单独包含 `func main()`，避免库文件和测试文件的入口误报。
- `cli` 支持 `app.command()` 子命令、自动转换 int / float / bool、choices 与数值范围校验、互斥参数组及 `multi_option()` 重复参数列表；同步命令行参数库文档与集成测试。
- 泛型函数与泛型结构体支持类型参数、实参/字段类型推导、内建约束（`any` / `number` / `ordered` / `comparable`）和结构化接口约束；语法高亮支持泛型声明、类型参数/实参及约束，编辑器新增泛型函数、结构体与约束代码片段。
- `load` 新增模块生命周期接口：`load.install(path)` 安装而不执行，`load.start(path)` 执行已安装模块，`load.stop(path)` 调用可选的模块级 `stop()`，`load.uninstall(path)` 必要时先停止再移除声明。
- `ysc doc` 支持按函数名关联任意位置的文档块：`@functionName HEAD` 到 `@functionName END` 之间的 `#` 注释会覆盖就近注释；注解标记有专用语法高亮。

## YScript v0.1.5.2

- 识别 `name <- expression` 类型推断声明，提供语法诊断、变量符号/类型提示与自动补全。
- 同步无符号整数类型提示、OCR 与顶层代码诊断。
- 二进制命名空间补全新增 `binary.FileCopy`，支持大文件有界内存流式复制。
- `sys` 命名空间补充跨平台进程、同步命令执行、文件句柄、内存映射、信号、CPU 特性等系统接口。
- `io` 命名空间补充 `Reader` / `Writer` / `Closer` 契约、`Pipe`、`TeeReader`、`MultiWriter`、`SectionReader`、`Discard` / `NopCloser`、缓存流适配器与错误常量，方便流式处理与 sys 层桥接。
- 补全缓冲流 API：Reader / Writer 的容量查询与 Reset、Peek / 回退 / 分隔读取 / 逐行读取、WriteTo / ReadFrom / Flush，合并 ReadWriter，以及支持行、词、字节、rune 分割和缓冲区配置的 Scanner。
- 更新 `package main` 入口和函数代码片段说明。

`load` 命名空间补全和悬停文档覆盖全部接口。生命周期方法接收 YScript 源文件路径字符串：`load.install(path)` 解析、编译并注册模块，不执行初始化或顶层代码；`load.start(path)` 执行已安装模块的初始化和顶层代码；`load.stop(path)` 调用模块可选的 `stop()` 函数；`load.uninstall(path)` 在需要时先停止模块，再移除其声明。

兼容的既有热加载接口仍可使用：`load.load(path)` 加载模块并返回可调用的导出字典；源文件更新后调用 `load.reload(path)` 替换已加载模块；`load.unload(path)` 卸载模块并清空导出字典；`load.loaded()` 列出已加载路径。

---

## 功能

| 能力 | 说明 |
|------|------|
| 语法高亮 | 关键字、类型、内置函数、命名空间、文档注解标记、字符串插值、Shell 反引号、bytes 字面量、注释、数字、常量、Test 表达式、**C/FFI 类型**（`struct:int32,double`、`clong`/`culong`、`ptr`/`cstring`） |
| 命名空间补全 | `ns.` 之后补全该模块全部成员（含 `io` 缓冲流 / Scanner、`c.`、`ffi.`、`ocr.` 与 `load.`） |
| **自动 import** | 检测「用了内置库却没 import」并给出警告；支持**一键快速修复**（`Ctrl+.`）与**补全联动**（输入 `binary.` 时列表首项即为「＋ 添加 import"binary"」，选中即自动写入） |
| 智能补全 | 关键字、类型、内置函数（250+）、struct 方法（`func this.`）、warp/WaitGroup 成员、dict/list 方法、import 路径 |
| 悬停文档 | 关键字/类型/内置函数的中文说明 |
| 跳转定义 | 跳转到当前文件或第三方库的 `func`/`let`/`const`/`struct`/`enum`/`interface` 声明 |
| 文档符号 | 大纲视图中显示函数、变量、类型 |
| 诊断 | 插件内置 YScript 词法/语法检查、静态检查警告、括号未闭合、重复函数声明、顶层变量声明与函数外可执行语句检测、第三方导入函数同名冲突提示、敏感操作的 `#!permit` 权限提示；无需启动 `ysc -c` |
| 自定义符号解析 | 当前文件和第三方库中的自定义函数、结构体方法支持补全、签名帮助、悬停和跳转定义；支持导入别名及相对路径库；同名函数候选不再按导入顺序误选 |
| 格式化 | 右键菜单、命令面板支持“YScript: 格式化文档”，通过 `ysc fmt -t` 使用与 CLI 一致的格式化器，并仅更新编辑器缓冲区 |
| 一键运行 | 编辑器标题栏 ▶ 按钮，通过 `ysc` 运行当前脚本 |
| 调试 | 左侧 YScript Debug 入口和 VS Code 原生 DAP：行/函数/条件断点、日志点、单步、变量/栈查看、表达式求值与修改、未捕获异常暂停、执行跟踪及 TCP attach |
| 代码片段 | 60+ 网安场景模板 |

## 代码片段速查

| 前缀 | 描述 | 前缀 | 描述 |
|------|------|------|------|
| `pkgmain` | main 入口 | `ifile` | 检查文件存在 |
| `func` / `funcr` | 函数定义 | `idir` | 检查目录存在 |
| `genericfunc` / `genericstruct` / `genericconstraint` | 泛型函数、泛型结构体与约束 | `infer` | `name <- value` 类型推断声明 |
| `arrow` | 箭头函数 | `defer` | defer 延迟执行 |
| `if` / `ifelse` / `ifelif` | if 分支 | `drec` | defer+recover |
| `forr` / `forl` / `ford` | for 循环 | `warp` / `wawait` | 并发线程 |
| `match` | 模式匹配（`=>` 分支） | `shell` / `sv` | Shell 命令 |
| `tern` / `stm` / `mret` / `wsel` | 三元 / struct 方法 / 多返回值 / sync.select | `warp` / `wawait` | 并发线程 |
| `st` / `stm` | struct/方法 | `bx` / `b64` | bytes 字面量 |
| `en` / `iface` | enum/interface | `pscan` / `sscan` | 端口扫描 |
| `let` / `lett` / `const` | 变量声明 | `hget` | HTTP GET |
| `infer` | `name <- value` 类型推断声明 | `hsess` / `hform` | HTTP 会话 / 表单 |
| `hup` / `hdown` | HTTP 上传 / 下载 | `pf` | printf |
| `imp` | import | `#` / `#*` | 注释 |
| `todo` | TODO | | |

## 配置项

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| `yscript.server.path` | 自定义 LSP 可执行文件路径 | `""` |
| `yscript.server.trace` | LSP 通信追踪级别 | `"off"` |
| `yscript.ysc.path` | 自定义 ysc 解释器可执行文件路径（留空自动查找） | `""` |
| `yscript.format.tabSize` | 格式化缩进大小 | `4` |

## 命令

- `Reload Language YScript` — 重启 YScript 语言服务器
- `YScript: Show Output` — 打开服务器输出面板
- `YScript: Run (ysc)` — 运行当前编辑的脚本（编辑器标题栏 ▶ 按钮）
- `YScript: 格式化文档 (Format Document)` — 使用已配置的 `ysc` 格式化当前 `.ys` 文档

## 程序入口

可执行文件使用 `package main` 和 `func main()` 作为入口。`package` 用于标记当前声明文件所属的包；同一包可由多个文件组成，库声明文件无需各自声明 `func main()`，导入后即可调用其函数。`func main()` 只能声明在 `package main` 中。文件顶层用于包、导入、函数及类型声明；变量声明和执行语句应放入 `main()` 或其他函数中。插件语言服务器会在编辑时直接检查词法和常见语法错误，并提供自定义函数及方法的关联提示，不需要安装或启动 `ysc -c` 才能获得诊断。

```yscript
package main
import ["ocr", "io"]

func main() {
  let image = io.read_bytes("sample.png")
  println(ocr.recognize(image))
}

func recognize_file(path) {
  return ocr.from_file(path, "eng", 6)
}
```

## 一键运行

在 `.ys` / `.yscript` 文件的编辑器标题栏点击 ▶ 按钮（或从命令面板执行 `YScript: Run (ysc)`），插件会先自动保存当前文件，再检查语言服务器提供的语法诊断；存在语法错误时会取消运行，否则在集成终端中调用 `ysc` 执行脚本。`yscript.ysc.path`、`YSC_BIN` 和 `PATH` 仅用于定位运行脚本所需的解释器。

插件按以下顺序定位 `ysc` 可执行文件：

1. 设置 `yscript.ysc.path`（在设置界面或 `settings.json` 中指定解释器绝对路径）
2. 环境变量 `YSC_BIN`（例如 `export YSC_BIN=/usr/local/bin/ysc`）
3. `PATH` 中的 `ysc`

如果以上都找不到 `ysc`，插件会弹窗提示：可直接打开 **GitHub 下载页**（https://github.com/xiguayiqiu/YScript）下载安装，或点击"选择解释器路径"手动指定 `ysc` 文件（选择后自动写入全局设置 `yscript.ysc.path`）。

运行输出显示在名为 **YScript Run** 的集成终端中。

## 调试

点击左侧字母 **Y** 图标打开 **YScript Debug**，再点“调试当前文件”即可启动当前 `.ys` / `.yscript` 文件；启动后会自动显示 Debug Console。也可在行号边栏设置断点后按 `F5`。可在调试控制台求值、在 WATCH 面板跟踪表达式，并在 VARIABLES 中查看或修改变量。launch 配置也支持 `stopOnEntry`、`traceLines` 和 `traceCalls`。远程 attach 需要提供目标机上的 `program` 路径；目标机运行 `ysc debug-adapter --listen=tcp:127.0.0.1:4711` 后，在 VS Code 选择 **YScript: Attach**。详细能力和安全边界见[调试器文档](../doc/YScript.wiki/55_调试器.md)。

## 文件识别

自动识别 `.ys` 和 `.yscript` 文件。

## 文件图标（侧边栏 logo）

插件自带一套 **YScript File Icons** 文件图标主题，为 `.ys` / `.yscript` 文件在资源管理器侧边栏显示 YS logo。安装插件后需要手动启用（图标主题无法由插件自动切换）：

1. 打开命令面板（`Ctrl+Shift+P`），执行 `Preferences: File Icon Theme`；
2. 选择 **YScript File Icons**。

也可以在 `settings.json` 中直接指定：

```json
{
  "workbench.iconTheme": "yscript-icons"
}
```

未启用该主题时（例如使用默认 Seti 主题），`.ys` 文件仍会通过语言默认图标显示 YS logo。

---

## 维护：标准库成员数据从实现自动生成

命名空间成员表 `server/src/ns_members.ts` **由脚本从解释器源码生成，不要手工编辑**：

```bash
cd yscript && python3 tools/gen_ns_members.py > ../vscode/server/src/ns_members.ts
cd ../vscode && npm run compile      # 或 ./node_modules/.bin/tsc -p server/tsconfig.json
```

提取来源：
1. `MakeNS("ns", map[string]value.BuiltinFunc{...})` —— 各命名空间注册表
2. `buildCFuncNames()` —— `c` 模块（成员动态拼装，静态扫描抓不到）

这样改了 `internal/std/*.go` 后重新生成即可，不会再出现「插件漏收录新函数」。

新增代码片段前缀：`c call`、`c callback`、`c header bind`、`c parse header`、
`ffi struct`、`ffi alloc`、`c variadic`、`raw pcap`、`worker`。

---

## 自动 import 的行为

YScript 的标准库必须先 `import` 才能用。LSP 会自动帮你补上：

**1. 诊断**：使用了内置模块却没导入时，该行出现黄色波浪线，例如

```
未导入模块 "binary"，请先写 import ["binary"]（或用快速修复自动添加）
```

> `import "string"` 之后实际用的是 `strings.xxx`，所以提示的是 `import "string"]`；
> `error` 同理对应 `errors`。

**2. 快速修复**：光标放在波浪线处按 `Ctrl+.`（或 `Cmd+.`），选「添加 import "binary"」即可。
支持三种插入风格，且不会重复添加：

| 现状 | 结果 |
|------|------|
| `import [` … `]` 多行列表 | 插进列表，缩进跟随已有项 |
| `import ["c"]` 单行列表 | 追加为 `import ["c", "binary"]` |
| `import "c"` 单行 | 另起一行 `import "binary"` |
| 完全没有 import | 插到 `package` 行之后 |

**3. 补全联动**：输入 `binary.` 时，若未导入，补全列表**首项**是
`＋ 添加 import "binary"`，按回车选中即自动写入 import 语句。

**误报已排除**：字符串内、注释内、局部变量遮蔽（`let binary = 1`）、
成员访问（`foo.binary`）均不会触发。

核心逻辑在 `server/src/imports.ts`（`parseImports` / `findUnimportedUses` /
`buildImportEdit`），命名空间数据来自自动生成的 `ns_members.ts`。

## `#!permit` 权限提示

编辑器会识别常见的文件读写、外部命令和网络调用。没有 `#!permit` 时显示信息提示，说明 YScript 默认不启用沙箱；已有策略但未声明该调用类别时显示警告，因为运行时可能拒绝调用。诊断快速修复会在文件开头（保留 shebang）插入 `#!permit <类别>`；此声明授权该类别的全部目标，建议按需改为具体路径或命令规则。提示属于静态分析，动态路径、`io.open` 模式以及命令行 `--sandbox` 覆盖规则仍以运行时为准。
