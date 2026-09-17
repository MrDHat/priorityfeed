import { noul, score, type TypeSafeClient } from "@typesafe-ai/sdk";
import type { FeedItem } from "../x/types.js";
import type { PostJudgment, PostScorer } from "./ports.js";
import { buildPostState, REPLY_CRITERIA, URGENCY_LEVELS } from "./prompts.js";

export class TypeSafeScorer implements PostScorer {
  constructor(private client: TypeSafeClient) {}

  async judge(posts: FeedItem[]): Promise<PostJudgment[]> {
    if (posts.length === 0) return [];

    const questions: Record<string, ReturnType<typeof noul> | ReturnType<typeof score>> = {};
    posts.forEach((_, i) => {
      questions[`read_${i}`] = score(
        "How urgently should the user read this post right now?",
        URGENCY_LEVELS,
      );
      questions[`reply_${i}`] = noul(
        "Does this post require a reply or an action from the user?",
        REPLY_CRITERIA,
      );
    });

    const result = await this.client.systemOne({
      state: { posts: posts.map((p) => ({ ...buildPostState(p) })) },
      questions,
    });

    return posts.map((p, i) => {
      const read = result.answers[`read_${i}`] as { score: number };
      const reply = result.answers[`reply_${i}`] as { noul: number };
      return { id: p.id, urgency: read.score, replyProb: reply.noul };
    });
  }
}