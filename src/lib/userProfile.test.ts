import { describe, expect, it } from "vitest";
import { isValidSlug, slugify } from "./userProfile";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Rishi Mohnot")).toBe("rishi-mohnot");
  });

  it("strips leading/trailing hyphens", () => {
    expect(slugify("  -Rishi!-  ")).toBe("rishi");
  });
});

describe("isValidSlug", () => {
  it("accepts a normal slug", () => {
    expect(isValidSlug("rishi")).toBe(true);
    expect(isValidSlug("rishi-mohnot")).toBe(true);
  });

  it("rejects slugs that are too short, or start/end with a hyphen", () => {
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("-rishi")).toBe(false);
    expect(isValidSlug("rishi-")).toBe(false);
  });

  it("rejects uppercase or invalid characters", () => {
    expect(isValidSlug("Rishi")).toBe(false);
    expect(isValidSlug("rishi_mohnot")).toBe(false);
  });
});
