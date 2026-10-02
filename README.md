# Lineup Tool Migration

This folder contains the web migration of the Google Sheets / Apps Script lineup tool. The frontend is static; the complete player dataset stays private and is read by an Azure Functions API.

## What is included

- A modular JavaScript architecture under `src/`
- A browser frontend under `public/` that receives names, positions, eligible slots, and calculated results only
- An Azure Functions API that reads full player records from private Blob Storage and gets exact lineup projections from the spreadsheet calculation service
- A CSV-to-JSON conversion script that writes to the ignored `private/` directory
- Separate GitHub Pages and Azure Functions deployment workflows

## Data handling

1. Keep the source CSV out of the public repository.
2. Run `python scripts/convert_csv_to_json.py`. This creates `private/players.json`, which is ignored by Git.
3. Create a private Azure Blob container. Do not enable anonymous/public access.
4. Set `PLAYER_DATA_STORAGE_ACCOUNT_URL` and `PLAYER_DATA_CONTAINER`, then run `npm run upload:data`. The signed-in Azure identity needs Storage Blob Data Contributor on the container.
5. Set the Function App managed identity's Storage Blob Data Reader role on that container. Configure `PLAYER_DATA_BLOB_URL` as the full URL to `players.json` in the Function App settings.
6. Copy [apps-script/ProjectionApi.gs](apps-script/ProjectionApi.gs) into the original Apps Script project. In Apps Script Project Settings, add a Script Property named `PROJECTION_API_KEY` with a strong random secret. Deploy it as a web app that runs as the spreadsheet owner and accepts requests from anyone; the endpoint rejects calls without the secret. Do not put this key in the frontend or Git.

The function uses the local ignored `private/players.json` when `PLAYER_DATA_BLOB_URL` is not set, which supports local development. Never add the CSV or generated JSON to Git, a public storage container, or the `public/` directory.
The Apps Script workbook's Players sheet and the private JSON uploaded to Blob must come from the same player-data export; the roster endpoint and projection endpoint must recognize the same names.

## Deploy

1. Create the Azure Function App using the Node.js v4 programming model and Node.js 20 or later. Enable its system-assigned managed identity and configure the Blob reader role and `PLAYER_DATA_BLOB_URL` setting.
2. Deploy the Apps Script web app described above. Configure `SPREADSHEET_PROJECTION_URL` with its `/exec` URL and `SPREADSHEET_PROJECTION_KEY` with the same secret in Function App settings. Keep both settings server-side.
3. In GitHub repository settings, add the `AZURE_FUNCTIONAPP_NAME` repository variable and `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` secret. The API workflow deploys the function app from the repository root.
4. Set the allowed CORS origin on the Function App to the exact GitHub Pages origin (for example, `https://account.github.io`).
5. Set the `lineup-api-base-url` meta tag in `public/index.html` to `https://<function-app>.azurewebsites.net/api`.
6. In repository Settings > Pages, set the build and deployment source to **GitHub Actions**. This one-time setup is required before `actions/configure-pages` can find the Pages site. The existing Pages workflow publishes only `public/`.

The API workflow always runs its tests. It deploys only when both `AZURE_FUNCTIONAPP_NAME` and `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` are configured; otherwise it succeeds with an explicit deployment-skipped summary.

### Early test release

The intended repository is `https://github.com/a12-25/Lineup-Tool.git`. Publish the contents of this `converted/` folder as the repository root, not the parent workspace: the parent contains the source CSV and Apps Script reference files. The Actions workflows are ready, but the real-player release is not live until the Azure Function, private Blob data, Apps Script bridge, GitHub Actions settings, and frontend API URL above are configured. The demo at `?demo=1` uses fictional data only.

## Local development

Install Node.js 20+, Azure Functions Core Tools v4, and Azurite, then install dependencies with `npm install`. Convert the CSV into ignored local JSON with `python scripts/convert_csv_to_json.py`, copy `local.settings.example.json` to `local.settings.json`, and fill in the Apps Script `/exec` URL and matching secret in that ignored file. Start Azurite and the API with `npm start`. Serve `public/` with any static web server and set the API base URL to `http://localhost:7071/api` while developing locally. Run `npm test` and `npm run check` for validation. Never commit `local.settings.json`.

### Manual frontend preview

Open `public/index.html` directly in a browser and add `?demo=1` to its URL. This uses clearly labeled fictional players and mock results to test the selectors and result rendering without Node.js, Azure, or the private dataset. It does not test API integration or real calculations.

The dashboard follows the lineup sheet: projection and performance sections occupy the main column, while a player selector and seven collapsible profile sections stay in a compact side panel. On mobile, the profile is an off-canvas drawer opened by the fixed Player Profile button and dismissed by Close, the backdrop, or Escape. The profile selector is limited to the five submitted lineup players.

Net Rating Over Time uses the same pure 24-minute stint simulation as `GRAPH_Calculations.gs`, with 25 points for minutes 0 through 24. Positive and negative portions have separately themed line and area colors. Hover or drag along the line for a temporary signed value; select a minute point to pin it until the chart background is clicked or tapped.

The API preserves the spreadsheet's groups: overview ratings; offensive projections (shot balance, offensive rebounding, OFF rating, 3P%, TS%); defensive projections (opponent TS%, defensive rebounding, DEF rating, turnover creation, rim protection); five optimal-usage outputs; player performance (OFF, DEF, LOAD, FIT); and the selected player's bio, offensive/defensive load, shot profile, efficiency, expected defense, and expected impact. Percentage values are normalized to fractions in JSON and rendered as percentages in the browser.

## Privacy limits

- The API never returns the complete `raw` records; its roster endpoint returns names and positions, and its lineup endpoint returns calculations plus a sanitized profile for the selected lineup player. OFF, DEF, NET, and the four Lineup Overview ratings come from the spreadsheet's projection formulas, not averages of individual DPM values.
- Profile values are visible to the user who selects that player. Because the API is public, users can repeat requests for different lineups and collect profile values. This architecture prevents a one-request download of the complete source file; it does not make displayed player stats secret. Require authenticated access or omit those fields if that stronger restriction is necessary.
- The GitHub Pages frontend and public source code must not contain the player CSV, generated dataset, storage credentials, or Function publish profile.
- The original `.gs` spreadsheet files remain the business-logic reference and should not be added to a public repo unless intended.
