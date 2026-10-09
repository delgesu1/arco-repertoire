import Anthropic from "@anthropic-ai/sdk";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { MODEL, buildSystem } from "@/lib/advisor/prompt";
import { TOOLS, runTool, type UiEvent } from "@/lib/advisor/tools";

export const maxDuration = 120;

const MAX_MESSAGE = 1200;
const MAX_HISTORY_BYTES = 400_000;
const MAX_USER_TURNS = 24;
const SOFT_TOKEN_LIMIT = 150_000; // suggest a fresh conversation beyond this (the catalogue alone is ~90K)
const MAX_LOOPS = 6;

// ── tiny per-instance rate limit (the Vercel firewall rule is the real guard) ──
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 40;
}

// ── history signing: the client keeps the conversation; we only accept what we produced ──
const secret = () =>
  process.env.ADVISOR_SECRET ?? createHash("sha256").update(`advisor:${process.env.ANTHROPIC_API_KEY ?? ""}`).digest("hex");
const sign = (s: string) => createHmac("sha256", secret()).update(s).digest("base64url");
function verify(s: string, sig: string) {
  const a = Buffer.from(sign(s));
  const b = Buffer.from(sig ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}

type Body = { history?: string; sig?: string; message?: string; context?: string };

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "The advisor isn't switched on yet." }, { status: 503 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limited(ip)) return Response.json({ error: "Too many questions in a short time — try again in a few minutes." }, { status: 429 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const text = (body.message ?? "").trim().slice(0, MAX_MESSAGE);
  if (!text) return Response.json({ error: "Empty message" }, { status: 400 });

  let history: Anthropic.MessageParam[] = [];
  if (body.history) {
    if (body.history.length > MAX_HISTORY_BYTES || !verify(body.history, body.sig ?? "")) {
      return Response.json({ error: "reset", message: "Let's start a fresh conversation." }, { status: 409 });
    }
    history = JSON.parse(body.history);
  }
  if (history.filter((m) => m.role === "user" && typeof m.content === "string").length >= MAX_USER_TURNS) {
    return Response.json({ error: "reset", message: "This conversation is getting long — start a fresh one?" }, { status: 409 });
  }

  const context = body.context ? `[Browsing context: ${body.context.slice(0, 600)}]\n\n` : "";
  const messages: Anthropic.MessageParam[] = [...history, { role: "user", content: context + text }];

  const client = new Anthropic();
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      const usage = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, lastInput: 0 };
      const started = Date.now();
      try {
        for (let loop = 0; loop < MAX_LOOPS; loop++) {
          const s = client.messages.stream(
            {
              model: MODEL,
              max_tokens: 16000,
              system: buildSystem(),
              tools: TOOLS,
              tool_choice: { type: "auto" },
              thinking: { type: "adaptive", display: "summarized" },
              output_config: { effort: "xhigh" },
              cache_control: { type: "ephemeral" },
              messages,
            },
            { signal: req.signal },
          );
          let loopText = "";
          s.on("text", (delta) => {
            loopText += delta;
            send("text", { delta });
          });
          s.on("thinking", (delta) => send("thinking", { delta }));
          const msg = await s.finalMessage();
          const u = msg.usage;
          usage.input += u.input_tokens;
          usage.cacheRead += u.cache_read_input_tokens ?? 0;
          usage.cacheWrite += u.cache_creation_input_tokens ?? 0;
          usage.output += u.output_tokens;
          usage.lastInput = u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);

          if (msg.stop_reason === "refusal") {
            send("error", { message: "I can't help with that one — try asking about repertoire." });
            messages.push({ role: "assistant", content: msg.content });
            break;
          }
          const toolUses = msg.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
          messages.push({ role: "assistant", content: msg.content });
          if (msg.stop_reason === "max_tokens" && toolUses.length) {
            send("error", { message: "That took too long to work out — could you narrow it down a little?" });
            break;
          }
          if (!toolUses.length) break;

          const results: Anthropic.ToolResultBlockParam[] = [];
          let endTurn = false;
          for (const t of toolUses) {
            const out = await runTool(t.name, t.input);
            if (out.status) send("status", { text: out.status });
            if (out.ui) send("ui", out.ui satisfies UiEvent);
            if (out.endTurn) endTurn = true;
            results.push({ type: "tool_result", tool_use_id: t.id, content: out.result, ...(out.isError ? { is_error: true } : {}) });
          }
          messages.push({ role: "user", content: results });
          if (endTurn) break;
          if (loopText.trim()) send("text", { delta: "\n\n" });
        }
      } catch (err) {
        const aborted = req.signal.aborted;
        if (!aborted) {
          console.error("advisor error", err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : String(err));
          send("error", {
            message:
              err instanceof Anthropic.APIError && err.status === 400
                ? "Something went wrong with this conversation — please start a fresh one."
                : "The advisor is busy right now — please try again in a moment.",
            reset: err instanceof Anthropic.APIError && err.status === 400,
          });
        }
      }
      // never log message content; usage only
      console.log(
        `advisor turn: ${Date.now() - started}ms in=${usage.input} cacheRead=${usage.cacheRead} cacheWrite=${usage.cacheWrite} out=${usage.output} ctx=${usage.lastInput}`,
      );
      const serialized = JSON.stringify(messages);
      send("done", {
        history: serialized,
        sig: sign(serialized),
        nearLimit: usage.lastInput > SOFT_TOKEN_LIMIT,
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
