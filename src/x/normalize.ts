import type { FeedItem, Me, RawPost, RawUser } from "./types.js";

export function normalizePosts(
  posts: RawPost[],
  users: RawUser[],
  me: Me,
): FeedItem[] {
  const byId = new Map(users.map((u) => [u.id, u]));
  const out: FeedItem[] = [];
  for (const p of posts) {
    if (p.author_id && !byId.get(p.author_id)) continue;
    const user = p.author_id ? byId.get(p.author_id) : undefined;
    const text = p.text ?? "";
    const referenced = p.referenced_tweets ?? [];
    const metrics = p.public_metrics ?? {};
    out.push({
      id: p.id,
      text,
      authorId: p.author_id ?? "",
      authorUsername: user?.username ?? "",
      authorName: user?.name ?? user?.username ?? "",
      createdAt: p.created_at ?? "",
      likeCount: metrics.like_count ?? 0,
      retweetCount: metrics.retweet_count ?? 0,
      replyCount: metrics.reply_count ?? 0,
      quoteCount: metrics.quote_count ?? 0,
      quotedTweetCount: referenced.filter((r) => r.type === "quoted").length,
      isReplyToMe: p.in_reply_to_user_id === me.id,
      isRetweet: referenced.some((r) => r.type === "retweeted"),
      hasLinks: (p.entities?.urls?.length ?? 0) > 0 || /\bhttps?:\/\//i.test(text),
      mentionsMe: isMentioned(p, text, me.username),
    });
  }
  return out;
}

function isMentioned(p: RawPost, text: string, username: string): boolean {
  if (!username) return false;
  const mentions = p.entities?.mentions;
  if (mentions && mentions.length > 0) {
    const target = username.toLowerCase();
    return mentions.some((m) => m.username?.toLowerCase() === target);
  }
  return mentionsUsernameInText(text, username);
}

function mentionsUsernameInText(text: string, username: string): boolean {
  const re = new RegExp(`(^|[^\\w@])@${escapeRegExp(username)}\\b`, "gi");
  for (const m of text.matchAll(re)) {
    const at = (m.index ?? 0) + (m[1]?.length ?? 0);
    const preceding = text.slice(0, at).trimEnd();
    if (!isIdentityStatement(preceding)) return true;
  }
  return false;
}

function isIdentityStatement(preceding: string): boolean {
  return /\b(?:is|am|are|was|were|be|been|being|'m|'re|'s)\s*$/i.test(preceding);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}