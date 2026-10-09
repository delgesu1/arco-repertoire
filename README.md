# Arco Repertoire

An interactive library of 2,253 graded violin works, live at [repertoire.arco.app](https://repertoire.arco.app). Created by [Daniel Kurganov](https://www.kurganov.org) as a companion to the Arco practice app.

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
