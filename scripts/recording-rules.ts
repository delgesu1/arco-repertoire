/**
 * Performers whose recordings the site never embeds (docs/recording-rules.md).
 *
 * A YouTube video is excluded when its title, channel or description names one of them. build-data.ts and build-chamber.ts
 * fail on an excluded recording, and the judging scripts drop such candidates before anyone picks among them.
 */
export const EXCLUDED_PERFORMERS = ["Ray Chen", "Sarah Chang", "Joshua Bell", "Stefan Jackiw"] as const;

const EXCLUDED = /\b(ray[\s.]+chen|chen,\s*ray|sarah[\s.]+chang|chang,\s*sarah|josh(ua)?[\s.]+bell|bell,\s*josh(ua)?|stefan[\s.]+jackiw|jackiw)\b/i;

/** true when any of the texts (title, channel, description…) names an excluded performer */
export const featuresExcludedPerformer = (...texts: (string | null | undefined)[]): boolean => EXCLUDED.test(texts.filter(Boolean).join(" \n "));

/** throws when a recording picked for the site features an excluded performer */
export function assertNoExcludedPerformers(pieces: { id: number; title: string; recording: { id: string; title: string; channel: string } | null }[]): void {
  const bad = pieces.filter((p) => p.recording && featuresExcludedPerformer(p.recording.title, p.recording.channel));
  if (bad.length)
    throw new Error(
      `Recordings by excluded performers (${EXCLUDED_PERFORMERS.join(", ")}; see docs/recording-rules.md):\n` +
        bad.map((p) => `  ${p.id} ${p.title}: https://youtu.be/${p.recording!.id} "${p.recording!.title}" (${p.recording!.channel})`).join("\n"),
    );
}
