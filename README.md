# Lineup Tool Migration

This folder contains the web migration of the Google Sheets / Apps Script lineup tool. GitHub Pages serves a selector-only real-player roster. The existing spreadsheet can provide calculations through a read-only Apps Script JSONP endpoint; an Azure Functions/Blob backend is an optional alternative.

## What is included

- A modular JavaScript architecture under `src/`
- A browser frontend under `public/` with a selector-only roster containing real player names, positions, and eligible slots; statistical results remain behind the API
- A read-only Apps Script JSONP endpoint that runs the spreadsheet's exact calculations and returns only lineup outputs/profile values
- A CSV converter that writes full rows to ignored `private/players.json` and selector-only fields to `public/data/roster.json`
- Separate GitHub Pages and Azure Functions deployment workflows

## Data handling

1. Keep the source CSV out of the public repository.
2. Run `python scripts/convert_csv_to_json.py` from `converted/`. This creates ignored `private/players.json` and a public selector-only `public/data/roster.json`.
3. Copy [apps-script/ProjectionApi.gs](apps-script/ProjectionApi.gs) into the existing spreadsheet's Apps Script project. Deploy it as a web app that runs as the spreadsheet owner and is accessible to anyone. Its `doGet` JSONP route accepts five selected names and returns calculated projections plus a sanitized selected-player profile; it never returns raw player records or writes to spreadsheet cells.
4. Copy the deployed web app's `/exec` URL into the `spreadsheet-projection-url` meta tag in `public/index.html`, commit, and push. This URL is public configuration, not a secret. JSONP lets the static GitHub Pages frontend call Apps Script without a CORS preflight.

The generated `public/data/roster.json` intentionally contains only names, listed positions, and eligible lineup slots so Pages can populate all player selectors without publishing stats. Keep it in sync with the spreadsheet's Players sheet. Never add the source CSV, `private/players.json`, or any full-stat dataset to Git or `public/`.

## Optional Azure Backend

The current implementation also supports Azure Functions with private Blob Storage. That route requires an Azure subscription, a private storage container, managed identity with Blob Reader access, and the Function App settings `PLAYER_DATA_BLOB_URL`, `SPREADSHEET_PROJECTION_URL`, and `SPREADSHEET_PROJECTION_KEY`. Keep the `doPost` shared key only in Script Properties and Azure app settings. Configure `lineup-api-base-url` with the Function URL and add GitHub's `AZURE_FUNCTIONAPP_NAME` variable and `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` secret. The Azure API deployment workflow skips deploy when those settings are absent.

## GitHub Pages Deploy

In repository Settings > Pages, use **GitHub Actions** as the build and deployment source. This one-time setup is required before `actions/configure-pages` can find the Pages site. The Pages workflow publishes only `public/`.

The Azure API workflow always runs its tests. It deploys only when both `AZURE_FUNCTIONAPP_NAME` and `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` are configured; otherwise it succeeds with an explicit deployment-skipped summary.

### Early test release

The live roster selector is available at `https://a12-25.github.io/Lineup-Tool/`. It lists all real players. Submit remains disabled until either the Apps Script `/exec` URL or Azure Function URL is configured. The repository is `https://github.com/a12-25/Lineup-Tool.git`, and only the `converted/` contents are published. The demo at `?demo=1` uses fictional players and mock calculations.

## Local development

For the Apps Script path, set the `/exec` URL in the frontend meta tag and serve `public/` with any static web server. For local Azure Functions development, install Node.js 20+, Azure Functions Core Tools v4, and Azurite; install dependencies with `npm install`, convert the CSV to ignored private JSON, copy `local.settings.example.json` to `local.settings.json`, configure server-side settings, and start the API with `npm start`. Run `npm test` and `npm run check` for validation. Never commit `local.settings.json`.

### Manual frontend preview

Open `public/index.html` directly in a browser and add `?demo=1` to its URL. This uses clearly labeled fictional players and mock results to test the selectors and result rendering without Node.js, Azure, or the private dataset. It does not test API integration or real calculations.

The dashboard follows the lineup sheet: projection and performance sections occupy the main column, while a player selector and seven collapsible profile sections stay in a compact side panel. On mobile, the profile is an off-canvas drawer opened by the fixed Player Profile button and dismissed by Close, the backdrop, or Escape. The profile selector is limited to the five submitted lineup players.

Net Rating Over Time uses the same pure 24-minute stint simulation as `GRAPH_Calculations.gs`, with 25 points for minutes 0 through 24. Positive and negative portions have separately themed line and area colors. Hover or drag along the line for a temporary signed value; select a minute point to pin it until the chart background is clicked or tapped.

The API preserves the spreadsheet's groups: overview ratings; offensive projections (shot balance, offensive rebounding, OFF rating, 3P%, TS%); defensive projections (opponent TS%, defensive rebounding, DEF rating, turnover creation, rim protection); five optimal-usage outputs; player performance (OFF, DEF, LOAD, FIT); and the selected player's bio, offensive/defensive load, shot profile, efficiency, expected defense, and expected impact. Percentage values are normalized to fractions in JSON and rendered as percentages in the browser.

## Privacy limits

- The API never returns the complete `raw` records; its roster endpoint returns names and positions, and its lineup endpoint returns calculations plus a sanitized profile for the selected lineup player. OFF, DEF, NET, and the four Lineup Overview ratings come from the spreadsheet's projection formulas, not averages of individual DPM values.
- The Apps Script JSONP `doGet` route is public so GitHub Pages can call it without a browser-held secret. It returns only requested lineup calculations/profile data, but users can make repeated lineup requests and observe returned values; Apps Script quotas and execution latency apply.
- Profile values are visible to the user who selects that player. Because the API is public, users can repeat requests for different lineups and collect profile values. This architecture prevents a one-request download of the complete source file; it does not make displayed player stats secret. Require authenticated access or omit those fields if that stronger restriction is necessary.
- The GitHub Pages frontend and public source code must not contain the player CSV, generated dataset, storage credentials, or Function publish profile.
- The original `.gs` spreadsheet files remain the business-logic reference and should not be added to a public repo unless intended.
