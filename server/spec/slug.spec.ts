import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "../src/lib/slug";

describe("slugify", () => {
  it("lowercases and hyphenates a normal product name", () => {
    expect(slugify("Wireless Noise-Cancelling Headphones")).toBe("wireless-noise-cancelling-headphones");
  });

  it("collapses runs of punctuation and whitespace into a single hyphen", () => {
    expect(slugify("Cable  ---  USB-C   to   HDMI")).toBe("cable-usb-c-to-hdmi");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  !!! Router !!!  ")).toBe("router");
  });

  it("drops characters that have no place in a URL", () => {
    expect(slugify("Café & Crème (2-pack) 50% off")).toBe("caf-cr-me-2-pack-50-off");
  });

  it("returns an empty string when nothing sluggable is left", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("uniqueSlug", () => {
  it("keeps the base slug when it's free", async () => {
    expect(await uniqueSlug("Gaming Mouse", async () => false)).toBe("gaming-mouse");
  });

  it("falls back to 'item' when the name slugifies to nothing", async () => {
    expect(await uniqueSlug("???", async () => false)).toBe("item");
  });

  it("appends -2 when the base is taken", async () => {
    const taken = new Set(["gaming-mouse"]);
    expect(await uniqueSlug("Gaming Mouse", async (s) => taken.has(s))).toBe("gaming-mouse-2");
  });

  it("keeps counting past the first collision", async () => {
    const taken = new Set(["gaming-mouse", "gaming-mouse-2", "gaming-mouse-3"]);
    expect(await uniqueSlug("Gaming Mouse", async (s) => taken.has(s))).toBe("gaming-mouse-4");
  });
});
