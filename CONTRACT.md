# Ops system → content engine: data contract

The ops system sends one event per change. Full examples are in `samples/`.

## How to send an event

```
POST https://api.github.com/repos/<OWNER>/oldlions-content-engine/dispatches
Authorization: Bearer <fine-grained GitHub token: this repo only, Contents read & write>
Accept: application/vnd.github+json

{ "event_type": "ops-event", "client_payload": { "data": { ...event... } } }
```

The event goes inside `data` because GitHub limits `client_payload` to 10 top-level keys.
GitHub replies `204 No Content` on success. The pack appears at
`https://<OWNER>.github.io/oldlions-content-engine/packs/<pack-id>/` a minute or two later.

## When to send

| Ops system moment | `event` value | Pack produced |
|---|---|---|
| Fixture created (or date/venue/time changed) | `fixture.created` / `fixture.updated` | Fixture graphic + captions |
| Team selected and confirmed | `team.selected` | Playing XI with the captain's photo, plus a match-day poster |
| CricClubs scorecard imported | `scorecard.imported` | Result, player of the match, and a milestone post for every 50, 100 or 5-for |
| Weekly, e.g. Thursday evening | `fixtures.weekly` | Club-wide weekend fixtures (carousel if more than 7 games) |
| Weekly, e.g. Monday morning | `results.weekly` | Club-wide weekend results |

Send one event per team per match. Re-sending the same event rebuilds and replaces that pack.

## Fields used by every event

| Field | Type | Example | Notes |
|---|---|---|---|
| `event` | string | `"fixture.created"` | See table above |
| `matchId` | string | `"M-2026-0412"` | Ops system match ID |
| `competition` | string | `"Premier League"` | |
| `round` | string | `"Round 4"` | Optional |
| `format` | string | `"50 overs"` | Optional |
| `team` | object | `{ "id": "T1", "name": "1st XI" }` | Our team. `name` without the club name |
| `opponent` | object | `{ "name": "Kensington Ridge CC" }` | |
| `homeAway` | string | `"home"` or `"away"` | |
| `date` | string | `"2026-10-31"` | Match date, local |
| `startTime` | string | `"10:00"` | 24-hour, local |
| `venue` | object | `{ "name": "Old Lions Oval" }` | |

## `team.selected` adds

`players`: array, one per selected player.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Ops system player ID |
| `name` | string | Full name |
| `preferredName` | string | Optional; used instead of `name` if present |
| `battingOrder` | number | 1–11, sets the order on the graphic |
| `captain`, `wicketKeeper` | boolean | |
| `junior` | boolean | **Required for under-18s.** Shown as first name + initial |
| `photoConsent` | boolean | **No photo is ever used unless this is `true`** |
| `photoUrl` | string | Public URL of the headshot (a background-removed PNG looks best) |

## `scorecard.imported` adds

| Field | Notes |
|---|---|
| `result` | `{ "outcome": "won" \| "lost" \| "draw" \| "tie" \| "no result" \| "abandoned", "margin": "34 runs", "tossNote": "..." }` |
| `innings` | `[{ "team": "Old Lions", "runs": 268, "wickets": 7, "overs": "50" }, ...]` in batting order. `wickets: 10` means all out |
| `batting` | **Our players only**: `[{ "playerId", "name", "runs", "balls", "fours", "sixes", "notOut" }]` |
| `bowling` | **Our players only**: `[{ "playerId", "name", "overs", "maidens", "runs", "wickets" }]` |
| `topPerformerId` | Optional. Set it to override the automatic player-of-the-match pick |
| `players` | The same player list as `team.selected` (needed for photos, consent and junior flags) |

`playerId` values must match the ops system player IDs, which is why mapping CricClubs IDs to ops IDs matters.

## `fixtures.weekly`

```json
{ "event": "fixtures.weekly", "date": "2026-10-31", "title": "Saturday 31 October and Sunday 1 November",
  "fixtures": [ { "team": "1st XI", "opponent": "Kensington Ridge CC", "date": "2026-10-31",
                  "startTime": "10:00", "venue": "Old Lions Oval", "homeAway": "home", "competition": "Premier League" } ] }
```

`date` is the first match day of the weekend; posting time is worked out from it.

## `results.weekly`

```json
{ "event": "results.weekly", "date": "2026-11-01", "title": "Weekend of 31 October",
  "results": [ { "team": "1st XI", "opponent": "Kensington Ridge CC", "outcome": "won", "margin": "34 runs",
                 "ourScore": "268/7 (50)", "theirScore": "234 (46.3)" } ] }
```

`date` is the last match day of the weekend. `outcome` uses the same values as `scorecard.imported`.

## Photos

Photos are not sent in events. The engine picks them from the Google Drive Photo Library using the
player IDs above, and only uses a player's photos when `photoConsent` is `true` in the event.
Studio photos must be named `PLAYERID_pose.jpg` with the same IDs the ops system uses.
