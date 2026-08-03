/**
 * YScript LSP 客户端
 *
 * 负责启动和连接 LSP 服务器，注册到 VSCode。
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  workspace,
  ExtensionContext,
  window,
  commands,
  Terminal,
  OutputChannel,
  Uri,
  env,
  ConfigurationTarget,
} from 'vscode';
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
const YSCRIPT_GITHUB_URL = 'https://github.com/xiguayiqiu/YScript';

/**
 * 在 PATH 中查找可执行文件（Windows 按 PATHEXT 补全扩展名）。
 * 找到返回完整路径，否则返回 null。
 */
function findExecutableOnPath(name: string): string | null {
  const envPath = process.env.PATH ?? '';
  const exts =
    process.platform === 'win32'
      ? (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD')
          .split(';')
          .map((e) => e.trim())
          .filter((e) => e.length > 0)
      : [''];
  for (const dir of envPath.split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = path.join(dir, name + ext);
      try {
        const st = fs.statSync(candidate);
        if (!st.isFile()) continue;
        // Unix 下要求具有可执行权限
        if (process.platform !== 'win32' && (st.mode & 0o111) === 0) continue;
        return candidate;
      } catch {
        // 继续查找下一个候选路径
      }
    }
  }
  return null;
}

/** 让用户选择解释器路径，写入全局设置 yscript.ysc.path，返回选中的路径 */
async function pickYscPath(): Promise<string | null> {
  const picked = await window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    openLabel: '选择 ysc 解释器',
    filters: {
      可执行文件: process.platform === 'win32' ? ['exe', 'cmd', 'bat', 'ps1'] : ['*'],
      所有文件: ['*'],
    },
  });
  if (!picked || picked.length === 0) return null;
  const p = picked[0].fsPath;
  await workspace.getConfiguration('yscript').update('ysc.path', p, ConfigurationTarget.Global);
  return p;
}

/**
 * 找不到 / 路径无效时的引导：打开 GitHub 下载页，或让用户重新指定解释器路径。
 * 用户重新指定成功时返回新路径，否则返回 null。
 */
async function promptForYsc(reason: string): Promise<string | null> {
  const action = await window.showErrorMessage(
    reason,
    '打开 GitHub 下载页',
    '选择解释器路径',
  );
  if (action === '打开 GitHub 下载页') {
    await env.openExternal(Uri.parse(YSCRIPT_GITHUB_URL));
    return null;
  }
  if (action === '选择解释器路径') {
    const p = await pickYscPath();
    if (p) {
      window.showInformationMessage(`已设置 ysc 解释器路径: ${p}`);
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
async function resolveYsc(): Promise<string | null> {
  // 1. 用户自定义路径
  const configPath = (workspace.getConfiguration('yscript').get<string>('ysc.path') ?? '').trim();
  if (configPath) {
    try {
      if (fs.statSync(configPath).isFile()) return configPath;
    } catch {
      // 路径不存在或不可访问，走提示流程
    }
    return promptForYsc(`yscript.ysc.path 指定的解释器不存在: ${configPath}`);
  }

  // 2. 环境变量 YSC_BIN
  const fromEnv = (process.env.YSC_BIN || '').trim();
  if (fromEnv) {
    const looksLikePath =
      path.isAbsolute(fromEnv) ||
      fromEnv.includes('/') ||
      fromEnv.includes(path.sep);
    if (looksLikePath && !fs.existsSync(fromEnv)) {
      return promptForYsc(`YSC_BIN 指定的 ysc 不存在: ${fromEnv}`);
    }
    return fromEnv;
  }

  // 3. PATH 查找
  const found = findExecutableOnPath('ysc');
  if (found) return found;

  // 4. 都没有 → GitHub 下载 / 重新指定
  return promptForYsc('未找到 ysc 解释器。请安装 YScript，或手动指定解释器路径。');
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

      const ysc = await resolveYsc();
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
