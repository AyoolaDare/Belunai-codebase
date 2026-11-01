// Registered Storage buckets and object keys (backend_schema.md section 9).
// Every key is built here from server-known IDs; client-supplied keys are
// never trusted, only parsed and checked against these patterns. Keys match
// the database CHECKs (private.is_image_object_path, post_media).
import "server-only";

export const IMAGE_MIME_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type ImageMimeType = keyof typeof IMAGE_MIME_TYPES;
export type ImageExtension = (typeof IMAGE_MIME_TYPES)[ImageMimeType];

/** Section 2.1: at most 10 MiB and 20 megapixels per file. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 20_000_000;

/** Operational signed URLs live at most 60 seconds, issued after an access check. */
export const MAX_SIGNED_URL_SECONDS = 60;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const EXT = "(jpg|png|webp)";
const UUID_ONLY = new RegExp(`^${UUID}$`);

type BucketSpec<S extends Record<string, string>> = {
  /** Folder for one owning scope, without trailing slash. */
  folder: (scope: S) => string;
  /** Parses a full key into its scope and asset ID, or null if unregistered. */
  pattern: RegExp;
  scopeKeys: (keyof S)[];
};

function spec<S extends Record<string, string>>(
  folder: (scope: S) => string,
  pattern: string,
  scopeKeys: (keyof S)[],
): BucketSpec<S> {
  return { folder, pattern: new RegExp(`^${pattern}/(${UUID})\\.${EXT}$`), scopeKeys };
}

export const BUCKETS = {
  "profile-assets": spec<{ userId: string }>((s) => `profiles/${s.userId}`, `profiles/(${UUID})`, ["userId"]),
  "organisation-assets": spec<{ organisationId: string }>(
    (s) => `organisations/${s.organisationId}`,
    `organisations/(${UUID})`,
    ["organisationId"],
  ),
  "community-assets": spec<{ communityId: string }>(
    (s) => `communities/${s.communityId}`,
    `communities/(${UUID})`,
    ["communityId"],
  ),
  // The asset ID is the post_media row ID.
  "post-images": spec<{ postId: string }>((s) => `posts/${s.postId}`, `posts/(${UUID})`, ["postId"]),
  "verification-evidence": spec<{ organisationId: string; requestId: string }>(
    (s) => `organisations/${s.organisationId}/requests/${s.requestId}`,
    `organisations/(${UUID})/requests/(${UUID})`,
    ["organisationId", "requestId"],
  ),
  "moderation-evidence": spec<{ reportId: string }>((s) => `reports/${s.reportId}`, `reports/(${UUID})`, ["reportId"]),
} as const;

export type BucketId = keyof typeof BUCKETS;
export type BucketScope<B extends BucketId> = Parameters<(typeof BUCKETS)[B]["folder"]>[0];

export function isBucketId(value: string): value is BucketId {
  return Object.hasOwn(BUCKETS, value);
}

function assertUuid(value: string, name: string) {
  if (!UUID_ONLY.test(value)) throw new Error(`${name} must be a lowercase UUID.`);
}

/**
 * Builds the immutable key for a new object: <folder>/<assetId>.<ext>.
 * Callers reserve the key (and its database row) before issuing an upload grant.
 */
export function objectKey<B extends BucketId>(
  bucket: B,
  scope: BucketScope<B>,
  assetId: string,
  mimeType: ImageMimeType,
): string {
  const entry = BUCKETS[bucket] as unknown as BucketSpec<Record<string, string>>;
  for (const name of entry.scopeKeys) assertUuid((scope as Record<string, string>)[name as string] ?? "", String(name));
  assertUuid(assetId, "assetId");
  const extension = IMAGE_MIME_TYPES[mimeType];
  if (!extension) throw new Error("Unsupported image type.");
  return `${entry.folder(scope as Record<string, string>)}/${assetId}.${extension}`;
}

/**
 * Parses a key against its bucket's registered pattern. Returns null for any
 * key outside the registry (traversal, wrong folder, other extensions, case).
 */
export function parseObjectKey<B extends BucketId>(
  bucket: B,
  key: string,
): { scope: BucketScope<B>; assetId: string; extension: ImageExtension } | null {
  if (!isBucketId(bucket)) return null;
  const entry = BUCKETS[bucket] as unknown as BucketSpec<Record<string, string>>;
  const match = entry.pattern.exec(key);
  if (!match) return null;
  const values = match.slice(1);
  const scope = Object.fromEntries(entry.scopeKeys.map((name, i) => [name, values[i]]));
  return {
    scope: scope as BucketScope<B>,
    assetId: values[entry.scopeKeys.length],
    extension: values[entry.scopeKeys.length + 1] as ImageExtension,
  };
}
