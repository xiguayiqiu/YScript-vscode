# YScript VSCode 插件

为 YScript（网络安全开发的专用脚本语言）提供 VSCode 支持：语法高亮、LSP 智能服务、代码片段。

---

## 关于 YScript

YScript 是一门面向**网络安全（InfoSec）** 领域设计的专用脚本语言

### 核心特性

| 特性 | 说明 |
|------|------|
| 🎯 网安原生 | 内置 `tcp_connect`、`http_get`、`b""` 字节字面量、Shell 反引号、`base64`/`hex` 编解码 |
| 🧩 多范式 | 支持函数式、面向对象、泛型、模式匹配、`try`/`defer` 错误处理 |
| ⚡ 静态类型 | 编译期类型检查 + `let` 类型推断，兼顾安全与简洁 |
| 🔧 零依赖 | 标准库覆盖网络、文件、编解码、加解密、Shell 交互等安全场景 |
| 🖥 跨平台 | 编译为原生二进制或解释执行，Linux/macOS/Windows 全支持 |

### 应用场景

- 渗透测试脚本与 PoC 编写
- 网络扫描、协议 fuzzing、payload 生成
- 日志分析、数据提取与格式转换
- 自动化安全工具链编排
- CTF 解题脚本

> YScript 设计哲学：**写得快、跑得稳、看得懂**，让安全工程师专注于漏洞本身而非语言细节。

---

## 功能

| 能力 | 说明 |
|------|------|
| 语法高亮 | 关键字、类型、字符串、Shell 命令反引号、bytes 字面量、注释等 |
| 智能补全 | 关键字、类型、内置函数、用户定义符号、属性/方法、import 路径 |
| 悬停文档 | 关键字/类型/内置函数的中文说明 |
| 跳转定义 | 跳转到 `func`/`let`/`const`/`struct`/`class`/`enum`/`interface` 声明 |
| 文档符号 | 在大纲视图中显示函数、变量、类型 |
| 诊断 | 括号未闭合、未识别符号等 |
| 格式化 | 缩进与空白统一 |
| 代码片段 | `pkgmain`、`func`、`for`、`match`、`warp`、Shell 模板等 |

## 配置项

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| `yscript.server.path` | 自定义 LSP 可执行文件路径（留空使用内置 Node 服务器） | `""` |
| `yscript.server.trace` | 通信追踪级别 | `"off"` |
| `yscript.format.tabSize` | 格式化缩进 | `4` |

## 命令

- `YScript: Restart Server` — 重启 LSP
- `YScript: Show Output` — 打开服务器输出面板

## 文件识别

- `.ys`
- `.yscript`
