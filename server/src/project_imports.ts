import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { tokenize } from './lexer';

function isFile(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function isDirectory(directory: string): boolean {
  try {
    return fs.statSync(directory).isDirectory();
  } catch {
    return false;
  }
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function decodeStringToken(value: string): string {
  return value.slice(1, -1).replace(/\\(["\\])/g, '$1');
}

export function importPathAtOffset(text: string, offset: number): string | null {
  const tokens = tokenize(text);
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== 'keyword' || tokens[i].value !== 'import') continue;

    let tokenIndex = i + 1;
    if (tokens[tokenIndex]?.value === '[') {
      let depth = 1;
      for (tokenIndex++; tokenIndex < tokens.length && depth > 0; tokenIndex++) {
        const token = tokens[tokenIndex];
        if (token.value === '[') depth++;
        else if (token.value === ']') depth--;
        else if (depth > 0 && token.type === 'string' && offset >= token.start && offset <= token.end) {
          return decodeStringToken(token.value);
        }
      }
      continue;
    }

    const token = tokens[tokenIndex];
    if (token?.type === 'string' && offset >= token.start && offset <= token.end) {
      return decodeStringToken(token.value);
    }
  }
  return null;
}

function resolveStoredProjectImportPath(importPath: string): string | null {
  const segments = importPath.split('/');
  if (segments.length < 2 || segments.length > 3 || segments.some((part) => !part || part === '.' || part === '..')) {
    return null;
  }

  const configuredStore = (process.env.YSC_PKG_DIR ?? '').trim();
  const storeRoot = path.resolve(configuredStore || path.join(os.homedir(), '.ysc', 'pkg'));
  const projectEntry = path.resolve(storeRoot, segments[0]);
  if (!isWithin(storeRoot, projectEntry)) return null;

  let projectRoot = projectEntry;
  const locationFile = path.join(projectEntry, '.ysc-location');
  if (isFile(locationFile)) {
    try {
      projectRoot = path.resolve(fs.readFileSync(locationFile, 'utf8').trim());
    } catch {
      return null;
    }
  }
  if (!isDirectory(projectRoot)) return null;

  const packagePath = path.resolve(projectRoot, segments[1]);
  if (!isWithin(projectRoot, packagePath)) return null;

  if (segments.length === 3 && segments[2] !== '*') {
    const fileName = segments[2].endsWith('.ys') ? segments[2] : `${segments[2]}.ys`;
    const filePath = path.resolve(packagePath, fileName);
    return isWithin(packagePath, filePath) && isFile(filePath) ? filePath : null;
  }

  if (isDirectory(packagePath)) {
    const indexFile = path.join(packagePath, 'index.ys');
    if (isFile(indexFile)) return indexFile;
    try {
      const firstSource = fs.readdirSync(packagePath)
        .filter((name) => name.toLowerCase().endsWith('.ys'))
        .sort()[0];
      return firstSource ? path.join(packagePath, firstSource) : null;
    } catch {
      return null;
    }
  }

  const moduleFile = `${packagePath}.ys`;
  if (isFile(moduleFile)) return moduleFile;
  const indexFile = path.join(packagePath, 'index.ys');
  return isFile(indexFile) ? indexFile : null;
}

function resolveLocalImportPath(importPath: string, basePath: string): string | null {
  const wildcard = importPath.endsWith('/*');
  const sourcePath = wildcard ? importPath.slice(0, -2) : importPath;
  const absolutePath = path.isAbsolute(sourcePath)
    ? path.resolve(sourcePath)
    : path.resolve(basePath, sourcePath);

  if (!wildcard && sourcePath.toLowerCase().endsWith('.ys')) {
    return isFile(absolutePath) ? absolutePath : null;
  }
  if (!wildcard && isFile(`${absolutePath}.ys`)) return `${absolutePath}.ys`;

  if (!isDirectory(absolutePath)) return null;
  const indexFile = path.join(absolutePath, 'index.ys');
  if (isFile(indexFile)) return indexFile;
  if (!wildcard) return null;
  try {
    const firstSource = fs.readdirSync(absolutePath)
      .filter((name) => name.toLowerCase().endsWith('.ys'))
      .sort()[0];
    return firstSource ? path.join(absolutePath, firstSource) : null;
  } catch {
    return null;
  }
}

export function resolveProjectImportPath(importPath: string, importingFilePath?: string): string | null {
  const fromStore = resolveStoredProjectImportPath(importPath);
  if (fromStore) return fromStore;
  if (!importingFilePath) return null;
  if (importingFilePath.startsWith('untitled:')) return null;
  const basePath = importingFilePath.startsWith('file:')
    ? path.dirname(fileURLToPath(importingFilePath))
    : importingFilePath;
  return resolveLocalImportPath(importPath, basePath);
}

/** Resolve every source file in an imported project package for symbol metadata. */
export function resolveProjectImportFiles(importPath: string, importingFilePath?: string): string[] {
  const segments = importPath.split('/');
  const storedPath = resolveStoredProjectImportPath(importPath);
  const resolved = storedPath ?? (importingFilePath
    ? resolveProjectImportPath(importPath, importingFilePath)
    : null);
  if (!resolved) return [];
  if (!storedPath) {
    if (!importPath.endsWith('/*')) return [resolved];
    const directory = path.resolve(
      importingFilePath?.startsWith('file:')
        ? path.dirname(fileURLToPath(importingFilePath))
        : importingFilePath ?? process.cwd(),
      importPath.slice(0, -2),
    );
    try {
      return fs.readdirSync(directory)
        .filter((name) => name.toLowerCase().endsWith('.ys'))
        .sort()
        .map((name) => path.join(directory, name));
    } catch {
      return [];
    }
  }
  if (segments.length === 3 && segments[2] !== '*') return [resolved];

  const packageDirectory = path.dirname(resolved);
  if (path.basename(packageDirectory) !== segments[1]) return [resolved];
  try {
    const files = fs.readdirSync(packageDirectory)
      .filter((name) => name.toLowerCase().endsWith('.ys'))
      .sort()
      .map((name) => path.join(packageDirectory, name));
    return files.length > 0 ? files : [resolved];
  } catch {
    return [resolved];
  }
}