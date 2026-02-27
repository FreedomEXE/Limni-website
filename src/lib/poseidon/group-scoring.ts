/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: group-scoring.ts
 *
 * Description:
 * Batch scoring engine for group member contributions. Runs periodically
 * (via Nereus schedule), evaluates unscored messages using Haiku, and
 * updates per-member composite scores with time-decay weighting.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import Anthropic from "@anthropic-ai/sdk";
import { query } from "@/lib/db";
import { config } from "@/lib/poseidon/config";
import {
  getUnscoredMessages,
  markMessagesScored,
  getGroupLeaderboard,
  type GroupMember,
} from "@/lib/poseidon/group-memory";

// ─── Types ───────────────────────────────────

type ScoreBatch = {
  userId: number;
  messageIds: number[];
  texts: string[];
};

type HaikuScoreResult = {
  insight: number;
  helpfulness: number;
  signal: number;
};

// ─── Constants ───────────────────────────────

const SCORING_SYSTEM_PROMPT = `You are a contribution quality scorer for a trading community. Rate messages on a 0-10 scale.

SCORING DIMENSIONS:
- insight: Original analysis, non-obvious market observations, correct reasoning about price/structure/fundamentals. Higher if the person demonstrates genuine market understanding.
- helpfulness: Answering others' questions, sharing useful resources or data, explaining concepts clearly.
- signal: Substantive content vs noise. 10 = pure alpha/analysis, 0 = spam/memes/one-liners with no value.

RULES:
- Be strict. Average traders get 4-5. Only genuinely sharp analysis gets 7+.
- One-liners like "bullish" or "wagmi" score 0-1 on all dimensions.
- Questions are neutral (3-4) unless they're insightful questions that advance the discussion.
- Wrong analysis still scores decently on insight if the reasoning was sound.
- Return ONLY valid JSON. No explanation.`;

const WEIGHT_INSIGHT = 0.4;
const WEIGHT_ENGAGEMENT = 0.2;
const WEIGHT_HELPFULNESS = 0.2;
const WEIGHT_SIGNAL = 0.2;
const DECAY_FACTOR = 0.95; // Applied per scoring cycle — recent scores matter more

// ─── Batch Scoring ───────────────────────────

function groupMessagesByUser(
  messages: Array<{ id: number; userId: number; text: string }>,
): ScoreBatch[] {
  const byUser = new Map<number, ScoreBatch>();

  for (const msg of messages) {
    const existing = byUser.get(msg.userId);
    if (existing) {
      existing.messageIds.push(msg.id);
      existing.texts.push(msg.text);
    } else {
      byUser.set(msg.userId, {
        userId: msg.userId,
        messageIds: [msg.id],
        texts: [msg.text],
      });
    }
  }

  return Array.from(byUser.values());
}

async function scoreUserBatch(batch: ScoreBatch): Promise<HaikuScoreResult> {
  const client = new Anthropic({ apiKey: config.anthropic.apiKey });

  const messageBlock = batch.texts
    .slice(0, 20) // Cap at 20 messages per batch to limit tokens
    .map((text, i) => `${i + 1}. ${text}`)
    .join("\n");

  try {
    const response = await client.messages.create({
      model: config.models.nereus,
      max_tokens: 100,
      system: SCORING_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Rate these messages from a single community member:\n\n${messageBlock}\n\nReturn JSON: { "insight": N, "helpfulness": N, "signal": N }`,
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const parsed = JSON.parse(text) as Record<string, unknown>;
    return {
      insight: clampScore(parsed.insight),
      helpfulness: clampScore(parsed.helpfulness),
      signal: clampScore(parsed.signal),
    };
  } catch (error) {
    console.error(`[group-scoring] Failed to score user ${batch.userId}:`, error);
    return { insight: 0, helpfulness: 0, signal: 0 };
  }
}

function clampScore(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(10, num));
}

function computeComposite(scores: HaikuScoreResult, engagement: number): number {
  return (
    scores.insight * WEIGHT_INSIGHT +
    engagement * WEIGHT_ENGAGEMENT +
    scores.helpfulness * WEIGHT_HELPFULNESS +
    scores.signal * WEIGHT_SIGNAL
  );
}

/**
 * Run batch scoring for a specific group. Called on a schedule.
 * 1. Pulls unscored messages
 * 2. Groups by user
 * 3. Scores each user's batch via Haiku
 * 4. Updates composite scores with decay
 */
export async function runGroupScoring(groupId: number): Promise<{ usersScored: number; messagesProcessed: number }> {
  const unscored = await getUnscoredMessages(groupId);
  if (!unscored.length) {
    return { usersScored: 0, messagesProcessed: 0 };
  }

  const batches = groupMessagesByUser(unscored);
  let messagesProcessed = 0;

  for (const batch of batches) {
    const scores = await scoreUserBatch(batch);

    // Engagement is derived from message count relative to group activity
    const engagementRaw = Math.min(10, batch.texts.length * 2);

    const composite = computeComposite(scores, engagementRaw);

    // Mark messages as scored
    await markMessagesScored(batch.messageIds, {
      insight: scores.insight,
      helpfulness: scores.helpfulness,
      signal: scores.signal,
      engagement: engagementRaw,
      composite,
    });

    // Update member scores with decay (blend old + new)
    await query(
      `UPDATE poseidon_group_members SET
        insight_score = insight_score * $3 + $4 * (1 - $3),
        helpfulness_score = helpfulness_score * $3 + $5 * (1 - $3),
        signal_noise_score = signal_noise_score * $3 + $6 * (1 - $3),
        engagement_score = engagement_score * $3 + $7 * (1 - $3),
        composite_score = composite_score * $3 + $8 * (1 - $3)
       WHERE telegram_user_id = $1 AND group_id = $2`,
      [
        batch.userId,
        groupId,
        DECAY_FACTOR,
        scores.insight,
        scores.helpfulness,
        scores.signal,
        engagementRaw,
        composite,
      ],
    );

    messagesProcessed += batch.messageIds.length;
  }

  console.log(
    `[group-scoring] Scored ${messagesProcessed} messages from ${batches.length} users in group ${groupId}`,
  );

  return { usersScored: batches.length, messagesProcessed };
}

// ─── Leaderboard ─────────────────────────────

/**
 * Format a leaderboard string for display in the group.
 */
export async function formatLeaderboard(groupId: number, limit = 10): Promise<string> {
  const members = await getGroupLeaderboard(groupId, limit);

  if (!members.length) {
    return "No scores yet — the leaderboard will populate as the community contributes.";
  }

  const medals = ["🥇", "🥈", "🥉"];
  const lines = members.map((m, i) => {
    const prefix = i < 3 ? medals[i] : `${i + 1}.`;
    const name = m.displayName || m.username || m.firstName || `User#${m.telegramUserId}`;
    const score = m.compositeScore.toFixed(1);
    return `${prefix} **${name}** — ${score} pts (${m.totalMessages} msgs)`;
  });

  return `📊 **Limni Leaderboard**\n\n${lines.join("\n")}`;
}

/**
 * Format a detailed score breakdown for a single member.
 */
export function formatMemberScore(member: GroupMember): string {
  const name = member.displayName || member.username || member.firstName || `User#${member.telegramUserId}`;
  return [
    `📋 **${name}** — Score Breakdown`,
    "",
    `Composite: **${member.compositeScore.toFixed(1)}**`,
    `Messages: ${member.totalMessages}`,
    `Role: ${member.role}`,
    `Last active: ${member.lastSeenUtc.toISOString().split("T")[0]}`,
  ].join("\n");
}
