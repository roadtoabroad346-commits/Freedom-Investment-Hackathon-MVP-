import { describe, it, expect } from "vitest";
import { mutationGuard, readSmallJson } from "../src/lib/api-security";
import { researchWriteSchema } from "../src/lib/research-schema";
const request = (headers: Record<string, string>) =>
  new Request("https://mirror.example/api/research", {
    method: "POST",
    headers,
    body: "{}",
  });
describe("Private write boundary", () => {
  it("rejects cross-origin and missing Origin", () => {
    expect(
      mutationGuard(
        request({
          "content-type": "application/json",
          origin: "https://attacker.example",
        }),
      )?.status,
    ).toBe(403);
    expect(
      mutationGuard(request({ "content-type": "application/json" }))?.status,
    ).toBe(403);
  });
  it("rejects form-based CSRF", () =>
    expect(
      mutationGuard(
        request({
          origin: "https://mirror.example",
          "content-type": "application/x-www-form-urlencoded",
        }),
      )?.status,
    ).toBe(415));
  it("accepts same-origin JSON", () =>
    expect(
      mutationGuard(
        request({
          origin: "https://mirror.example",
          "content-type": "application/json",
        }),
      ),
    ).toBeNull());
  it("rejects too-large body regardless of Content-Length", async () => {
    const r = new Request("https://mirror.example/api/research", {
      method: "POST",
      body: "x".repeat(21000),
    });
    await expect(readSmallJson(r)).rejects.toThrow("слишком большой");
  });
  it("does not accept a client-supplied owner", () =>
    expect(
      researchWriteSchema.safeParse({
        operation: "watch",
        ticker: "ADBE",
        user_id: "another-user",
      }).success,
    ).toBe(false));
  it("rejects invalid financial models and notes over 6000 chars", () => {
    expect(
      researchWriteSchema.safeParse({
        operation: "valuation",
        ticker: "ADBE",
        assumptions: {},
      }).success,
    ).toBe(false);
    expect(
      researchWriteSchema.safeParse({
        operation: "note",
        ticker: "ADBE",
        note: "x".repeat(6001),
      }).success,
    ).toBe(false);
  });
});
