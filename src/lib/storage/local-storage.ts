import path from "node:path";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import type { SaveFileInput, SaveFileResult, StorageService } from "@/lib/storage/types";

const STORAGE_ROOT = path.resolve(
  /* turbopackIgnore: true */ process.cwd(),
  process.env.DOCUMENT_STORAGE_DIR || ".data/uploads",
);

/** Keeps filenames filesystem-safe without discarding useful information (e.g. the extension). */
function sanitizeFileName(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe.length > 0 ? safe : "file";
}

/** Resolves a storageKey to an absolute path, refusing to escape the storage root. */
function resolveWithinRoot(storageKey: string): string {
  const resolved = path.resolve(/* turbopackIgnore: true */ STORAGE_ROOT, storageKey);
  if (!resolved.startsWith(STORAGE_ROOT + path.sep) && resolved !== STORAGE_ROOT) {
    throw new Error("Invalid storage key.");
  }
  return resolved;
}

/**
 * Dev-appropriate default storage: saves files to a local directory outside
 * `public/` (never web-accessible directly). Not suitable for serverless
 * deployments with an ephemeral filesystem — swap in an S3/Vercel
 * Blob/Cloudinary implementation of `StorageService` for those.
 */
export class LocalDiskStorageService implements StorageService {
  async save(input: SaveFileInput): Promise<SaveFileResult> {
    const storageKey = path
      .join(input.organizationId, input.documentId, sanitizeFileName(input.fileName))
      .split(path.sep)
      .join("/");
    const absolutePath = resolveWithinRoot(storageKey);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.buffer);

    return { storageKey, storageUrl: null };
  }

  async read(storageKey: string): Promise<Buffer> {
    return readFile(resolveWithinRoot(storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    await rm(resolveWithinRoot(storageKey), { force: true });
  }
}
