import { describe, expect, it } from "vitest";
import { normalizePosts } from "../../src/x/normalize.js";
import type { RawPost, RawUser } from "../../src/x/types.js";

const me = { id: "111", username: "bob", name: "Bob" };

function post(p: Partial<RawPost>): RawPost {
  return { id: "1", text: "hello", created_at: "2026-09-01T00:00:00Z", ...p };
}

describe("normalizePosts", () => {
  const users: RawUser[] = [
    { id: "222", username: "alice", name: "Alice" },
    { id: "111", username: "bob", name: "Bob" },
  ];

  it("maps authors, defaults metrics, detects reply-to-me", () => {
    const items = normalizePosts(
      [post({ id: "a", author_id: "222", in_reply_to_user_id: "111" })],
      users,
      me,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "a",
      authorUsername: "alice",
      authorName: "Alice",
      isReplyToMe: true,
      isRetweet: false,
      likeCount: 0,
      retweetCount: 0,
    });
  });

  it("detects retweets, links, and mention-by-username in text", () => {
    const items = normalizePosts(
      [
        post({
          id: "r",
          referenced_tweets: [{ id: "9", type: "retweeted" }],
          entities: { urls: [{ url: "https://x.dev" }] },
          text: "check this out @bob now",
          public_metrics: { like_count: 4, quote_count: 2 },
        }),
      ],
      users,
      me,
    );
    expect(items[0]).toMatchObject({
      isRetweet: true,
      hasLinks: true,
      mentionsMe: true,
      likeCount: 4,
      quoteCount: 2,
    });
  });

  it("drops posts without author expansion (skips unknown authors gracefully)", () => {
    const items = normalizePosts([post({ id: "x", author_id: "999" })], users, me);
    expect(items).toEqual([]);
  });

  it("does not treat reply-to-an-unknown-id as reply-to-me", () => {
    const items = normalizePosts([post({ id: "y", in_reply_to_user_id: "000" })], users, me);
    expect(items[0]!.isReplyToMe).toBe(false);
  });

  it("does not flag a self-mention as mentionsMe", () => {
    const items = normalizePosts([post({ text: "my handle is @bob" })], users, me);
    expect(items[0]!.mentionsMe).toBe(false);
  });

  it("trusts the structured mentions entity over ambiguous text", () => {
    const mentioned = normalizePosts(
      [post({ entities: { mentions: [{ username: "BOB" }] } })],
      users,
      me,
    );
    expect(mentioned[0]!.mentionsMe).toBe(true);
    const onlyOther = normalizePosts(
      [post({ text: "check this out @bob", entities: { mentions: [{ username: "carol" }] } })],
      users,
      me,
    );
    expect(onlyOther[0]!.mentionsMe).toBe(false);
  });

  it("rejects identity statements and partial-handle matches in plain text", () => {
    const items = normalizePosts(
      [
        post({ id: "i1", text: "that's @bob, my personal account" }),
        post({ id: "i2", text: "bobbing about with @bobby today" }),
        post({ id: "i3", text: "@bob check this out" }),
      ],
      users,
      me,
    );
    expect(items[0]!.mentionsMe).toBe(false);
    expect(items[1]!.mentionsMe).toBe(false);
    expect(items[2]!.mentionsMe).toBe(true);
  });
});