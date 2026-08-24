// fal.ts — minimal fal.ai helpers for the worker: upload a local reference image to fal
// storage so image-to-video models (gen_clip --set image_url=...) can fetch it. Mirrors
// bakeoff_clip.py's upload_ref (initiate -> PUT -> file_url). Stdlib https only — no SDK.
import { readFile } from 'fs/promises';
import path from 'path';

const STORAGE_INITIATE = 'https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3';

function falKey(): string {
  const key = (process.env.FAL_KEY ?? '').trim();
  if (!key) throw new Error('FAL_KEY is not set (needed to upload reference images for AI-video)');
  return key;
}

function mimeFor(p: string): string {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

async function reqJson(url: string, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Key ${falKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`fal storage initiate failed ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.json();
}

/**
 * Upload a local image to fal storage once and return the public file_url. The returned
 * URL is what image-to-video models consume as their first-frame / character reference
 * (gen_clip.py's --set image_url=<url>). Reused across re-rolls of the same shot.
 */
export async function uploadRefToFal(absPath: string): Promise<string> {
  const fileName = path.basename(absPath);
  const contentType = mimeFor(absPath);
  const init = await reqJson(STORAGE_INITIATE, { file_name: fileName, content_type: contentType });
  const data = await readFile(absPath);
  const put = await fetch(init.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: data,
  });
  if (put.status !== 200 && put.status !== 201) {
    throw new Error(`fal storage PUT failed: ${put.status}`);
  }
  return init.file_url as string;
}
