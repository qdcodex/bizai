import { z } from "zod";

/**
 * Deliberately loose: `z.record` with an enum key schema requires every
 * enum value to be present as a key, which doesn't match "partial map of
 * whichever roles the admin is updating." Real validation (valid role keys,
 * valid module keys, owner never restricted) happens in
 * updateModuleVisibility — this just shapes the input as a plain string ->
 * string[] map.
 */
export const moduleVisibilitySchema = z.record(z.string(), z.array(z.string()));

export type ModuleVisibilityInput = z.infer<typeof moduleVisibilitySchema>;
