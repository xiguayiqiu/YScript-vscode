# YScript VSCode 插件

为 YScript（网安专用脚本语言）提供 VSCode 完整支持：语法高亮、LSP 智能补全、悬停文档、跳转定义、代码片段。

---

## 功能

| 能力 | 说明 |
|------|------|
| 语法高亮 | 关键字、类型、内置函数、命名空间、字符串插值、Shell 反引号、bytes 字面量、注释、数字、常量、Test 表达式 |
| 智能补全 | 关键字、类型、内置函数（250+）、struct 方法（`func this.`）、warp/WaitGroup 成员、dict/list 方法、import 路径 |
| 悬停文档 | 关键字/类型/内置函数的中文说明 |
| 跳转定义 | 跳转到 `func`/`let`/`const`/`struct`/`enum`/`interface` 声明 |
| 文档符号 | 大纲视图中显示函数、变量、类型 |
| 诊断 | 括号未闭合检测 |
| 格式化 | 缩进与空白统一 |
| 一键运行 | 编辑器标题栏 ▶ 按钮，通过 `ysc` 运行当前脚本 |
| 代码片段 | 40+ 网安场景模板 |

## 代码片段速查

| 前缀 | 描述 | 前缀 | 描述 |
|------|------|------|------|
| `pkgmain` | main 入口 | `ifile` | 检查文件存在 |
| `func` / `funcr` | 函数定义 | `idir` | 检查目录存在 |
| `arrow` | 箭头函数 | `defer` | defer 延迟执行 |
| `if` / `ifelse` / `ifelif` | if 分支 | `drec` | defer+recover |
| `forr` / `forl` / `ford` | for 循环 | `warp` / `wawait` | 并发线程 |
| `match` | 模式匹配（`=>` 分支） | `shell` / `sv` | Shell 命令 |
| `tern` / `stm` / `mret` / `wsel` | 三元 / struct 方法 / 多返回值 / sync.select | `warp` / `wawait` | 并发线程 |
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
| `yscript.ysc.path` | 自定义 ysc 解释器可执行文件路径（留空自动查找） | `""` |
| `yscript.format.tabSize` | 格式化缩进大小 | `4` |

## 命令

- `YScript: Restart Server` — 重启 LSP 服务器
- `YScript: Show Output` — 打开服务器输出面板
- `YScript: Run (ysc)` — 运行当前编辑的脚本（编辑器标题栏 ▶ 按钮）

## 一键运行

在 `.ys` / `.yscript` 文件的编辑器标题栏点击 ▶ 按钮（或从命令面板执行 `YScript: Run (ysc)`），插件会先自动保存当前文件，然后调用 `ysc -c` 做语法检查；检查通过后才会在集成终端中运行脚本，检查失败会在 **YScript** 输出面板中显示错误并取消运行。

插件按以下顺序定位 `ysc` 可执行文件：

1. 设置 `yscript.ysc.path`（在设置界面或 `settings.json` 中指定解释器绝对路径）
2. 环境变量 `YSC_BIN`（例如 `export YSC_BIN=/usr/local/bin/ysc`）
3. `PATH` 中的 `ysc`

如果以上都找不到 `ysc`，插件会弹窗提示：可直接打开 **GitHub 下载页**（https://github.com/xiguayiqiu/YScript）下载安装，或点击"选择解释器路径"手动指定 `ysc` 文件（选择后自动写入全局设置 `yscript.ysc.path`）。

运行输出显示在名为 **YScript Run** 的集成终端中。

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
