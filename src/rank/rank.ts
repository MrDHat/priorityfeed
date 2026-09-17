import type { PostJudgment } from "../judge/ports.js";
import { URGENCY_LEVELS } from "../judge/prompts.js";
import type { FeedItem } from "../x/types.js";

export interface RankWeights {
  urgency: number;
  reply: number;
  mention: number;
  replyTo: number;
}

export const DEFAULT_WEIGHTS: RankWeights = {
  urgency: 0.5,
  reply: 0.3,
  mention: 0.2,
  replyTo: 0.1,
};

export interface RankedPost extends FeedItem, PostJudgment {
  priority: number;
  reason: string;
}

const MAX_LEVEL = URGENCY_LEVELS.length - 1;

export function rankPosts(
  items: FeedItem[],
  judgments: PostJudgment[],
  weights: RankWeights = DEFAULT_WEIGHTS,
): RankedPost[] {
  const byId = new Map(judgments.map((j) => [j.id, j]));
  const ranked = items.map((item) => {
    const j = byId.get(item.id) ?? { id: item.id, urgency: 0, replyProb: 0 };
    const urgencyNorm = clamp01(j.urgency / MAX_LEVEL);
    const priority = clamp01(
      weights.urgency * urgencyNorm +
        weights.reply * j.replyProb +
        weights.mention * (item.mentionsMe ? 1 : 0) +
        weights.replyTo * (item.isReplyToMe ? 1 : 0),
    );
    return {
      ...item,
      ...j,
      priority,
      reason: buildReason(item, j.urgency, j.replyProb),
    };
  });
  return ranked.sort((a, b) => b.priority - a.priority);
}

function buildReason(item: FeedItem, urgency: number, replyProb: number): string {
  const parts: string[] = [];
  if (item.mentionsMe) parts.push("mentions you");
  if (item.isReplyToMe) parts.push("reply to you");
  if (urgency >= 2.5) parts.push("high urgency");
  else if (urgency >= 1.5) parts.push("read today");
  if (replyProb >= 0.6) parts.push("expects a reply");
  if (item.isRetweet) parts.push("retweet");
  return parts.length ? parts.join(", ") : "low priority";
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}