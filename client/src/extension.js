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
const path = __importStar(require("path"));
const vscode_1 = require("vscode");
const node_1 = require("vscode-languageclient/node");
let client;
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
}
function deactivate() {
    if (!client)
        return undefined;
    return client.stop();
}
//# sourceMappingURL=extension.js.map