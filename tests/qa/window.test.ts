import { describe, expect, it } from "vitest";
import { WINDOW_MS } from "../../src/cache/score-cache.js";

describe("qa: cache staleness window (plan Task 6)", () => {
  it("re-scores judgments older than the plan's default maxAgeMs of 30 minutes", () => {
    expect(WINDOW_MS).toBe(30 * 60 * 1000);
  });
});