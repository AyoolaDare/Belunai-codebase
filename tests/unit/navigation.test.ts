import { describe, expect, it } from "vitest";
import { appNavItems, isActivePath } from "@/lib/navigation";

describe("isActivePath", () => {
  it("matches the exact route", () => {
    expect(isActivePath("/messages", "/messages")).toBe(true);
  });

  it("matches nested routes", () => {
    expect(isActivePath("/messages/abc", "/messages")).toBe(true);
  });

  it("does not match a sibling route that shares a prefix", () => {
    expect(isActivePath("/homepage", "/home")).toBe(false);
  });

  it("does not match unrelated routes", () => {
    expect(isActivePath("/search", "/home")).toBe(false);
  });
});

describe("appNavItems", () => {
  it("has unique destinations", () => {
    const hrefs = appNavItems.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
