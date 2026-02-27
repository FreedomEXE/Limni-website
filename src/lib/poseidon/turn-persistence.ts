/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: turn-persistence.ts
 *
 * Description:
 * Reliable persistence path for automatic conversation-turn memory writes.
 * Retries once, then falls back to missed_turns.json.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { appendMissedTurn } from "@/lib/poseidon/missed-turns";
import { appendConversationTurnToState } from "@/lib/poseidon/state";

const DEFAULT_RETRY_DELAY_MS = 500;

type PersistTurnOptions = {
  retryDelayMs?: number;
};

export async function persistTurnWithRetry(
  userMessage: string,
  assistantMessage: string,
  options: PersistTurnOptions = {},
): Promise<void> {
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await appendConversationTurnToState(userMessage, assistantMessage);
      return;
    } catch (error) {
      if (attempt === 1) {
        console.warn("[poseidon] state persist failed, retrying once...");
        if (retryDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
        continue;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[poseidon] state persist failed after retry:", error);
      await appendMissedTurn(userMessage, assistantMessage, errorMessage).catch((appendError) => {
        console.error("[poseidon] failed to persist missed turn fallback:", appendError);
      });
    }
  }
}
