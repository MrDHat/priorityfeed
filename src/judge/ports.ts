import type { FeedItem } from "../x/types.js";

export interface PostJudgment {
  id: string;
  urgency: number;      // score position on the urgency scale
  replyProb: number;    // noul probability 0..1
}

export interface PostScorer {
  judge(posts: FeedItem[]): Promise<PostJudgment[]>;
}