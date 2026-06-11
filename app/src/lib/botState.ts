import { queryOne, query } from "./db";

export type BotState<T> = {
  bot_id: string;
  state: T;
  updated_at: string;
};

export async function readBotState<T = Record<string, unknown>>(
  botId: string,
): Promise<BotState<T> | null> {
  const row = await queryOne<{
    bot_id: string;
    state: T;
    updated_at: Date;
  }>(
    "SELECT bot_id, state, updated_at FROM bot_states WHERE bot_id = $1",
    [botId],
  );

  if (!row) {
    return null;
  }

  return {
    bot_id: row.bot_id,
    state: row.state,
    updated_at: row.updated_at.toISOString(),
  };
}

export async function writeBotState<T = Record<string, unknown>>(
  botId: string,
  state: T,
): Promise<void> {
  await query(
    `INSERT INTO bot_states (bot_id, state, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (bot_id)
     DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()`,
    [botId, JSON.stringify(state)],
  );
}
