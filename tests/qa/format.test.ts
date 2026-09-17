import { describe, expect, it } from "vitest";
import { formatRanking } from "../../src/output/format.js";
import type { RankedPost } from "../../src/rank/rank.js";

function mkRanked(id: string, over: Partial<RankedPost> = {}): RankedPost {
  return {
    id,
    text: "deploy is broken",
    authorId: "222",
    authorUsername: "alice",
    authorName: "Alice",
    createdAt: "2026-09-01T10:30:00Z",
    likeCount: 3,
    retweetCount: 1,
    replyCount: 2,
    quoteCount: 0,
    quotedTweetCount: 0,
    isReplyToMe: true,
    isRetweet: false,
    hasLinks: false,
    mentionsMe: true,
    urgency: 2.5,
    replyProb: 0.9,
    priority: 0.92,
    reason: "mentions you, expects a reply",
    ...over,
  };
}

describe("qa: dashboard honors the plan's format contract (Task 7)", () => {
  it("renders rank, author, percent and reason in the planned shape", () => {
    const out = formatRanking([mkRanked("a")], { now: new Date("2026-09-01T11:30:00Z") });
    expect(out).toContain("1. @alice");
    expect(out).toContain("92%");
    expect(out).toContain("deploy is broken");
    expect(out).toContain("mentions you, expects a reply");
  });

  it("truncates long text so the first line stays under 150 chars", () => {
    const out = formatRanking([mkRanked("a", { text: "x".repeat(300) })], { now: new Date() });
    const line = out.split("\n")[0]!;
    expect(line.length).toBeLessThan(150);
  });

  it("renders the per-row rank position", () => {
    const out = formatRanking([mkRanked("a"), mkRanked("b")]);
    expect(out).toContain("1.");
    expect(out).toContain("2.");
  });
});
