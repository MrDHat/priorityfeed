import { describe, expect, it } from "vitest";
import { buildPostState, URGENCY_LEVELS } from "../../src/judge/prompts.js";
import type { FeedItem } from "../../src/x/types.js";

const item: FeedItem = {
  id: "a",
  text: "deploy is broken, can you look?",
  authorId: "222",
  authorUsername: "alice",
  authorName: "Alice",
  createdAt: "2026-09-01T00:00:00Z",
  likeCount: 0, retweetCount: 0, replyCount: 1, quoteCount: 0, quotedTweetCount: 0,
  isReplyToMe: true, isRetweet: false, hasLinks: false, mentionsMe: true,
};

describe("buildPostState", () => {
  it("sends the semantic facts the model needs, omitting nothing used downstream", () => {
    const state = buildPostState(item);
    expect(state.text).toBe("deploy is broken, can you look?");
    expect(state.author).toBe("@alice");
    expect(state.reply_to_me).toBe(true);
    expect(state.mentions_me).toBe(true);
    expect(state.is_retweet).toBe(false);
    expect(state.has_links).toBe(false);
    expect(state.replies).toBe(1);
    expect(state.likes).toBe(0);
    expect(state.id).toBe("a");
  });

  it("defines qualitative, ordered urgency levels", () => {
    expect(URGENCY_LEVELS).toHaveLength(4);
    expect(URGENCY_LEVELS[0]!).toMatch(/skip|noise|ignore/i);
    expect(URGENCY_LEVELS[3]!).toMatch(/read now|asap|urgent/i);
  });
});