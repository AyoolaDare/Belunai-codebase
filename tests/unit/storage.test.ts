// BEL-0204: registered object keys, upload inspection and no-store delivery.
import { randomUUID } from "node:crypto";
import sharp, { type Sharp } from "sharp";
import { describe, expect, it } from "vitest";
import {
  BUCKETS,
  MAX_IMAGE_BYTES,
  MAX_SIGNED_URL_SECONDS,
  isBucketId,
  objectKey,
  parseObjectKey,
} from "@/lib/storage/buckets";
import { PROTECTED_MEDIA_HEADERS, mediaNotFoundResponse, protectedMediaResponse } from "@/lib/storage/delivery";
import { inspectImage, sniffImageType } from "@/lib/storage/inspect";

const id = () => randomUUID();

function solid(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } } });
}

describe("bucket registry", () => {
  it("registers exactly the six private buckets from the schema", () => {
    expect(Object.keys(BUCKETS).sort()).toEqual([
      "community-assets",
      "moderation-evidence",
      "organisation-assets",
      "post-images",
      "profile-assets",
      "verification-evidence",
    ]);
    expect(isBucketId("profile-assets")).toBe(true);
    expect(isBucketId("public")).toBe(false);
    expect(isBucketId("__proto__")).toBe(false);
  });

  it("builds keys in each bucket's registered folder and parses them back", () => {
    const [user, org, community, post, request, report, asset] = [id(), id(), id(), id(), id(), id(), id()];
    const cases = [
      ["profile-assets", { userId: user }, `profiles/${user}/${asset}.jpg`],
      ["organisation-assets", { organisationId: org }, `organisations/${org}/${asset}.jpg`],
      ["community-assets", { communityId: community }, `communities/${community}/${asset}.jpg`],
      ["post-images", { postId: post }, `posts/${post}/${asset}.jpg`],
      [
        "verification-evidence",
        { organisationId: org, requestId: request },
        `organisations/${org}/requests/${request}/${asset}.jpg`,
      ],
      ["moderation-evidence", { reportId: report }, `reports/${report}/${asset}.jpg`],
    ] as const;
    for (const [bucket, scope, expected] of cases) {
      const key = objectKey(bucket, scope, asset, "image/jpeg");
      expect(key, bucket).toBe(expected);
      expect(parseObjectKey(bucket, key), bucket).toEqual({ scope, assetId: asset, extension: "jpg" });
    }
    expect(objectKey("profile-assets", { userId: user }, asset, "image/png")).toMatch(/\.png$/);
    expect(objectKey("profile-assets", { userId: user }, asset, "image/webp")).toMatch(/\.webp$/);
  });

  it("refuses to build keys from anything but lowercase UUIDs and allowed types", () => {
    const user = id();
    expect(() => objectKey("profile-assets", { userId: "../other" }, id(), "image/jpeg")).toThrow();
    expect(() => objectKey("profile-assets", { userId: user.toUpperCase() }, id(), "image/jpeg")).toThrow();
    expect(() => objectKey("profile-assets", { userId: user }, "avatar", "image/jpeg")).toThrow();
    // @ts-expect-error -- only registered image types
    expect(() => objectKey("profile-assets", { userId: user }, id(), "image/svg+xml")).toThrow();
  });

  it("rejects unregistered, guessed or crafted keys", () => {
    const [user, other, asset] = [id(), id(), id()];
    for (const key of [
      `profiles/${user}/${asset}.svg`,
      `profiles/${user}/${asset}.JPG`,
      `profiles/${user}/${asset}.jpeg`,
      `profiles/${user}/../${other}/${asset}.jpg`,
      `profiles/${user}/sub/${asset}.jpg`,
      `/profiles/${user}/${asset}.jpg`,
      `profiles/${user}/${asset}.jpg/`,
      `profiles/${user.toUpperCase()}/${asset}.jpg`,
      `posts/${user}/${asset}.jpg`,
      `profiles/${user}/${asset}.jpg\n`,
      `profiles/${user}/avatar.jpg`,
    ]) {
      expect(parseObjectKey("profile-assets", key), key).toBeNull();
    }
    // A key for one bucket is not valid in another.
    expect(parseObjectKey("organisation-assets", `profiles/${user}/${asset}.jpg`)).toBeNull();
    expect(parseObjectKey("organisation-assets", `organisations/${user}/requests/${other}/${asset}.jpg`)).toBeNull();
  });

  it("caps signed URLs at 60 seconds", () => {
    expect(MAX_SIGNED_URL_SECONDS).toBe(60);
  });
});

