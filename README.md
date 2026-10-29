# Old Lions content engine

Turns ops-system events into ready-to-post social content and a Monday newsletter: graphics in feed (1080×1350) and story (1080×1920) sizes, captions for every platform, a private review page, and a schedule file Claude can push into Metricool.

```
Ops system ──event──▶ GitHub Action ──▶ content pack ──▶ review page ──▶ Claude + Metricool ──▶ socials
Drive Photo Library ──every 30 min──▶ photo job (cut-outs, logos, index)
Daily job ──Tue/Wed──▶ Umpire's Call quiz and answer
```

## Post types

| Event | Posts | Colourway |
|---|---|---|
| `fixture.created` / `fixture.updated` | Fixture card (+ creates the match photo folder in Drive) | Navy |
| `team.selected` | Playing XI (captain cut-out) and Game day poster | Red |
| `scorecard.imported` | Result (match photo + score band, or scoreboard), Player of the match, a Milestone post for every 50, 100 and 5-for | Red (losses navy); milestones yellow |
| `fixtures.weekly` / `results.weekly` | Club-wide weekend fixtures / results (carousel past 7 teams) | Navy / red |
| `predict.open` | Predict the score | Navy |
| `potw.vote` | Player of the week vote (up to 4) | Red |
| `guess.player` / `guess.reveal` | Guess the Lion silhouette, then the reveal | Navy / red |
| `leaderboard` | Season leaderboard (runs, wickets, etc.) | Navy |
| `quiz` / `quiz.answer` | Umpire's Call question and answer (also built automatically by the daily job) | Yellow / navy |
| `newsletter.weekly` | Monday newsletter (email-ready HTML + plain text) with results, milestones, fixtures, news, diary and classifieds | Club colours |

Turn any post off or change what an event makes with `"outputs"` in `config/club.json`. Change colourways with `"themes"`.

Full event formats: **CONTRACT.md**.

## Design

Every design shares one look: club red, navy and yellow; a soft spotlight and print texture; the lion (separated from the badge, as approved) as a faint watermark; three sweeping stripes taken from the shirt piping; and fine grain. The badge is always shown whole, with its laurels. Each post type has its own colourway so the feed alternates. Decor lives in `src/theme.js`; templates in `src/templates/`.

## Brands (club, Super Sixers, franchises)

Add `"brand": "super-sixers"` (or `gladiators`, `centurions`, `titans`, `mavericks`, `spartans`) to any event to draw it for that brand. Brand settings (name, logo, hashtags, handles, Metricool brand) are in `config/brands.json`; anything not set uses the club's. Logos are found by name in Brand Assets / Logos (all sub-folders). A brand never falls back to the club badge.

## Sponsors

Put sponsor logos in **Brand Assets / Sponsors** (file name = sponsor name). Each post gets one sponsor, rotated fairly, or the one named on the event with `"sponsor": "Name"`. It appears in the footer of the fixture, results, weekend lists and newsletter, and in captions. The **Housekeeping** workflow writes `sponsor-report.csv` each month: appearances per sponsor, month, post type and brand.

## Photos (Google Drive)

Photos live in **Cricket Club / Photo Library** on the shared drive. Every 30 minutes the **Ingest photos** workflow:

1. reads studio photos from **Studio/<season>** (named `PLAYERID_pose.jpg`) and from raw shoot folders listed in `photoLibrary.studioRawFolders` (named after the player, e.g. `Allister de Blocq 4.jpg`),
2. matches raw photos to players using the **Player Roster (photo matching)** sheet,
3. has Claude label each raw photo's pose and skip blinks, blur and bad crops (Claude describes the photo; it is never asked who is in it),
4. removes the green screen, fixes green spill, and makes full, waist-up and head-and-shoulders crops,
5. reads match photos, ground photos, logos, opposition crests and sponsor logos,
6. strips location data from everything, and writes `photo-index.json` to *Processed (engine only)*.

The run log lists anything it couldn't use (no roster ID yet, unnamed files, skipped shots).

Consent is checked on every build: a photo is used only if every tagged player has `photoConsent: true` in the event. Juniors appear as first name + initial.

## Privacy

Review pages are public web pages, so each pack's address includes a secret-keyed code (set the `PACK_SECRET` secret) that can't be guessed. There is no public list of packs, and pages ask search engines not to index them. Review links appear in each GitHub run's summary.

## Weekly running

- **Ops events** build posts automatically (see CONTRACT.md). Until the ops system sends them, paste an event into **Actions → Build content pack → Run workflow**.
- **Daily posts** (Tuesday quiz, Wednesday answer) build at 06:00 by themselves. Add questions to `config/quiz-bank.json`.
- **To schedule:** open the review page, check it, then paste the line it shows into Claude with Metricool connected.
- **Newsletter:** open its review page, then paste the line it shows into Claude with Gmail connected to make a draft.

## Secrets (GitHub → Settings → Secrets and variables → Actions)

| Secret | What |
|---|---|
| `ANTHROPIC_API_KEY` | Captions, newsletter intro, photo sorting |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Drive access (Photo Library only) |
| `PACK_SECRET` | Any long random text; makes review addresses unguessable |

## Get told when something fails

GitHub emails you when a workflow fails. Check it's on: your GitHub profile → **Settings → Notifications → Actions** → tick **Email** and **Only notify for failed workflows**.

## Testing locally

```
npm install
npm run demo                                            # sample packs with placeholder photos
node src/build-pack.js samples/quiz.json                # any single event
node src/daily.js tue                                   # pretend it's Tuesday
```

## Not built yet (needs decisions or other systems)

- An approve-and-schedule button on review pages (needs Metricool's paid API plan)
- Motion versions for Reels and TikTok
- Monthly analytics report (needs Metricool data)
- Picking the Predict the score winner (comments have to be read by a person)
