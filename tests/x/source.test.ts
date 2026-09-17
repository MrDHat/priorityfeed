import { describe, expect, it, vi } from "vitest";
import { XTimelineSource } from "../../src/x/source.js";

describe("XTimelineSource", () => {
  it("maps a mocked xdk response into feed items and me", async () => {
    const getMe = vi.fn().mockResolvedValue({
      data: { id: "111", username: "bob", name: "Bob" },
    });
    const getTimeline = vi.fn().mockResolvedValue({
      data: [
        {
          id: "a",
          text: "hi",
          authorId: "222",
          createdAt: "2026-09-01T00:00:00Z",
          referencedPosts: [{ id: "r1", type: "retweeted" }],
          publicMetrics: { likeCount: 7, replyCount: 1, quoteCount: 2, repostCount: 3 },
          entities: { mentions: [{ username: "bob" }] },
        },
      ],
      includes: {
        users: [{ id: "222", username: "alice", name: "Alice" }],
      },
    });
    const fakeClient = { users: { getMe, getTimeline } } as never;

    const src = new XTimelineSource("my-token", fakeClient as never);
    const { me, items } = await src.fetchTimeline(10);

    expect(me).toEqual({ id: "111", username: "bob", name: "Bob" });
    expect(items).toHaveLength(1);
    expect(items[0]!).toMatchObject({
      id: "a",
      authorId: "222",
      authorUsername: "alice",
      authorName: "Alice",
      likeCount: 7,
      retweetCount: 3,
      replyCount: 1,
      quoteCount: 2,
      isRetweet: true,
      mentionsMe: true,
    });
    expect(getTimeline).toHaveBeenCalledWith(
      "111",
      expect.objectContaining({
        max_results: 10,
        "post.fields": expect.anything(),
        "user.fields": expect.anything(),
        expansions: expect.arrayContaining(["author_id", "in_reply_to_user_id"]),
      }),
    );
  });

  it("returns an empty timeline when data or includes is missing", async () => {
    const fakeClient = {
      users: {
        getMe: vi.fn().mockResolvedValue({ data: { id: "111", username: "bob", name: "Bob" } }),
        getTimeline: vi.fn().mockResolvedValue({ data: [] }),
      },
    } as never;

    const src = new XTimelineSource("my-token", fakeClient as never);
    const { me, items } = await src.fetchTimeline(10);

    expect(items).toEqual([]);
    expect(me.username).toBe("bob");
  });
});