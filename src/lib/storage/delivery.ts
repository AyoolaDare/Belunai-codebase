// The no-store delivery boundary for protected media (backend_schema.md section 9).
// A route checks the viewer's current access to the parent first, then
// streams the bytes with these headers. Responses are never cached by the
// browser, CDN or Vercel, so a privacy or status change takes effect on the
// next request. Bytes already downloaded cannot be recalled.
import "server-only";
import type { ImageMimeType } from "./buckets";

export const PROTECTED_MEDIA_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "Content-Disposition": "inline",
} as const;

/** Response for media the caller is currently allowed to see. */
export function protectedMediaResponse(body: Uint8Array, mimeType: ImageMimeType): Response {
  return new Response(body as BodyInit, {
    status: 200,
    headers: { ...PROTECTED_MEDIA_HEADERS, "Content-Type": mimeType, "Content-Length": String(body.length) },
  });
}

/**
 * Response when the caller may not see the media, or it does not exist. The
 * same 404 for both, so object keys and existence cannot be probed.
 */
export function mediaNotFoundResponse(): Response {
  return new Response(null, { status: 404, headers: PROTECTED_MEDIA_HEADERS });
}
