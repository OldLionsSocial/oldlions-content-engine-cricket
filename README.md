# Old Lions content engine

Turns ops-system events into ready-to-post social content: graphics in feed (1080×1350) and story (1080×1920) sizes, captions for every platform, a review page, and a schedule file that Claude can push into Metricool.

```
Ops system ──event──▶ GitHub Action ──▶ content pack ──▶ review page ──▶ Claude + Metricool ──▶ socials
```

## What's in a pack

Each pack lives at `docs/packs/<date>-<team>-<type>/` and is published on GitHub Pages:

- `feed.png` and `story.png`: the graphics
- `captions.json`: one caption per platform (Facebook, Instagram, TikTok, X, LinkedIn, Google Business Profile)
- `schedule.json`: every post with its time, media URLs and Metricool settings, plus the facts used and any warnings
- `index.html`: the review page for the media volunteer

## How captions stay accurate

Claude only writes the words. Scores and figures come from the ops system and are passed in as a fact sheet. Every number in every caption is checked against that sheet; if Claude adds or changes one, it gets one retry, then that caption is swapped for a plain template and flagged on the review page. Without an API key the engine still works, using template captions.

## One-time setup

1. **Create the repo.** Push this folder to a new GitHub repository named `oldlions-content-engine`. GitHub Pages on a free account needs a public repo; the graphics have to be public anyway so Metricool can fetch them. Never commit keys or tokens.
2. **Turn on Pages.** Settings → Pages → Deploy from a branch → `main`, folder `/docs`.
3. **Add your Claude API key.** Get one at console.anthropic.com, then Settings → Secrets and variables → Actions → New secret named `ANTHROPIC_API_KEY`.
4. **Edit `config/club.json`.** Set `publicBaseUrl` to your Pages address, swap in the club colours, hashtags and sponsor, and check the posting times under `schedule`.
5. **Edit `config/style-guide.md`** so captions sound like the club.
6. **Give the ops developer `CONTRACT.md`** plus a fine-grained GitHub token (this repo only, Contents: read and write) so the ops system can send events.

## Weekly flow

1. The ops system creates a fixture, selects a team or imports a scorecard and sends an event.
2. About two minutes later the pack is live at `<publicBaseUrl>/packs/<pack-id>/`.
3. The media volunteer opens the review page, checks the graphic, captions and any warnings.
4. In Claude, with Metricool connected, they paste the line shown on the review page:
   *"Schedule the Old Lions content pack at …/schedule.json in Metricool. Show me each post before you schedule it."*
5. Claude reads the file, shows each post, and schedules it on approval.

## Testing locally

```
npm install
npm run demo                                   # builds packs from samples/ with placeholder photos
ANTHROPIC_API_KEY=sk-... npm run demo          # same, with Claude captions
node src/build-pack.js path/to/event.json      # any single event
```

You can also run a build by hand from GitHub: Actions → Build content pack → Run workflow, and paste an event.

## Post types

| Ops event | Posts made |
|---|---|
| `fixture.created` | Fixture card |
| `team.selected` | Playing XI (captain cut-out beside the team list) and a Game day poster (ground photo, giant type, captain in front) |
| `scorecard.imported` | Result (full-bleed match photo with a score band, or the scoreboard design when there's no photo), Player of the match (cut-out with stacked stats), and a Milestone post for every 50, 100 or 5-for |
| `fixtures.weekly` / `results.weekly` | Club-wide weekend fixtures or results, one row per team; more than 7 teams becomes a carousel |

The older Team list design (round headshots for all 11) is still available: set `"outputs": { "team.selected": ["team-list", "gameday"] }` in `config/club.json`. The same setting turns any post type off.

## Photos from Google Drive

Photos live in **Cricket Club / Photo Library** on the club's shared drive (see the guide in that folder). Every 30 minutes the **Ingest photos** workflow:

1. picks up new or changed photos in Studio, Match Photos and Brand Assets,
2. re-encodes them, which strips location data,
3. cuts out the background on studio shots and makes a head-and-shoulders crop,
4. saves everything to *Processed (engine only)* with an index, `photo-index.json`.

When a pack is built, the engine chooses photos from that index:

- **Player of the match / milestones:** studio cut-out matching what they did (bowling pose for a 5-for), then celebrate, then half-body.
- **Playing XI / Game day:** the captain's half-body (arms crossed) cut-out.
- **Result:** a match photo from that day tagged with the top performer, otherwise their cut-out on a ground photo.
- **Backgrounds:** ground photos from Brand Assets / Ground & Club.
- **Logo:** the first PNG in Brand Assets / Logos.

Consent is checked on every build. A photo is only used if **every** player tagged in it has `photoConsent: true` in the event. Match photos with nobody tagged are never used automatically. Within the current season, photos rotate so the same one isn't used every week.

**Tagging match photos:** put player IDs in the file name (`P103_P107_celebrate.jpg`) or in the file's Drive description (*File information → Details → Description*: `P103 bat`). Words like bat, bowl, keep, celebrate in the name or description help pick the right shot.

Creating a fixture also creates its match folder in Drive, named `YYYY-MM-DD Team v Opponent`.

### Drive setup (one-time)

1. In [Google Cloud Console](https://console.cloud.google.com), create a project, enable the **Google Drive API**, then create a **service account** and download a JSON key.
2. In Drive, share the **Photo Library** folder (only that folder) with the service account's email address as **Content manager**. If sharing is blocked, your Workspace admin needs to allow sharing with that address, or add it as a member of the shared drive.
3. In GitHub, add the whole JSON key as a secret named `GOOGLE_SERVICE_ACCOUNT_JSON`.
4. Run **Actions → Ingest photos → Run workflow** once. The log lists anything it couldn't use, such as badly named studio photos or untagged match photos.

The first run downloads the background-removal model (about a minute); after that it's cached.

## Changing the look

Templates are in `src/templates/` (HTML with inline styles, rendered without a browser by satori; every `div` with more than one child needs `display:flex`). Colours come from `club.json`. Fonts are Anton (display) and Barlow Condensed (text), installed from npm.

## Photos and safeguarding

- A player's photo is only used when `photoConsent` is `true`; otherwise a neutral placeholder is drawn and the review page flags it.
- Players marked `junior` appear as first name and surname initial on graphics and in captions.

## Not built yet

- Monday newsletter and classifieds
- Career milestones (games played, season aggregates)
- Ladder and stat-leader graphics
- Studio photo-day QR matching (name files `PLAYERID_pose.jpg` for now)
- Sponsor logos on graphics
- Fully automatic scheduling (needs Metricool's API on the Advanced plan, or keep the Claude step)
