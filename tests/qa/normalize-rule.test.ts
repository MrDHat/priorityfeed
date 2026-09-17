import { describe, expect, it } from "vitest";
import { buildPostState } from "../../src/judge/prompts.js";
import { normalizePosts } from "../../src/x/normalize.js";
import type { RawPost, RawUser } from "../../src/x/types.js";

const me = { id: "111", username: "bob", name: "Bob" };
const users: RawUser[] = [
  { id: "222", username: "alice", name: "Alice" },
  { id: "111", username: "bob", name: "Bob" },
];

function post(p: Partial<RawPost>): RawPost {
  return { id: "1", text: "hello", created_at: "2026-09-01T00:00:00Z", ...p };
}

describe("qa: author drop rule and mentionsMe equivalence (plan Task 2)", () => {
  it("keeps posts whose author_id is absent (plan Task 2 given tests assert items[0] survives)", () => {
    const items = normalizePosts([post({ id: "y", in_reply_to_user_id: "000" })], users, me);
    expect(items[0]!).toBeDefined();
    expect(items[0]!.authorId).toBe("");
  });

  it("drops posts whose author_id is present but has no expansion", () => {
    const items = normalizePosts([post({ id: "x", author_id: "999" })], users, me);
    expect(items).toEqual([]);
  });

  it("resolves mentionsMe identically via entities and via text on a word boundary", () => {
    const viaEntity = normalizePosts(
      [post({ id: "e", entities: { mentions: [{ username: "BOB" }] } })],
      users,
      me,
    );
    const viaText = normalizePosts([post({ id: "t", text: "check this out @bob now" })], users, me);
    const selfRef = normalizePosts([post({ id: "s", text: "my handle is @bob" })], users, me);

    expect(buildPostState(viaEntity[0]!).mentions_me).toBe(true);
    expect(buildPostState(viaText[0]!).mentions_me).toBe(true);
    expect(buildPostState(selfRef[0]!).mentions_me).toBe(false);
  });
});