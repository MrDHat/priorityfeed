import { describe, expect, it } from "vitest";
import { formatRanking } from "../../src/output/format.js";
import type { RankedPost } from "../../src/rank/rank.js";

function mkRanked(id: string, over: Partial<RankedPost> = {}): RankedPost {
  return {
    id,
    text: "hello world",
    authorId: "u1",
    authorUsername: "alice",
    authorName: "Alice",
    createdAt: "2026-09-01T10:30:00Z",
    likeCount: 0,
    retweetCount: 0,
    replyCount: 0,
    quoteCount: 0,
    quotedTweetCount: 0,
    isReplyToMe: false,
    isRetweet: false,
    hasLinks: false,
    mentionsMe: false,
    urgency: 0,
    replyProb: 0,
    priority: 0,
    reason: "low priority",
    ...over,
  };
}

describe("formatRanking", () => {
  it("renders rank, author, age, priority percent, reason, and text", () => {
    const out = formatRanking(
      [
        mkRanked("1", { priority: 0.87, reason: "mentions you, expects a reply" }),
        mkRanked("2", { authorUsername: "carol", priority: 0.4, reason: "low priority" }),
      ],
      { now: new Date("2026-09-01T12:30:00Z") },
    );
    expect(out).toContain("1. @alice · 2h · 87% · mentions you, expects a reply");
    expect(out).toContain("2. @carol · 2h · 40% · low priority");
    expect(out).toContain("hello world");
  });

  it("truncates long text to maxText", () => {
    const out = formatRanking([mkRanked("1", { text: "x".repeat(300) })]);
    expect(out).toContain("…");
    expect(out).not.toContain("x".repeat(101));
  });

  it("returns an empty string for no rows", () => {
    expect(formatRanking([])).toBe("");
  });
});
