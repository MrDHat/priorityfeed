import { describe, expect, it } from "vitest";
import { TypeSafeScorer } from "../../src/judge/scorer.js";
import type { PostJudgment } from "../../src/judge/ports.js";
import type { FeedItem } from "../../src/x/types.js";

const item: FeedItem = {
  id: "a", text: "x", authorId: "222", authorUsername: "alice", authorName: "Alice",
  createdAt: "", likeCount: 0, retweetCount: 0, replyCount: 0, quoteCount: 0,
  quotedTweetCount: 0, isReplyToMe: false, isRetweet: false, hasLinks: false,
  mentionsMe: false,
};

describe("TypeSafeScorer", () => {
  it("asks two typed questions per post and returns a judgment per post", async () => {
    let captured: unknown = null;
    const fake = {
      systemOne: async (req: unknown) => {
        captured = req;
        return {
          answers: {
            read_0: { type: "score", score: 2.4, confidence: 0.8 },
            reply_0: { type: "noul", noul: 0.9, confidence: 0.7 },
          },
        };
      },
    } as never;

    const scorer = new TypeSafeScorer(fake as never);
    const out: PostJudgment[] = await scorer.judge([item]);

    expect((captured as any).state.posts).toHaveLength(1);
    expect((captured as any).state.posts[0].id).toBe("a");
    expect((captured as any).questions.read_0.type).toBe("score");
    expect((captured as any).questions.reply_0.type).toBe("noul");
    expect(out).toEqual([
      { id: "a", urgency: 2.4, replyProb: 0.9 },
    ]);
  });
});