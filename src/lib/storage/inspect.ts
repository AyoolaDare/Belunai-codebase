// Upload inspection (backend_schema.md section 9, agents.md section 8).
// "Ready" means inspected: the bytes are a single still JPEG/PNG/WebP within
// the section 2.1 limits, decoded and re-encoded so EXIF, GPS and other
// metadata are gone. Only the returned bytes may be stored as a ready object.
import "server-only";
import sharp, { type Metadata, type OutputInfo } from "sharp";
import { IMAGE_MIME_TYPES, type ImageExtension, type ImageMimeType, MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS } from "./buckets";

export type InspectionFailure =
  | "empty"
  | "too_large"
  | "unsupported_type"
  | "type_mismatch"
  | "undecodable"
  | "animated"
  | "too_many_pixels";

export type InspectionResult =
  | {
      ok: true;
      bytes: Buffer;
      mimeType: ImageMimeType;
      extension: ImageExtension;
      width: number;
      height: number;
      byteSize: number;
    }
  | { ok: false; reason: InspectionFailure };

const SHARP_FORMAT: Record<ImageMimeType, "jpeg" | "png" | "webp"> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Identifies JPEG, PNG or WebP from file signature bytes; anything else is null. */
export function sniffImageType(bytes: Uint8Array): ImageMimeType | null {
  const at = (offset: number, ...values: number[]) => values.every((v, i) => bytes[offset + i] === v);
  if (bytes.length >= 3 && at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (bytes.length >= 8 && at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  // "RIFF" <size> "WEBP"
  if (bytes.length >= 12 && at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  return null;
}

const fail = (reason: InspectionFailure): InspectionResult => ({ ok: false, reason });

/**
 * Inspects untrusted upload bytes. `declaredType` is the type reserved for the
 * object key; a different actual type is rejected rather than renamed.
 */
export async function inspectImage(input: Uint8Array, declaredType?: ImageMimeType): Promise<InspectionResult> {
  if (input.length === 0) return fail("empty");
  if (input.length > MAX_IMAGE_BYTES) return fail("too_large");

  // Decide the format from the bytes before any decoder sees them, so SVG,
  // HEIF, TIFF, GIF and other formats libvips understands are never parsed.
  const mimeType = sniffImageType(input);
  if (!mimeType) return fail("unsupported_type");
  if (declaredType && declaredType !== mimeType) return fail("type_mismatch");
  const format = SHARP_FORMAT[mimeType];

  const options = { failOn: "error", limitInputPixels: MAX_IMAGE_PIXELS, animated: true } as const;
  let metadata: Metadata;
  try {
    metadata = await sharp(input, options).metadata();
  } catch (error) {
    return fail(/pixel limit/i.test(String(error)) ? "too_many_pixels" : "undecodable");
  }
  if (metadata.format !== format) return fail("unsupported_type");
  if ((metadata.pages ?? 1) > 1) return fail("animated");
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width <= 0 || height <= 0) return fail("undecodable");
  if (width * height > MAX_IMAGE_PIXELS) return fail("too_many_pixels");

  let output: { data: Buffer; info: OutputInfo };
  try {
    // rotate() applies the EXIF orientation; sharp writes no metadata unless
    // asked (no withMetadata/keepExif), so EXIF, GPS, XMP and comments go.
    const pipeline = sharp(input, { ...options, animated: false }).rotate();
    const encoded =
      format === "jpeg"
        ? pipeline.jpeg({ quality: 85, mozjpeg: true })
        : format === "png"
          ? pipeline.png({ compressionLevel: 9 })
          : pipeline.webp({ quality: 85 });
    output = await encoded.toBuffer({ resolveWithObject: true });
  } catch {
    return fail("undecodable");
  }
  if (output.data.length > MAX_IMAGE_BYTES) return fail("too_large");

  return {
    ok: true,
    bytes: output.data,
    mimeType,
    extension: IMAGE_MIME_TYPES[mimeType],
    width: output.info.width,
    height: output.info.height,
    byteSize: output.data.length,
  };
}
