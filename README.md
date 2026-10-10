# Arco Repertoire

An interactive library of 4,061 graded violin works, live at [repertoire.arco.app](https://repertoire.arco.app). Created by [Daniel Kurganov](https://www.kurganov.org) as a companion to the Arco practice app.

Pushing to `main` deploys to production on Vercel.

## Develop

```bash
npm install
npm run dev
```

The advisor needs `ANTHROPIC_API_KEY` (in `.env.local` locally, and in the Vercel project settings for production).

## Data

The catalogue comes from the "Violin Repertoire Finder" Google Sheet. After refreshing the snapshot in `data/source/all-repertoire.json`, rebuild the site data:

```bash
npx tsx scripts/build-data.ts
```

This writes `public/data/catalogue.json`, `data/build/catalogue.json` and the advisor's catalogue in `lib/advisor/catalogue-text.ts`. Commit the results and push.

Other scripts in `scripts/` (recordings, character tags, popularity) call the Claude API and are run occasionally, not on every build.

The expansion of October 2026 (about 900 works for 52 composers) was produced with the tools in `scripts/expand/`; what changed, what was left out and how it was checked is written up in [docs/catalogue-expansion-2026-10.md](docs/catalogue-expansion-2026-10.md).
The technical-materials expansion that followed (about 900 scale systems, exercise books, étude and caprice books, including every study of Kreutzer, Rode, Dont Op. 35, Fiorillo and Gaviniès) was researched by subagents and graded blind by two models; method, decisions and caveats are in [docs/technical-materials-2026-10.md](docs/technical-materials-2026-10.md), and `data/expansion/tech/NOTES.md` says how to re-run it (`data/expansion/tech/regen.sh`).
Where Arco appears on the site (piece-page line, footer, return-visit card, iOS banner) and how its links are tagged: [docs/arco-touchpoints.md](docs/arco-touchpoints.md).
Addresses of pieces that were merged or renamed keep working through `data/id-redirects.json` and `data/slug-redirects.json` (read by `next.config.ts`; `scripts/expand/redirects.ts` regenerates them).
