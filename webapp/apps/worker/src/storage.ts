// Worker-side local-disk storage. Same dir the web app serves at /media (STORAGE_DIR).
import path from 'path';
import { promises as fs } from 'fs';

export function storageDir(): string {
  const dir = process.env.STORAGE_DIR;
  if (!dir) throw new Error('STORAGE_DIR is not set');
  return dir;
}

export function resolveKey(key: string): string {
  const base = path.resolve(storageDir());
  const abs = path.resolve(base, key);
  if (!abs.startsWith(base + path.sep) && abs !== base) {
    throw new Error(`invalid storage key: ${key}`);
  }
  return abs;
}

export function keyFor(projectId: string, file: string): string {
  return `${projectId}/${file}`;
}

export async function copyIntoStorage(key: string, fromAbsPath: string): Promise<string> {
  const abs = resolveKey(key);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.copyFile(fromAbsPath, abs);
  return key;
}

export async function writeFile(key: string, data: Buffer | Uint8Array): Promise<string> {
  const abs = resolveKey(key);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, data);
  return key;
}

export async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
