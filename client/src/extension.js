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
const child_process_1 = require("child_process");
const util_1 = require("util");
const vscode_1 = require("vscode");
const node_1 = require("vscode-languageclient/node");
let client;
let runTerminal;
let checkChannel;
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
/**
 * 定位 ysc 可执行文件：
 * 1. 环境变量 YSC_BIN（例如 /usr/local/bin/ysc）
 * 2. PATH 中的 ysc
 */
function resolveYsc() {
    const fromEnv = (process.env.YSC_BIN || '').trim();
    if (fromEnv) {
        const looksLikePath = path.isAbsolute(fromEnv) ||
            fromEnv.includes('/') ||
            fromEnv.includes(path.sep);
        if (looksLikePath && !fs.existsSync(fromEnv)) {
            vscode_1.window.showErrorMessage(`YSC_BIN 指定的 ysc 不存在: ${fromEnv}`);
            return null;
        }
        return fromEnv;
    }
    return 'ysc';
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
/** 运行 `ysc -c <file>` 做语法检查，通过返回 null，失败返回错误信息 */
async function runCheck(ysc, filePath) {
    try {
        await execFileAsync(ysc, ['-c', filePath], { timeout: 30000, windowsHide: true });
        return null;
    }
    catch (err) {
        const e = err;
        const msg = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim();
        return msg || e.message || 'ysc -c 检查失败';
    }
}
function showCheckErrors(msg) {
    if (!checkChannel)
        checkChannel = vscode_1.window.createOutputChannel('YScript');
    checkChannel.clear();
    checkChannel.appendLine('=== ysc -c 语法检查未通过 ===');
    checkChannel.appendLine(msg);
    checkChannel.show(true);
}
function activate(context) {
    const outputChannel = vscode_1.window.createOutputChannel('YScript Language Server', { log: true });
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
            yscriptVersion: '0.1.0',
        },
    };
    client = new node_1.LanguageClient('yscript', 'YScript Language Server', serverOptions, clientOptions);
    // 启动客户端
    client.start().then(() => {
        outputChannel.appendLine('YScript LSP 已连接');
    }, (err) => {
        outputChannel.appendLine(`YScript LSP 启动失败: ${err.message ?? err}`);
        vscode_1.window.showErrorMessage(`YScript LSP 启动失败: ${err.message ?? err}`);
    });
    context.subscriptions.push(client);
    // 手动重启命令
    context.subscriptions.push(vscode_1.commands.registerCommand('yscript.restartServer', async () => {
        if (client) {
            await client.stop();
            client.start();
            vscode_1.window.showInformationMessage('YScript LSP 已重启');
        }
    }));
    // 跳转到定义命令
    context.subscriptions.push(vscode_1.commands.registerCommand('yscript.showOutput', () => {
        outputChannel.show();
    }));
    // 运行当前脚本：编辑器标题栏 ▶ 按钮 / 命令面板（先 `ysc -c` 语法检查）
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
        const ysc = resolveYsc();
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
        // 1. 语法检查：未通过则不运行
        const checkErr = await runCheck(ysc, filePath);
        if (checkErr) {
            showCheckErrors(checkErr);
            vscode_1.window.showErrorMessage('YScript: 语法检查未通过，已取消运行');
            return;
        }
        // 2. 运行脚本
        const terminal = getYScriptTerminal(path.dirname(filePath));
        terminal.show(true);
        terminal.sendText(`${shellQuote(ysc)} ${shellQuote(filePath)}`, true);
    }));
}
function deactivate() {
    if (!client)
        return undefined;
    return client.stop();
}
//# sourceMappingURL=extension.js.map