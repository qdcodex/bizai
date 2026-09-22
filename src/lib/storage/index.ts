import { LocalDiskStorageService } from "@/lib/storage/local-storage";
import type { StorageService } from "@/lib/storage/types";

export type { StorageService, SaveFileInput, SaveFileResult } from "@/lib/storage/types";

/**
 * The active storage provider. Only one implementation exists today
 * (local disk); swapping providers means changing this one line.
 */
export const storageService: StorageService = new LocalDiskStorageService();
