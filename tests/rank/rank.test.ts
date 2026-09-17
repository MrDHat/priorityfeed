import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS, rankPosts } from "../../src/rank/rank.js";
import type { PostJudgment } from "../../src/judge/ports.js";
import type { FeedItem } from "../../src/x/types.js";

function item(id: string, over: Partial<FeedItem> = {}): FeedItem {
  return {
    id, text: "", authorId: "222", authorUsername: "alice", authorName: "Alice",
    createdAt: "", likeCount: 0, retweetCount: 0, replyCount: 0, quoteCount: 0,
    quotedTweetCount: 0, isReplyToMe: false, isRetweet: false, hasLinks: false,
    mentionsMe: false, ...over,
  };
}

describe("rankPosts", () => {
  it("normalizes urgency by max level and combines with reply + signals", () => {
    const items = [item("high", { mentionsMe: true }), item("low")];
    const judgments: PostJudgment[] = [
      { id: "high", urgency: 3, replyProb: 1 },
      { id: "low", urgency: 0, replyProb: 0 },
    ];
    const ranked = rankPosts(items, judgments);
    expect(ranked[0]!.id).toBe("high");
    expect(ranked[1]!.id).toBe("low");
    expect(ranked[0]!.priority).toBeGreaterThan(ranked[1]!.priority);

    // high: w.urgency*(3/3) + w.reply*1 + w.mention*1 = 0.5 + 0.3 + 0.2 = 1.0
    expect(ranked[0]!.priority).toBeCloseTo(1.0, 5);
    // low: 0.5*0 + 0.3*0 + 0 = 0
    expect(ranked[1]!.priority).toBeCloseTo(0.0, 5);
  });

  it("clamps priority to 0..1 and never lets a single term overrun", () => {
    const items = [item("x", { mentionsMe: true, isReplyToMe: true })];
    const ranked = rankPosts(items, [{ id: "x", urgency: 3, replyProb: 1 }]);
    expect(ranked[0]!.priority).toBeLessThanOrEqual(1);
  });

  it("builds a human reason from the active signals + urgency band", () => {
    const items = [item("r", { mentionsMe: true })];
    const ranked = rankPosts(items, [{ id: "r", urgency: 2.6, replyProb: 0.95 }]);
    expect(ranked[0]!.reason.toLowerCase()).toContain("mention");
    expect(ranked[0]!.reason.toLowerCase()).toContain("reply");
  });

  it("returns empty for empty input", () => {
    expect(rankPosts([], [])).toEqual([]);
  });
});