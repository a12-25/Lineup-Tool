# NBA Lineup Tool

> Author: [a12-25](https://github.com/a12-25)

## Project Description

In the world of professional basketball, one of the most overlooked aspects of both roster construction and general speculation is lineups. Myore specifically, many perspectives gravitate towards putting their best five percieved talent on the floor, which may yeild unexpectedly good or bar results. To limit the uncertainty produced by this strategy, analysts use projection tools to predict how well a combination of players performs together.

- **Overview:** This tool treats a lineup as a system rather than a sum of parts. It rewards complementary roles, penalizes wasted strengths and spacing problems, and shows how the result changes if the team runs a different offensive or defensive scheme.
- **Languages and tools:** JavaScript (browser frontend and Node modules), Google Apps Script (spreadsheet calculation engine), HTML/CSS, Python (CSV conversion), GitHub Actions (deployment), and Azure Functions (optional backend).
- **Input:** five selected players, one for each of the five lineup slots (PG, SG, SF, PF, C).
- **Output:** projected ratings for the lineup, an optimal-usage report with switchable system options, a per-player performance table, a simulated net-rating curve, and a detailed profile for all selected players.
- **Features:**
  - Searchable player selectors for the full roster, filtered by eligible slot.
  - Optional **Positionless** mode makes every player available in all five lineup selectors.
  - Projected **OFF, DEF, and NET** ratings (points per 100 possessions) plus four overview ratings: creation balance, synergy, pace, and versatility.
  - Offensive and defensive lineup attribute projections.
  - **Optimal usage**: the best offensive system, ideal initiator, defensive system, and rebounding schemes. The Offense and Defense rows are dropdowns of ranked system options, and picking one updates each player's OFF and DEF role in their bio.
  - **Player Performance** table with OFF, DEF, LOAD, and FIT for every player.
  - **Net Rating Over Time**: a 24-minute stint simulation with hover, drag, and pin interactions.
  - **Player profiles** with a bio, offensive and defensive load, expected shot profile, expected efficiency, expected defense, and expected impact to the lineup.
  - **Player Spotlight**: replaces the lineup view with an individual net-rating-contribution graph and two rotatable 3D radar graphs for both offensive and defensive atrributes. Spotlight updates when another player is selected.
  - Light and dark themes, team color customization, a pause/resume button for graph animations, and a mobile layout with an off-canvas profile drawer.
  - User preferences saved in browser.s
  - All player evaluation is based off weighted observations of publicly available data of their most recent long-term appearances.

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
- **Manual overrides.** `PLAYER_Overrides.gs` holds hand-set OFF, DEF, and position values for players whose stats misrepresent them. An override replaces the calculated score and flows through the player performance table, expected-defense profile, shape graphs, and lineup fit.

## Limitations
- **Accuracy:** Though the model uses 2025-26 NBA lineups as a reference and has correctly projected some current lineups for the 2026-27 NBA season, accuracy is not 100% guaranteed.
- **Misinterpretation::** Ratings are representative of a result of at least a 200 simulated minute projection of the average performance case of a given lineup. Real-world lineups may look similar or different in direction and magnitude to their projections before a reasonable runtime is reached. Additionally, player individual ratings are meant to be reflective of a combination of talent and projection in a measure similar to but not precisely percentile around the league. Ratings are not meant to be interpreted as those similar to games similar to NBA 2k.
- **Data coverage:** The tool includes only 492 NBA players who played in the 2025-26 NBA season or 2024-25 if an injury or outstanding circumstance sidelined them in 25-26. The 2026 rookie class is and will NOT be in the projection tool due to limitations in available data. 


## User Interface Specification

1. **Lineup form:** choose one player for each of the five slots, then submit. Switch on **Positionless** to make every player available in every slot; switch it off to restore eligibility filtering.
2. **Results (left column):** rating projections, lineup overview, offensive and defensive projections, optimal usage, player performance, and the net-rating chart.
3. **Optimal usage dropdowns:** change the Offense or Defense system to see how the selected player's roles change.
4. **Player profile (right column):** choose a lineup player to open their profile. On mobile this is a drawer opened from the fixed Player Profile button.
5. **Open Player Spotlight:** replaces the lineup view with that player's net-rating contribution graph and shape radars. Use **Close Spotlight** to return to the lineup.
6. **Demo mode:** adding `?demo=1` to the URL uses fictional players and mock results, with no backend needed.

## Usage

The live site is at <https://a12-25.github.io/Lineup-Tool/>.

## Privacy Limits

- The API never returns complete raw player records, only calculations and sanitized profiles for the five selected players.
- The Apps Script JSONP route is public so GitHub Pages can call it without a secret in the browser. Apps Script quotas and latency apply.
- Never commit the source CSV, `private/players.json`, `local.settings.json`, or any storage credentials or publish profiles.
