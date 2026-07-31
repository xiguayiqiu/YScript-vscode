# YScript VSCode 插件

为 YScript（网安专用脚本语言）提供 VSCode 完整支持：语法高亮、LSP 智能补全、悬停文档、跳转定义、代码片段。

---

## 功能

| 能力 | 说明 |
|------|------|
| 语法高亮 | 关键字、类型、内置函数、命名空间、字符串插值、Shell 反引号、bytes 字面量、注释、数字、常量、Test 表达式 |
| 智能补全 | 关键字、类型、内置函数（150+）、struct 方法、dict/list 方法、import 路径 |
| 悬停文档 | 关键字/类型/内置函数的中文说明 |
| 跳转定义 | 跳转到 `func`/`let`/`const`/`struct`/`enum`/`interface` 声明 |
| 文档符号 | 大纲视图中显示函数、变量、类型 |
| 诊断 | 括号未闭合检测、未识别符号提示 |
| 格式化 | 缩进与空白统一 |
| 代码片段 | 40+ 网安场景模板 |

## 代码片段速查

| 前缀 | 描述 | 前缀 | 描述 |
|------|------|------|------|
| `pkgmain` | main 入口 | `ifile` | 检查文件存在 |
| `func` / `funcr` | 函数定义 | `idir` | 检查目录存在 |
| `arrow` | 箭头函数 | `defer` | defer 延迟执行 |
| `if` / `ifelse` / `ifelif` | if 分支 | `drec` | defer+recover |
| `forr` / `forl` / `ford` | for 循环 | `warp` / `wawait` | 并发线程 |
| `match` | 模式匹配 | `shell` / `sv` | Shell 命令 |
| `st` / `stm` | struct/方法 | `bx` / `b64` | bytes 字面量 |
| `en` / `iface` | enum/interface | `pscan` / `sscan` | 端口扫描 |
| `let` / `lett` / `const` | 变量声明 | `hget` | HTTP GET |
| `pf` | printf | `imp` | import |
| `#` / `#*` | 注释 | `todo` | TODO |

## 配置项

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| `yscript.server.path` | 自定义 LSP 可执行文件路径 | `""` |
| `yscript.server.trace` | LSP 通信追踪级别 | `"off"` |
| `yscript.format.tabSize` | 格式化缩进大小 | `4` |

## 命令

- `YScript: Restart Server` — 重启 LSP 服务器
- `YScript: Show Output` — 打开服务器输出面板

## 文件识别

自动识别 `.ys` 和 `.yscript` 文件。

## 安装

```bash
# 开发模式
cd vscode
npm install
npm run compile
# F5 启动调试

# 打包
npm run package
# → yscript-0.1.0.vsix
```
