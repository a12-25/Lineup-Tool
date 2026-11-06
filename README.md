# NBA Lineup Tool

> Author: [a12-25](https://github.com/a12-25)

## Project Description



- **At a glance:** the tool treats a lineup as a system rather than a sum of parts. It rewards complementary roles, penalizes wasted strengths and spacing problems, and shows how the result changes if the team runs a different offensive or defensive scheme.
- **Languages and tools:** JavaScript (browser frontend and Node modules), Google Apps Script (spreadsheet calculation engine), HTML/CSS, Python (CSV conversion), GitHub Actions (deployment), and Azure Functions (optional backend).
- **Input:** five selected players, one for each of the five lineup slots (PG, SG, SF, PF, C).
- **Output:** projected ratings for the lineup, an optimal-usage report with switchable system options, a per-player performance table, a simulated net-rating curve, and a detailed profile and 3D shape graph for any selected player.
- **Features:**
  - Searchable player selectors for the full roster, filtered by eligible slot.
  - Optional **Positionless** mode makes every player available in all five lineup selectors.
  - Projected **OFF, DEF, and NET** ratings (points per 100 possessions) plus four overview ratings.
  - 8 distinct lineup offensive and defensive projections.
  - **Optimal usage**: the ideal offensive systems, initiator, defensive systems, and rebounding schemes. The Offense and Defense rows are dropdowns of ranked system options, and picking one updates each player's OFF and DEF role in their bio.
  - **Player Performance** table with general attributes for every player.
  - **Net Rating Over Time**: a 24-minute deterministic stint simulation.
  - **Player profiles** with bio, offensive and defensive load, expected shot profile, expected efficiency, expected defense, and expected impact to the lineup.
  - **Player Spotlight**: replaces the lineup view with an individual net-rating-contribution graph and a deeper statistical evaluation of the player himself. Spotlight updates when another player is selected.
  - Light and dark themes, team color customization, a pause/resume button for graph animations, and a mobile layout with an off-canvas profile drawer.
  - All attributes are calculated with heavy involvement of publicly available statistics.
  - User preferences are saved in the browser.

## Modeling Features

The project does not use a trained machine-learning model. It is a transparent, rule-based statistical model whose weights were tuned by hand against the spreadsheet's calibration data. The main techniques are:

- **Percentile and z-score normalization.** Raw per-100-possession stats (shooting, creation, rebounding, defensive impact) are converted into percentile-based 0-99 ratings so unlike stats can be compared and combined.
- **Weighted linear blends.** Offensive and defensive ratings, load scores, and the player shape attributes are weighted averages of normalized inputs, with each weight chosen to reflect how much that input drives winning.
- **Diminishing-returns aggregation.** Lineup totals sort each category from best to worst and give later contributors less weight, so stacking five players with the same strength is worth less than covering different needs.
- **Calibration and regression to the mean.** Raw lineup projections are mapped onto a realistic points-per-100 scale. Extreme offenses and defenses are pulled back toward the league average, reflecting that very good or very bad five-man units regress over a full sample of minutes.
- **Assignment search (combinatorial optimization).** The system-fit engine scores all **120 player-to-role permutations** for each of **17 offensive and 14 defensive system templates**, then ranks the systems. Each assignment is scored with a fit function that rewards complementary responsibilities and useful roles for all five players, and subtracts penalties for weak fits, wasted strengths, spacing problems, and excessive creation burden. The top three alternatives are returned with their player assignments.
- **Rule-based role classification.** Player bio roles (for example Secondary Handler or Helpside Defender) and load profiles come from threshold and score comparisons across each player's skills.
- **Time-series stint simulation.** Net Rating Over Time is a deterministic simulation of a 24-minute stint. It models fatigue curves, role-based "second wind," load redistribution when players tire, usage-hierarchy conflicts, and momentum events, using Gaussian bumps, smooth-step and sigmoid shaping functions, and a stable hash in place of random numbers so the same lineup always produces the same curve. A second pass runs the model per player to produce the individual net-rating-contribution graph.
- **Expected-value profiles.** Expected shot profile, efficiency, and defense are projections of what a player is likely to produce in the specific lineup context, not just their past averages.

## Limitations

- **Accuracy:** The model uses 2025-26 NBA lineups as a reference and has correctly projected some current lineups for the 2026-27 NBA season, but accuracy is not guaranteed.
- **Interpretation:** Lineup ratings represent an average-case projection over at least 200 simulated minutes. Real-world lineups may differ in direction and magnitude before a reasonable runtime is reached. Player ratings combine talent and projection and should not be read as precise league percentiles or as directly comparable to NBA 2K ratings.
- **Data coverage:** The tool includes 492 NBA players who played in the 2025-26 NBA season, or in 2024-25 if an injury or other circumstance sidelined them in 2025-26. The 2026 rookie class is not included due to data limitations.

## Architecture

The project has two halves, kept separate so the full stat dataset is never published.

- **Frontend (`public/`):** a static site on GitHub Pages. `app.js` runs the interface and animations, `shape-radar.js` draws the 3D radar graphs, and `styles.css` holds the themes. The page only holds a selector-only roster (names, positions, eligible slots).
- **Calculation engine (Google Apps Script):** the original spreadsheet logic (`LINEUP_*.gs`, `PROFILE_*.gs`, `PLAYER_*.gs`, `GRAPH_*.gs`) runs behind a read-only JSONP endpoint, `apps-script/ProjectionApi.gs`. It returns only lineup calculations and sanitized profile data, never raw player records.
- **Shared modules (`src/`):** JavaScript engines for load normalization, role assignment, expected defense, expected impact, and lineup analysis, with the API service and spreadsheet client. These back the optional Azure Functions API.
- **Optional Azure backend:** Azure Functions with private Blob Storage as an alternative to the Apps Script endpoint.

```
Browser (GitHub Pages)  --JSONP-->  Apps Script Web App  -->  Players sheet + .gs engines
```

## User Interface Specification

1. **Lineup form:** choose one player for each of the five slots, then submit. Switch on **Positionless** to make every player available in every slot; switch it off to restore eligibility filtering.
2. **Results (left column):** rating projections, lineup overview, offensive and defensive projections, optimal usage, player performance, and the net-rating chart.
3. **Optimal usage dropdowns:** change the Offense or Defense system to see how the selected player's roles change.
4. **Player profile (right column):** choose a lineup player to open their profile. On mobile this is a drawer opened from the fixed Player Profile button.
5. **Open Player Spotlight:** replaces the lineup view with that player's net-rating contribution graph and shape radars. Use **Close Spotlight** to return to the lineup.
6. **Demo mode:** adding `?demo=1` to the URL uses fictional players and mock results, with no backend needed.

## Installation / Usage

The live site is at <https://a12-25.github.io/Lineup-Tool/>.

## Privacy Limits

- The API never returns complete raw player records, only calculations and sanitized profiles for the five selected players.
- The Apps Script JSONP route is public so GitHub Pages can call it without a secret in the browser. Apps Script quotas and latency apply.
- Never commit the source CSV, `private/players.json`, `local.settings.json`, or any storage credentials or publish profiles.
