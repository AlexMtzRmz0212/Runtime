# Runtime

Runtime is a personal TV tracker, binge-watching as a marathon, that uses **Notion as its database**, with a public page anyone can look at and an owner view (behind a password) where you tick episodes, change status and score, and add shows. Same shape as [Cinetech](../Cinetech).

- **Public**: library with search and filters, a *Continue watching* strip, a Top list, and a page per show with season and episode progress. Read-only.
- **Owner** (lock icon, then password): tick single episodes or a whole season, edit status and score, **fill a show's episodes from TVmaze with one button**, and **add a new show by searching TVmaze**.
- Private fields (`Watched with`, the Alex/Mish/Char relevance scores, Notion ids) are removed on the server, so they are not in the public HTML either.

## How the data is laid out

| Notion database | What it holds |
|---|---|
| **TV Shows** (existing) | One row per show with the columns you already have. Duplicate rows with the same name are merged when read: the oldest row is the base and newer copies only fill its empty fields. |
| **Episodes** (new) | One row per episode: `Title`, `Show` (relation to TV Shows), `Season`, `Episode`, `Watched`, `Watched date`, `Air date`. Replaces one database per show. |

Progress is counted from the Episodes rows. A show without any (yet) falls back to its own `Current Season` / `Last watched episode` columns, drawn as a striped, estimated bar. Ticking episodes keeps `Current Season`, `Last watched episode`, `Episodes of current Season` and `Status` in step, so your Notion views and formulas keep working.

## Setup

1. Create an internal integration at <https://www.notion.so/profile/integrations>.
2. In Notion, create an empty database called **Episodes**. Share it **and TV Shows** with the integration (`...` menu, *Connections*). The app adds the missing columns itself on first load.
3. `copy .env.example .env.local` and fill it in: `NOTION_TOKEN`, `SHOWS_DATABASE_ID`, `EPISODES_DATABASE_ID` (the 32-character part of each database URL), `APP_PASSWORD`, and `SESSION_SECRET` (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
4. `npm install`, then `npm run dev` (or `DEV.bat`, which also opens the site in an incognito Chrome window) and open <http://localhost:3000>.

Without the Notion variables the pages show a setup error that names the missing one.

**Certificate errors** (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`, a blank 500 page in dev): some antivirus or proxy software re-signs HTTPS traffic with a certificate Windows trusts but Node doesn't. `npm run dev`, `start` and `migrate` therefore set `NODE_USE_SYSTEM_CA=1` so Node uses the Windows certificate store. If you run Node some other way, set that variable yourself.

## Filling episodes (TVmaze)

No key or account needed: episode lists come from [TVmaze](https://www.tvmaze.com/api).

- **Fill episodes** (on a show page, owner view): searches TVmaze by the show's name, preselects the best match (same name, same start year) and asks you to confirm. It then creates every missing episode in your Episodes database, in batches, with a progress bar. Run again later as **Sync new episodes**: it remembers the TVmaze id (saved in a `TVmaze ID` column the app adds to TV Shows) and only creates episodes you don't have yet. It never changes or deletes existing rows.
- **Add a show** (`/add`): search TVmaze, pick the show, choose a status, and it creates the TV Shows row (name, dates, seasons, genres and platform, using only options you already have) and all its episodes.
- **What starts as watched**: status *Watched* marks every aired episode watched, up to the number in `Seasons`. *In Progress* marks everything up to `Current Season` / `Last watched episode`. Anything else starts unwatched. Episodes that haven't aired are never watched. The panel tells you which rule applies before you confirm.

## Moving the per-show databases over (optional)

Only needed if you want your existing per-show progress copied instead of recreated from TVmaze.

They live in another Notion account, so the script reads them with a second integration (or from CSV exports) and writes into your Episodes database:

1. In the **other** account, create an integration, share the per-show databases with it, and put its token in `.env.local` as `SOURCE_NOTION_TOKEN`.
2. `npm run migrate` is a **dry run**. It prints, per source database, the show it matched (by title), how many rows it has, how many already exist, and which columns it recognised as season / episode / watched. Fix anything it lists under "need a look" before going on.
3. `npm run migrate -- --apply` creates the missing rows. It is safe to repeat: existing season and episode pairs are skipped.

No second token? Export each database to CSV (one file per show, named after the show) and run `npm run migrate -- --csv path\to\folder`. `--only "Lost"` limits a run to databases whose title contains that text.

## How the public page refreshes

Pages are cached for 15 minutes (Next.js ISR), and anything you change in the app refreshes them right away. Changes made directly in Notion show up within about 15 minutes.

## Deploy to Vercel

Import the repo and set the same variables as `.env.local` in *Project Settings, Environment Variables* (not `SOURCE_NOTION_TOKEN`). If a variable is missing, pages show a setup error instead of the library.

## Scripts

`npm test` (unit tests), `npm run lint` (type check), `npm run build`.
