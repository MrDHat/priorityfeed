import type { RankedPost } from "../rank/rank.js";

export function renderDashboard(posts: RankedPost[]): string {
  return posts.map(renderBlock).join("\n\n") + "\n";
}

function renderBlock(p: RankedPost): string {
  const pct = Math.round(p.priority * 100);
  const title = `[${pct}%] @${p.authorUsername}: ${firstLine(p.text)}`;
  const meta = [counts(p), relativeTime(p.createdAt), badges(p)].filter(Boolean).join(" · ");
  const lines = [title, `      ${meta}`];
  if (p.hasLinks) lines.push(`      https://x.com/_/status/${p.id}`);
  return lines.join("\n");
}

function firstLine(text: string): string {
  const first = text.split("\n")[0] ?? "";
  return first.trim();
}

function counts(p: RankedPost): string {
  const parts: string[] = [];
  if (p.replyCount > 0) parts.push(`⏱ ${p.replyCount} replies`);
  if (p.likeCount > 0) parts.push(`❤ ${p.likeCount}`);
  if (p.retweetCount > 0) parts.push(`🔁 ${p.retweetCount}`);
  return parts.join(" ");
}

function relativeTime(iso: string): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function badges(p: RankedPost): string {
  const parts: string[] = [];
  if (p.isReplyToMe && p.replyProb >= 0.6) parts.push("Reply now");
  if (p.mentionsMe) parts.push("Mentions you");
  if (p.isRetweet) parts.push("Retweet");
  if (p.hasLinks) parts.push("Link");
  return parts.join(" · ");
}