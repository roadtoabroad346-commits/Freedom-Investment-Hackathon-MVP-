import { describe, it, expect } from "vitest";
import {
  normalizeHandle,
  handleEmail,
  handleFromEmail,
  validPassword,
  validRecovery,
} from "../src/lib/handle-auth";
describe("No-email identity contract", () => {
  it("normalizes handles into a reserved, non-deliverable identity namespace", () => {
    expect(normalizeHandle(" Investor_2026 ")).toBe("investor_2026");
    expect(handleEmail("Investor_2026")).toBe(
      "mirrorx-handle-investor_2026@accounts.invalid",
    );
    expect(handleFromEmail(handleEmail("Investor_2026"))).toBe("investor_2026");
    expect(handleFromEmail("person@example.com")).toBeNull();
  });
  it("rejects supplied real email, punctuation, unicode lookalikes and invalid length", () => {
    for (const bad of [
      "a",
      "ab",
      "2abc",
      "foo@example.com",
      "foo.bar",
      "fоо",
      "a".repeat(31),
      null,
      {},
      "foo/bar",
      "foo\nbar",
    ])
      expect(() => normalizeHandle(bad)).toThrow();
  });
  it("accepts passphrases without trimming and bounds new passwords", () => {
    expect(validPassword("a phrase with spaces")).toBe(true);
    expect(validPassword("x".repeat(11))).toBe(false);
    expect(validPassword("x".repeat(129))).toBe(false);
    expect(validPassword(null)).toBe(false);
  });
  it("requires a full 256-bit recovery code", () => {
    expect(validRecovery("mxr_" + "a".repeat(64))).toBe(true);
    expect(validRecovery("a".repeat(64))).toBe(false);
    expect(validRecovery("mxr_" + "a".repeat(63))).toBe(false);
    expect(validRecovery("mxr_" + "g".repeat(64))).toBe(false);
  });
});
