/**
 * YScript LSP 客户端
 *
 * 负责启动和连接 LSP 服务器，注册到 VSCode。
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { workspace, ExtensionContext, window, commands, Terminal, OutputChannel } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
  RevealOutputChannelOn,
  DocumentSelector,
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;
let runTerminal: Terminal | undefined;
let checkChannel: OutputChannel | undefined;
const execFileAsync = promisify(execFile);

/**
 * 定位 ysc 可执行文件：
 * 1. 环境变量 YSC_BIN（例如 /usr/local/bin/ysc）
 * 2. PATH 中的 ysc
 */
function resolveYsc(): string | null {
  const fromEnv = (process.env.YSC_BIN || '').trim();
  if (fromEnv) {
    const looksLikePath =
      path.isAbsolute(fromEnv) ||
      fromEnv.includes('/') ||
      fromEnv.includes(path.sep);
    if (looksLikePath && !fs.existsSync(fromEnv)) {
      window.showErrorMessage(`YSC_BIN 指定的 ysc 不存在: ${fromEnv}`);
      return null;
    }
    return fromEnv;
  }
  return 'ysc';
}

/** 按当前 shell 引用路径（防止空格/特殊字符导致命令解析错误） */
function shellQuote(value: string): string {
  if (process.platform === 'win32') {
    return `"${value}"`;
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function getYScriptTerminal(cwd: string): Terminal {
  if (runTerminal && runTerminal.exitStatus === undefined) {
    return runTerminal;
  }
  runTerminal = window.createTerminal({ name: 'YScript Run', cwd });
  return runTerminal;
}

/** 运行 `ysc -c <file>` 做语法检查，通过返回 null，失败返回错误信息 */
async function runCheck(ysc: string, filePath: string): Promise<string | null> {
  try {
    await execFileAsync(ysc, ['-c', filePath], { timeout: 30_000, windowsHide: true });
    return null;
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const msg = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim();
    return msg || e.message || 'ysc -c 检查失败';
  }
}

function showCheckErrors(msg: string): void {
  if (!checkChannel) checkChannel = window.createOutputChannel('YScript');
  checkChannel.clear();
  checkChannel.appendLine('=== ysc -c 语法检查未通过 ===');
  checkChannel.appendLine(msg);
  checkChannel.show(true);
}

export function activate(context: ExtensionContext) {
  const outputChannel = window.createOutputChannel('YScript Language Server', { log: true });

  // 服务器选项：优先使用用户自定义路径，否则使用内置 Node 服务器
  const customPath: string = workspace.getConfiguration().get('yscript.server.path', '');
  let serverModule: string;

  if (customPath && customPath.trim().length > 0) {
    serverModule = customPath;
  } else {
    serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
  }

  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions },
  };

  const documentSelector: DocumentSelector = [
    { scheme: 'file', language: 'yscript' },
    { scheme: 'untitled', language: 'yscript' },
  ];

  const clientOptions: LanguageClientOptions = {
    documentSelector,
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('**/*.{ys,yscript}'),
    },
     outputChannel,
    revealOutputChannelOn: RevealOutputChannelOn.Error,
    initializationOptions: {
      yscriptVersion: '0.1.0',
    },
  };

  client = new LanguageClient('yscript', 'YScript Language Server', serverOptions, clientOptions);

  // 启动客户端
  client.start().then(
    () => {
      outputChannel.appendLine('YScript LSP 已连接');
    },
    (err: Error) => {
      outputChannel.appendLine(`YScript LSP 启动失败: ${err.message ?? err}`);
      window.showErrorMessage(`YScript LSP 启动失败: ${err.message ?? err}`);
    },
  );

  context.subscriptions.push(client);

  // 手动重启命令
  context.subscriptions.push(
    commands.registerCommand('yscript.restartServer', async () => {
      if (client) {
        await client.stop();
        client.start();
        window.showInformationMessage('YScript LSP 已重启');
      }
    }),
  );

  // 跳转到定义命令
  context.subscriptions.push(
    commands.registerCommand('yscript.showOutput', () => {
      outputChannel.show();
    }),
  );

  // 运行当前脚本：编辑器标题栏 ▶ 按钮 / 命令面板（先 `ysc -c` 语法检查）
  context.subscriptions.push(
    commands.registerCommand('yscript.run', async () => {
      const editor = window.activeTextEditor;
      if (!editor) {
        window.showWarningMessage('YScript: 没有活动编辑器');
        return;
      }
      const doc = editor.document;
      if (doc.languageId !== 'yscript') {
        window.showWarningMessage('YScript: 只能运行 .ys / .yscript 脚本');
        return;
      }

      const ysc = resolveYsc();
      if (!ysc) return;

      // 运行前自动保存（未命名文件会先弹出另存为）
      if (doc.isDirty || doc.isUntitled) {
        const saved = await doc.save();
        if (!saved) {
          window.showWarningMessage('YScript: 已取消运行，请先保存文件');
          return;
        }
      }

      const filePath = doc.uri.fsPath;

      // 1. 语法检查：未通过则不运行
      const checkErr = await runCheck(ysc, filePath);
      if (checkErr) {
        showCheckErrors(checkErr);
        window.showErrorMessage('YScript: 语法检查未通过，已取消运行');
        return;
      }

      // 2. 运行脚本
      const terminal = getYScriptTerminal(path.dirname(filePath));
      terminal.show(true);
      terminal.sendText(`${shellQuote(ysc)} ${shellQuote(filePath)}`, true);
    }),
  );
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) return undefined;
  return client.stop();
}
