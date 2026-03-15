import { mkdir, writeFile, unlink, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";

const STORAGE_ROOT = process.env.APP_STORAGE_ROOT ?? "./storage";
const UPLOADS_DIR = join(STORAGE_ROOT, "uploads");

export async function ensureUploadDir(): Promise<void> {
  await mkdir(UPLOADS_DIR, { recursive: true });
}

export function getUploadsDir(): string {
  return UPLOADS_DIR;
}

export async function storeFile(
  buffer: Buffer,
  originalName: string
): Promise<{ storedName: string; relativePath: string; checksumSha256: string; sizeBytes: number }> {
  await ensureUploadDir();

  const ext = extname(originalName);
  const storedName = `${randomUUID()}${ext}`;
  const relativePath = join("uploads", storedName);
  const absolutePath = join(UPLOADS_DIR, storedName);

  const checksumSha256 = createHash("sha256").update(buffer).digest("hex");

  await writeFile(absolutePath, buffer);

  const fileStat = await stat(absolutePath);

  return {
    storedName,
    relativePath,
    checksumSha256,
    sizeBytes: fileStat.size,
  };
}

export async function deleteFile(relativePath: string): Promise<void> {
  const absolutePath = join(STORAGE_ROOT, relativePath);
  await unlink(absolutePath);
}
