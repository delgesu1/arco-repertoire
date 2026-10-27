# Advisor chat log

Every advisor turn (violin and chamber) is saved as one row in `atlas.advisor_turns`: the question, the answer, the section, token counts, latency, and a conversation id that groups the turns of one conversation. No IP address or other visitor identifier is stored.

## Where it lives

The Arco Supabase project (`kjasupumfueszswakasl`), in its own schema `atlas`. Code: [lib/advisor/chat-log.ts](../lib/advisor/chat-log.ts), called at the end of each turn in [app/api/advisor/route.ts](../app/api/advisor/route.ts).

## How it stays separate from Arco

- The site connects as the role `atlas_logger`. It can `INSERT` into `atlas.advisor_turns` and do nothing else: it cannot read, update, delete or truncate even that table, cannot create objects, and has no privileges on any `public`, `auth` or `storage` table (checked against all 108 tables).
- The schema is not exposed through the Supabase Data API, and `anon`, `authenticated` and `service_role` have no privileges on it. Row-level security is on.
- A leaked `ATLAS_LOG_DATABASE_URL` therefore lets someone add junk rows, nothing more. Rotate with `alter role atlas_logger with password '…'`.
- Rows can be read in the Supabase dashboard (SQL editor or Table editor, schema `atlas`).

## Setup

`ATLAS_LOG_DATABASE_URL` is the pooler connection string for `atlas_logger` (user `atlas_logger.kjasupumfueszswakasl`, port 6543). It is in `.env.local` and must also be set in the Vercel project. With the variable unset, logging is skipped and the advisor works as before.

## Not done

No retention job yet. `pg_cron` is available but not enabled; until then, delete old rows by hand, for example `delete from atlas.advisor_turns where created_at < now() - interval '90 days'`.
