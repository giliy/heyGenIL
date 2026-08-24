// Local-disk storage module. STORAGE_DIR holds <projectId>/<file>; the /media/[...key]
// route serves bytes from here. The worker writes to the same dir (shared path on
// localhost). S3 is a config swap later per _shared-decisions.md §Storage.
import path from 'path';
import { promises as fs } from 'fs';
import { createReadStream } from 'fs';

export function storageDir(): string {
  const dir = process.env.STORAGE_DIR;
  if (!dir) throw new Error('STORAGE_DIR is not set');
  return dir;
}

/** Resolve a storage key to an absolute path, guarding against path traversal. */
export function resolveKey(key: string): string {
  const base = path.resolve(storageDir());
  const abs = path.resolve(base, key);
  if (!abs.startsWith(base + path.sep) && abs !== base) {
    throw new Error(`invalid storage key (path traversal): ${key}`);
  }
  return abs;
}

export function keyFor(projectId: string, file: string): string {
  return `${projectId}/${file}`;
}

export async function writeFile(key: string, data: Buffer | Uint8Array): Promise<string> {
  const abs = resolveKey(key);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, data);
  return key;
}

export async function copyIntoStorage(key: string, fromAbsPath: string): Promise<string> {
  const abs = resolveKey(key);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.copyFile(fromAbsPath, abs);
  return key;
}

export async function exists(key: string): Promise<boolean> {
  try {
    await fs.access(resolveKey(key));
    return true;
  } catch {
    return false;
  }
}

export async function stat(key: string) {
  return fs.stat(resolveKey(key));
}

export function readStream(key: string) {
  return createReadStream(resolveKey(key));
}

/** Map a key's file extension to a Content-Type. */
export function contentTypeFor(key: string): string {
  const ext = path.extname(key).toLowerCase();
  switch (ext) {
    case '.mp4':
    case '.m4v':
      return 'video/mp4';
    case '.mov':
      return 'video/quicktime';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webm':
      return 'video/webm';
    case '.mp3':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    default:
      return 'application/octet-stream';
  }
}
