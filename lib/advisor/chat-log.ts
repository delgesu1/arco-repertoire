import { Pool } from "pg";

// Advisor chat log: one row per turn in the `atlas` schema of the Arco Supabase project.
// It connects as `atlas_logger`, a role that can only INSERT into atlas.advisor_turns and cannot read
// anything (including its own rows), so a leak of ATLAS_LOG_DATABASE_URL exposes none of Arco's data.
// Logging is best-effort: with no URL set it does nothing, and a failure never reaches the visitor.

export type TurnLog = {
  conversationId: string;
  section: "violin" | "chamber";
  userMessage: string;
  browsingContext: string;
  assistantMessage: string;
  errored: boolean;
  usage: { input: number; cacheRead: number; cacheWrite: number; output: number };
  durationMs: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isConversationId = (s: unknown): s is string => typeof s === "string" && UUID.test(s);

let pool: Pool | null | undefined;
function getPool() {
  if (pool !== undefined) return pool;
  const url = process.env.ATLAS_LOG_DATABASE_URL;
  pool = url
    ? new Pool({ connectionString: url, max: 1, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 3_000, ssl: { rejectUnauthorized: false } })
    : null;
  pool?.on("error", () => {}); // an idle connection dropping is not worth a crash
  return pool;
}

export async function logTurn(t: TurnLog) {
  const p = getPool();
  if (!p) return;
  try {
    await Promise.race([
      p.query(
        `insert into atlas.advisor_turns
           (conversation_id, section, user_message, browsing_context, assistant_message, errored,
            input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, duration_ms)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          t.conversationId,
          t.section,
          t.userMessage.slice(0, 2000),
          t.browsingContext.slice(0, 1000) || null,
          t.assistantMessage.slice(0, 60_000),
          t.errored,
          t.usage.input,
          t.usage.cacheRead,
          t.usage.cacheWrite,
          t.usage.output,
          t.durationMs,
        ],
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 4_000)),
    ]);
  } catch (err) {
    console.error("advisor log failed", err instanceof Error ? err.message : String(err));
  }
}
