/**
 * YScript LSP 客户端
 *
 * 负责启动和连接 LSP 服务器，注册到 VSCode。
 */

import * as path from 'path';
import { workspace, ExtensionContext, window, commands } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
  RevealOutputChannelOn,
  DocumentSelector,
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

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
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) return undefined;
  return client.stop();
}
