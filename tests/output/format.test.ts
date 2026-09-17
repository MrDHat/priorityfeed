import { describe, expect, it } from "vitest";
import { renderDashboard } from "../../src/output/format.js";
import type { RankedPost } from "../../src/rank/rank.js";

function mkRanked(id: string, over: Partial<RankedPost> = {}): RankedPost {
  return {
    id,
    text: "hello world",
    authorId: "u1",
    authorUsername: "alice",
    authorName: "Alice",
    createdAt: new Date().toISOString(),
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

describe("renderDashboard", () => {
  it("renders a one-block-per-post dashboard with priority, meta, and separators", () => {
    const out = renderDashboard([
      mkRanked("1", {
        authorUsername: "alice",
        priority: 0.87,
        replyCount: 5,
        likeCount: 12,
        isReplyToMe: true,
        replyProb: 0.8,
      }),
      mkRanked("2", { authorUsername: "carol", priority: 0.4, isRetweet: true, hasLinks: true }),
    ]);
    expect(out).toContain("[87%] @alice");
    expect(out).toContain("[40%] @carol");
    expect(out).toContain("5 replies");
    expect(out).toContain("❤ 12");
    expect(out).toContain("Reply now");
    expect(out).toContain("Retweet");
    const blocks = out.trim().split("\n\n");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatch(/^\[87%\]/);
    expect(blocks[1]).toMatch(/^\[40%\]/);
  });

  it("ends with a single trailing newline", () => {
    const out = renderDashboard([mkRanked("1", { priority: 0.5 })]);
    expect(out).toMatch(/\n$/);
    expect(out).not.toMatch(/\n\n$/);
  });

  it("renders a permanent link line when the post has links", () => {
    const out = renderDashboard([mkRanked("abc", { hasLinks: true })]);
    expect(out).toContain("https://x.com/_/status/abc");
    expect(out).toContain("Link");
  });
});