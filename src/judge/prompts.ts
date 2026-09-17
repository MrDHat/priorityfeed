import type { FeedItem } from "../x/types.js";

export const URGENCY_LEVELS = [
  "Skip-worthy: background noise, promotional, or unrelated to the user's work",
  "Skim later: mildly interesting, low stakes, no action expected",
  "Read today: relevant to the user, references to their work, or a question that can wait",
  "Read now: directly mentions or asks the user, time-sensitive, breaking, or needs a reply",
] as const;

export const REPLY_CRITERIA = {
  true: "The post asks a question of, or requests an action from, the user directly",
  false: "No reply or action is expected from the user",
} as const;

export interface PostState {
  id: string;
  author: string;
  text: string;
  created_at: string;
  likes: number;
  replies: number;
  retweets: number;
  quotes: number;
  reply_to_me: boolean;
  is_retweet: boolean;
  mentions_me: boolean;
  has_links: boolean;
}

export function buildPostState(p: FeedItem): PostState {
  return {
    id: p.id,
    author: `@${p.authorUsername}`,
    text: p.text,
    created_at: p.createdAt,
    likes: p.likeCount,
    replies: p.replyCount,
    retweets: p.retweetCount,
    quotes: p.quoteCount,
    reply_to_me: p.isReplyToMe,
    is_retweet: p.isRetweet,
    mentions_me: p.mentionsMe,
    has_links: p.hasLinks,
  };
}