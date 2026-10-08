"use strict";
/**
 * YScript LSP 客户端
 *
 * 负责启动和连接 LSP 服务器，注册到 VSCode。
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode_1 = require("vscode");
const node_1 = require("vscode-languageclient/node");
let client;
let clientReady;
let runTerminal;
const YSCRIPT_GITHUB_URL = 'https://github.com/xiguayiqiu/YScript';
class YScriptDebugConfigurationProvider {
    resolveDebugConfiguration(_folder, config) {
        if (!config.type)
            config.type = 'yscript';
        if (!config.request)
            config.request = 'launch';
        if (config.request === 'launch' && !config.program)
            config.program = '${file}';
        if (config.request === 'attach') {
            if (!config.program)
                config.program = '${file}';
            if (!config.host)
                config.host = '127.0.0.1';
            if (!config.port)
                config.port = 4711;
        }
        return config;
    }
}
class YScriptDebugAdapterDescriptorFactory {
    async createDebugAdapterDescriptor(session) {
        if (session.configuration.request === 'attach') {
            const host = String(session.configuration.host ?? '127.0.0.1');
            const port = Number(session.configuration.port ?? 4711);
            if (!Number.isInteger(port) || port < 1 || port > 65535) {
                throw new Error(`Invalid YScript debug adapter port: ${port}`);
            }
            return new vscode_1.DebugAdapterServer(port, host);
        }
        const ysc = await resolveYsc();
        if (!ysc)
            return undefined;
        const cwd = typeof session.configuration.cwd === 'string'
            ? session.configuration.cwd
            : undefined;
        return new vscode_1.DebugAdapterExecutable(ysc, ['debug-adapter'], { cwd });
    }
}
/**
 * 在 PATH 中查找可执行文件（Windows 按 PATHEXT 补全扩展名）。
 * 找到返回完整路径，否则返回 null。
 */
function findExecutableOnPath(name) {
    const envPath = process.env.PATH ?? '';
    const exts = process.platform === 'win32'
        ? (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD')
            .split(';')
            .map((e) => e.trim())
            .filter((e) => e.length > 0)
        : [''];
    for (const dir of envPath.split(path.delimiter)) {
        if (!dir)
            continue;
        for (const ext of exts) {
            const candidate = path.join(dir, name + ext);
            try {
                const st = fs.statSync(candidate);
                if (!st.isFile())
                    continue;
                // Unix 下要求具有可执行权限
                if (process.platform !== 'win32' && (st.mode & 0o111) === 0)
                    continue;
                return candidate;
            }
            catch {
                // 继续查找下一个候选路径
            }
        }
    }
    return null;
}
/** 让用户选择解释器路径，写入全局设置 yscript.ysc.path，返回选中的路径 */
async function pickYscPath() {
    const picked = await vscode_1.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        openLabel: '选择 ysc 解释器',
        filters: {
            可执行文件: process.platform === 'win32' ? ['exe', 'cmd', 'bat', 'ps1'] : ['*'],
            所有文件: ['*'],
        },
    });
    if (!picked || picked.length === 0)
        return null;
    const p = picked[0].fsPath;
    await vscode_1.workspace.getConfiguration('yscript').update('ysc.path', p, vscode_1.ConfigurationTarget.Global);
    return p;
}
/**
 * 找不到 / 路径无效时的引导：打开 GitHub 下载页，或让用户重新指定解释器路径。
 * 用户重新指定成功时返回新路径，否则返回 null。
 */
async function promptForYsc(reason) {
    const action = await vscode_1.window.showErrorMessage(reason, '打开 GitHub 下载页', '选择解释器路径');
    if (action === '打开 GitHub 下载页') {
        await vscode_1.env.openExternal(vscode_1.Uri.parse(YSCRIPT_GITHUB_URL));
        return null;
    }
    if (action === '选择解释器路径') {
        const p = await pickYscPath();
        if (p) {
            vscode_1.window.showInformationMessage(`已设置 ysc 解释器路径: ${p}`);
        }
        return p;
    }
    return null;
}
/**
 * 定位 ysc 解释器：
 * 1. 设置 yscript.ysc.path
 * 2. 环境变量 YSC_BIN（例如 /usr/local/bin/ysc）
 * 3. PATH 中的 ysc
 * 都找不到时提示 GitHub 下载链接或让用户重新指定路径。
 */