describe("upload inspection", () => {
  it("identifies formats by signature, not by name or declared type", async () => {
    expect(sniffImageType(await solid(2, 2).jpeg().toBuffer())).toBe("image/jpeg");
    expect(sniffImageType(await solid(2, 2).png().toBuffer())).toBe("image/png");
    expect(sniffImageType(await solid(2, 2).webp().toBuffer())).toBe("image/webp");
    expect(sniffImageType(await solid(2, 2).gif().toBuffer())).toBeNull();
    expect(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffImageType(Buffer.from("%PDF-1.7"))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });

  it("accepts still JPEG, PNG and WebP and reports inspected facts", async () => {
    for (const [encode, mimeType] of [
      [(s: Sharp) => s.jpeg(), "image/jpeg"],
      [(s: Sharp) => s.png(), "image/png"],
      [(s: Sharp) => s.webp(), "image/webp"],
    ] as const) {
      const result = await inspectImage(await encode(solid(64, 48)).toBuffer(), mimeType);
      expect(result, mimeType).toMatchObject({ ok: true, mimeType, width: 64, height: 48 });
      if (result.ok) {
        expect(sniffImageType(result.bytes)).toBe(mimeType);
        expect(result.byteSize).toBe(result.bytes.length);
      }
    }
  });

  it("strips EXIF and GPS location and applies orientation", async () => {
    const input = await solid(40, 20)
      .jpeg()
      .withMetadata({ orientation: 6 })
      .withExif({
        IFD0: { Make: "PhoneMaker", Model: "Camera 1" },
        IFD3: { GPSLatitudeRef: "N", GPSLatitude: "51/1 30/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "0/1 7/1 0/1" },
      })
      .toBuffer();
    const before = await sharp(input).metadata();
    expect(before.exif).toBeDefined();
    expect(before.exif?.includes(Buffer.from("PhoneMaker"))).toBe(true);
    expect(before.orientation).toBe(6);

    const result = await inspectImage(input, "image/jpeg");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = await sharp(result.bytes).metadata();
    expect(after.exif).toBeUndefined();
    expect(after.xmp).toBeUndefined();
    expect(after.orientation).toBeUndefined();
    expect(result.bytes.includes(Buffer.from("PhoneMaker"))).toBe(false);
    // Orientation 6 rotates 90°, so the stored image is upright: 20 x 40.
    expect([result.width, result.height]).toEqual([20, 40]);
  });

  it("rejects other formats, disguised files and declared-type mismatches", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
    expect(await inspectImage(svg)).toEqual({ ok: false, reason: "unsupported_type" });
    expect(await inspectImage(await solid(4, 4).gif().toBuffer())).toEqual({ ok: false, reason: "unsupported_type" });
    expect(await inspectImage(await solid(4, 4).tiff().toBuffer())).toEqual({ ok: false, reason: "unsupported_type" });
    expect(await inspectImage(Buffer.from("%PDF-1.7\n..."))).toEqual({ ok: false, reason: "unsupported_type" });
    const png = await solid(4, 4).png().toBuffer();
    expect(await inspectImage(png, "image/jpeg")).toEqual({ ok: false, reason: "type_mismatch" });
  });

  it("rejects animation, corrupt and truncated files", async () => {
    const frame = (background: string) =>
      sharp({ create: { width: 8, height: 8, channels: 3, background } }).png().toBuffer();
    const twoFrames = await sharp([await frame("#fff"), await frame("#000")], { join: { animated: true } })
      .webp({ loop: 0 })
      .toBuffer();
    expect((await sharp(twoFrames, { animated: true }).metadata()).pages).toBe(2);
    expect(await inspectImage(twoFrames)).toEqual({ ok: false, reason: "animated" });
    // A single-frame WebP saved with animation flags is still a still image.
    const oneFrame = await sharp(await frame("#fff"), { animated: true }).webp({ loop: 0 }).toBuffer();
    expect((await inspectImage(oneFrame)).ok).toBe(true);

    const jpeg = await solid(64, 64).jpeg().toBuffer();
    expect(await inspectImage(jpeg.subarray(0, 40))).toEqual({ ok: false, reason: "undecodable" });
    const corrupt = Buffer.concat([jpeg.subarray(0, 3), Buffer.alloc(200, 0x41)]);
    expect(await inspectImage(corrupt)).toEqual({ ok: false, reason: "undecodable" });
  });

  it("enforces the size and 20-megapixel limits", async () => {
    expect(await inspectImage(new Uint8Array())).toEqual({ ok: false, reason: "empty" });
    expect(await inspectImage(new Uint8Array(MAX_IMAGE_BYTES + 1))).toEqual({ ok: false, reason: "too_large" });
    // 5000 x 4001 = 20,005,000 pixels: a small file that decodes too large.
    const bomb = await sharp({ create: { width: 5000, height: 4001, channels: 3, background: "#000" } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    expect(bomb.length).toBeLessThan(MAX_IMAGE_BYTES);
    expect(await inspectImage(bomb)).toEqual({ ok: false, reason: "too_many_pixels" });
  });
});

describe("no-store delivery boundary", () => {
  it("serves inspected media privately and never cached", async () => {
    const body = new Uint8Array([1, 2, 3]);
    const response = protectedMediaResponse(body, "image/png");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("cdn-cache-control")).toBe("no-store");
    expect(response.headers.get("vercel-cdn-cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-security-policy")).toContain("sandbox");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(body);
  });

  it("answers denied and missing media identically", async () => {
    const response = mediaNotFoundResponse();
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    for (const [name, value] of Object.entries(PROTECTED_MEDIA_HEADERS)) {
      expect(response.headers.get(name)).toBe(value);
    }
  });
});
