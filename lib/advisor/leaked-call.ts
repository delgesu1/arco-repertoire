/**
 * Now and then the model writes a tool call as plain text ("show_results({ title: …, items: [ … ] })") instead of calling
 * the tool. Left alone, the visitor sees code in the chat and the main list never changes. app/api/advisor/route.ts holds
 * back any text that could be the start of such a call while it streams, then strips the call out of the reply and runs it.
 */

/** How much of the text can go to the visitor now: everything before a tool's name, a code fence, or a tail that could become one. */
export function safeLength(text: string, names: string[]): number {
  let cut = text.length;
  for (const name of names) {
    const i = text.indexOf(name);
    if (i >= 0) cut = Math.min(cut, i);
  }
  const fence = text.indexOf("```");
  if (fence >= 0) cut = Math.min(cut, fence);
  const longest = Math.max(3, ...names.map((n) => n.length));
  for (let k = Math.min(longest, text.length); k > 0; k--) {
    const tail = text.slice(-k);
    if (names.some((n) => n.startsWith(tail)) || "```".startsWith(tail)) {
      cut = Math.min(cut, text.length - k);
      break;
    }
  }
  return cut;
}

export type LeakedCall = { name: string; input: unknown | null };

/** The text with every tool call written as text taken out, and the calls it held (input is null when it could not be read). */
export function stripLeakedCalls(text: string, names: string[]): { text: string; calls: LeakedCall[] } {
  const calls: LeakedCall[] = [];
  let out = text;
  for (;;) {
    const hit = findCall(out, names);
    if (!hit) break;
    calls.push({ name: hit.name, input: hit.input });
    out = out.slice(0, hit.start) + out.slice(hit.end);
  }
  return { text: calls.length ? out.replace(/\n{3,}/g, "\n\n").trim() : text, calls };
}

function findCall(text: string, names: string[]): { start: number; end: number; name: string; input: unknown | null } | null {
  let best: { at: number; name: string } | null = null;
  for (const name of names) {
    const m = new RegExp(`\\b${name}\\s*\\(`).exec(text);
    if (m && (!best || m.index < best.at)) best = { at: m.index, name };
  }
  if (!best) return null;
  const open = text.indexOf("(", best.at);
  const close = matchingParen(text, open);
  const input = close < 0 ? null : looseJson(text.slice(open + 1, close).trim());
  // take the fence and the blank space round the call with it
  let start = best.at;
  const before = text.slice(0, start).match(/```[a-z]*\s*$/i);
  if (before) start -= before[0].length;
  while (start > 0 && /\s/.test(text[start - 1])) start--;
  let end = close < 0 ? text.length : close + 1;
  const after = text.slice(end).match(/^\s*;?\s*(```)?/);
  if (after) end += after[0].length;
  return { start, end, name: best.name, input };
}

/** The ")" that closes the "(" at `open`, skipping anything inside quotes; -1 when the text stops first. */
function matchingParen(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === '"' || c === "'" || c === "`") {
      i = endOfString(s, i);
      if (i < 0) return -1;
    } else if (c === "(") depth++;
    else if (c === ")" && --depth === 0) return i;
  }
  return -1;
}

function endOfString(s: string, start: number): number {
  for (let i = start + 1; i < s.length; i++) {
    if (s[i] === "\\") i++;
    else if (s[i] === s[start]) return i;
  }
  return -1;
}

/** A JavaScript object literal as the model writes it (bare keys, either quotes, trailing commas) read as JSON; null if it isn't one. */
export function looseJson(src: string): unknown | null {
  let out = "";
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'") {
      const end = endOfString(src, i);
      if (end < 0) return null;
      const body = src.slice(i + 1, end);
      out += c === '"' ? `"${body}"` : JSON.stringify(body.replace(/\\'/g, "'"));
      i = end;
    } else if (/[A-Za-z_$]/.test(c)) {
      const word = /^[A-Za-z_$][\w$]*/.exec(src.slice(i))![0];
      const rest = src.slice(i + word.length);
      if (/^\s*:/.test(rest)) out += JSON.stringify(word);
      else if (word === "true" || word === "false" || word === "null") out += word;
      else return null;
      i += word.length - 1;
    } else if (c === ",") {
      if (!/^\s*[}\]]/.test(src.slice(i + 1))) out += c;
    } else out += c;
  }
  try {
    return JSON.parse(out);
  } catch {
    return null;
  }
}