async function resolveYsc() {
    // 1. 用户自定义路径
    const configPath = (vscode_1.workspace.getConfiguration('yscript').get('ysc.path') ?? '').trim();
    if (configPath) {
        try {
            if (fs.statSync(configPath).isFile())
                return configPath;
        }
        catch {
            // 路径不存在或不可访问，走提示流程
        }
        return promptForYsc(`yscript.ysc.path 指定的解释器不存在: ${configPath}`);
    }
    // 2. 环境变量 YSC_BIN
    const fromEnv = (process.env.YSC_BIN || '').trim();
    if (fromEnv) {
        const looksLikePath = path.isAbsolute(fromEnv) ||
            fromEnv.includes('/') ||
            fromEnv.includes(path.sep);
        if (looksLikePath && !fs.existsSync(fromEnv)) {
            return promptForYsc(`YSC_BIN 指定的 ysc 不存在: ${fromEnv}`);
        }
        return fromEnv;
    }
    // 3. PATH 查找
    const found = findExecutableOnPath('ysc');
    if (found)
        return found;
    // 4. 都没有 → GitHub 下载 / 重新指定
    return promptForYsc('未找到 ysc 解释器。请安装 YScript，或手动指定解释器路径。');
}
/** 按当前 shell 引用路径（防止空格/特殊字符导致命令解析错误） */
function shellQuote(value) {
    if (process.platform === 'win32') {
        return `"${value}"`;
    }
    return `'${value.replace(/'/g, `'\\''`)}'`;
}
function getYScriptTerminal(cwd) {
    if (runTerminal && runTerminal.exitStatus === undefined) {
        return runTerminal;
    }
    runTerminal = vscode_1.window.createTerminal({ name: 'YScript Run', cwd });
    return runTerminal;
}
function activate(context) {
    const outputChannel = vscode_1.window.createOutputChannel('YScript Language Server', { log: true });
    context.subscriptions.push(vscode_1.debug.registerDebugConfigurationProvider('yscript', new YScriptDebugConfigurationProvider()), vscode_1.debug.registerDebugAdapterDescriptorFactory('yscript', new YScriptDebugAdapterDescriptorFactory()));
    // 服务器选项：优先使用用户自定义路径，否则使用内置 Node 服务器
    const customPath = vscode_1.workspace.getConfiguration().get('yscript.server.path', '');
    let serverModule;
    if (customPath && customPath.trim().length > 0) {
        serverModule = customPath;
    }
    else {
        serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
    }
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
    const serverOptions = {
        run: { module: serverModule, transport: node_1.TransportKind.ipc },
        debug: { module: serverModule, transport: node_1.TransportKind.ipc, options: debugOptions },
    };
    const documentSelector = [
        { scheme: 'file', language: 'yscript' },
        { scheme: 'untitled', language: 'yscript' },
    ];
    const clientOptions = {
        documentSelector,
        synchronize: {
            fileEvents: vscode_1.workspace.createFileSystemWatcher('**/*.{ys,yscript}'),
        },
        outputChannel,
        revealOutputChannelOn: node_1.RevealOutputChannelOn.Error,
        initializationOptions: {
            yscriptVersion: '0.1.5.2',
        },
    };
    client = new node_1.LanguageClient('yscript', 'YScript Language Server', serverOptions, clientOptions);
    // 启动客户端
    clientReady = client.start().then(() => {
        outputChannel.appendLine('YScript LSP 已连接');
    });
    clientReady.catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`YScript LSP 启动失败: ${message}`);
        vscode_1.window.showErrorMessage(`YScript LSP 启动失败: ${message}`);
    });
    context.subscriptions.push(client);
    const reloadLanguageServer = async () => {
        if (!client) {
            vscode_1.window.showWarningMessage('YScript language server is not running');
            return;
        }
        try {
            await client.stop();
            clientReady = client.start();
            await clientReady;
            outputChannel.appendLine('YScript LSP 已重启');
            vscode_1.window.showInformationMessage('YScript language server reloaded');
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            outputChannel.appendLine(`YScript LSP 重启失败: ${message}`);
            vscode_1.window.showErrorMessage(`YScript language server reload failed: ${message}`);
        }
    };
    context.subscriptions.push(vscode_1.commands.registerCommand('yscript.reloadLanguageServer', reloadLanguageServer), vscode_1.commands.registerCommand('yscript.restartServer', reloadLanguageServer));
    context.subscriptions.push(vscode_1.commands.registerCommand('yscript.debugCurrentFile', async () => {
        const editor = vscode_1.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'yscript') {
            vscode_1.window.showWarningMessage('YScript: 请先打开一个 .ys / .yscript 文件');
            return;
        }
        const document = editor.document;
        if (document.isDirty || document.isUntitled) {
            const saved = await document.save();
            if (!saved) {
                vscode_1.window.showWarningMessage('YScript: 已取消调试，请先保存文件');
                return;
            }
        }
        const program = document.uri.fsPath;
        const folder = vscode_1.workspace.getWorkspaceFolder(document.uri);
        try {
            const started = await vscode_1.debug.startDebugging(folder, {
                type: 'yscript',
                request: 'launch',
                name: 'YScript: Current File',
                program,
                cwd: folder?.uri.fsPath ?? path.dirname(program),
                stopOnEntry: true,
                traceLines: true,
            });
            if (!started) {
                vscode_1.window.showErrorMessage('YScript: 调试会话未能启动，请检查 ysc 路径和调试输出');
                return;
            }
            await vscode_1.commands.executeCommand('workbench.debug.action.focusRepl');
            vscode_1.window.setStatusBarMessage('YScript: 调试会话已启动，输出位于 Debug Console', 5000);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            vscode_1.window.showErrorMessage(`YScript: 启动调试失败: ${message}`);
        }
    }));
    // 跳转到定义命令
    context.subscriptions.push(vscode_1.commands.registerCommand('yscript.showOutput', () => {
        outputChannel.show();
    }));
    // 运行当前脚本：编辑器标题栏 ▶ 按钮 / 命令面板。语法诊断由语言服务器提供。
    context.subscriptions.push(vscode_1.commands.registerCommand('yscript.run', async () => {
        const editor = vscode_1.window.activeTextEditor;
        if (!editor) {
            vscode_1.window.showWarningMessage('YScript: 没有活动编辑器');
            return;
        }
        const doc = editor.document;
        if (doc.languageId !== 'yscript') {
            vscode_1.window.showWarningMessage('YScript: 只能运行 .ys / .yscript 脚本');
            return;
        }
        const ysc = await resolveYsc();
        if (!ysc)
            return;
        // 运行前自动保存（未命名文件会先弹出另存为）
        if (doc.isDirty || doc.isUntitled) {
            const saved = await doc.save();
            if (!saved) {
                vscode_1.window.showWarningMessage('YScript: 已取消运行，请先保存文件');
                return;
            }
        }
        const filePath = doc.uri.fsPath;
        if (!client) {
            vscode_1.window.showErrorMessage('YScript: 语言服务器尚未启动，无法检查脚本语法');
            return;
        }
        let diagnostics;
        try {
            await clientReady;
            diagnostics = await client.sendRequest('yscript/checkDocument', {
                uri: doc.uri.toString(),
                text: doc.getText(),
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            outputChannel.appendLine(`运行前语法检查失败: ${message}`);
            vscode_1.window.showErrorMessage(`YScript: 插件语法检查失败: ${message}`);
            return;
        }
        const errors = diagnostics.filter((diagnostic) => diagnostic.severity === vscode_1.DiagnosticSeverity.Error && diagnostic.source === 'yscript');
        if (errors.length > 0) {
            vscode_1.window.showErrorMessage('YScript: 插件检测到语法错误，请先修复诊断后再运行');
            return;
        }
        const terminal = getYScriptTerminal(path.dirname(filePath));
        terminal.show(true);
        terminal.sendText(`${shellQuote(ysc)} ${shellQuote(filePath)}`, true);
    }));
    // 格式化当前文档（右键菜单 / 命令面板）。
    // 直接复用服务端 lexer 的 formatSource，不依赖 LSP 协商，保证右键点击必定生效。
    context.subscriptions.push(vscode_1.commands.registerCommand('yscript.format', async () => {
        const editor = vscode_1.window.activeTextEditor;
        if (!editor)
            return;
        if (editor.document.languageId !== 'yscript')
            return;
        try {
            // 服务端 lexer.js 无外部依赖（纯 JS），客户端可直接 require
            const lexer = require(path.join(context.extensionPath, 'server', 'out', 'lexer.js'));
            const text = editor.document.getText();
            const tabSize = typeof editor.options.tabSize === 'number'
                ? editor.options.tabSize
                : 4;
            const newText = lexer.formatSource(text, tabSize);
            if (newText === text) {
                vscode_1.window.setStatusBarMessage('YScript: 已是最佳格式', 3000);
                return;
            }
            const edit = new vscode_1.WorkspaceEdit();
            edit.replace(editor.document.uri, new vscode_1.Range(editor.document.positionAt(0), editor.document.positionAt(text.length)), newText);
            const applied = await vscode_1.workspace.applyEdit(edit);
            vscode_1.window.setStatusBarMessage(applied ? 'YScript: 格式化完成' : 'YScript: 格式化失败', 3000);
        }
        catch (err) {
            vscode_1.window.showErrorMessage(`YScript: 格式化出错: ${err instanceof Error ? err.message : String(err)}`);
        }
    }));
}
function deactivate() {
    if (!client)
        return undefined;
    return client.stop();
}
//# sourceMappingURL=extension.js.map