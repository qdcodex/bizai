/**
 * Storage abstraction for uploaded document files. Documents never live
 * inside MongoDB — only metadata does (see the `Document` model). Swap
 * `LocalDiskStorageService` for an S3/Vercel Blob/Cloudinary implementation
 * in production by implementing this same interface; nothing else changes.
 */
export interface SaveFileInput {
  organizationId: string;
  documentId: string;
  fileName: string;
  buffer: Buffer;
}

export interface SaveFileResult {
  /** Opaque handle the storage service needs to read/delete the file later. */
  storageKey: string;
  /** Publicly resolvable URL, if the provider exposes one (null for local disk). */
  storageUrl: string | null;
}

export interface StorageService {
  save(input: SaveFileInput): Promise<SaveFileResult>;
  read(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
}
