import { describe, expect, it } from "vitest";
import { URGENCY_LEVELS } from "../../src/judge/prompts.js";
import { DEFAULT_WEIGHTS, rankPosts } from "../../src/rank/rank.js";
import type { FeedItem } from "../../src/x/types.js";

function item(id: string, over: Partial<FeedItem> = {}): FeedItem {
  return {
    id,
    text: "x",
    authorId: "222",
    authorUsername: "alice",
    authorName: "Alice",
    createdAt: "",
    likeCount: 0,
    retweetCount: 0,
    replyCount: 0,
    quoteCount: 0,
    quotedTweetCount: 0,
    isReplyToMe: false,
    isRetweet: false,
    hasLinks: false,
    mentionsMe: false,
    ...over,
  };
}

describe("qa: cross-module scale consistency (URGENCY_LEVELS vs rank denominator)", () => {
  it("URGENCY_LEVELS has length 4 so rank normalizes urgency by (length - 1)", () => {
    expect(URGENCY_LEVELS).toHaveLength(4);
    expect(URGENCY_LEVELS[3]!).toMatch(/read now|asap|urgent/i);

    const expected =
      DEFAULT_WEIGHTS.urgency * (3 / (URGENCY_LEVELS.length - 1)) + DEFAULT_WEIGHTS.reply * 1;
    const ranked = rankPosts([item("x")], [{ id: "x", urgency: 3, replyProb: 1 }]);
    expect(ranked[0]!.priority).toBeCloseTo(expected, 5);
  });

  it("clamps off-scale urgency and replyProb into the 0..1 unit interval", () => {
    const ranked = rankPosts([item("x")], [{ id: "x", urgency: 500, replyProb: -2 }]);
    expect(ranked[0]!.priority).toBeGreaterThanOrEqual(0);
    expect(ranked[0]!.priority).toBeLessThanOrEqual(1);

    const low = rankPosts([item("y")], [{ id: "y", urgency: 0, replyProb: 0 }]);
    expect(low[0]!.priority).toBe(0);
  });
});