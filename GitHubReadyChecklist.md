# GitHub Ready Checklist

The frontend and API are separated so the full player dataset can remain in private storage.

## Checklist

- [x] Spreadsheet-specific logic is separated from browser logic
- [x] Core business rules are organized into single-responsibility modules
- [x] Role assignment, load modeling, and profile logic are isolated
- [x] Frontend shell is separated from data logic
- [x] Project structure is modular and GitHub friendly
- [x] Add a real data source and serve roster labels/calculations through an API
- [x] Keep spreadsheet projection, usage, player-performance, and selected-profile outputs grouped by their sheet sections
- [x] Color only player performance OFF/DEF ratings using the 0-99 red-to-green scale; keep LOAD/FIT unchanged
- [x] Add GitHub Pages and Azure Functions deployment workflows
- [x] Keep generated player JSON out of the public assets and Git
- [ ] Publish the converted folder contents to `https://github.com/a12-25/Lineup-Tool.git`
- [x] Add README and project documentation for the public repo
- [ ] Configure the Azure Function App, private Blob container, managed identity, CORS, and GitHub deploy settings
- [ ] Deploy the secret-checked Apps Script projection bridge and configure its URL/key as server-side settings
- [ ] Verify the source CSV and all original spreadsheet files are excluded before publishing

## Recommended deployment path

1. Publish only the contents of `converted/` to `https://github.com/a12-25/Lineup-Tool.git`; do not include parent-folder CSV or Apps Script sources in the public repo.
2. Configure private Blob Storage, the Azure Function App, and the Apps Script bridge as described in the README.
3. Set the frontend API base URL and configure the GitHub Actions variable and secret.
4. Enable GitHub Pages with GitHub Actions as its source; the included workflow publishes `public/`.
5. Confirm no source CSV, full JSON dataset, local settings, secrets, or spreadsheet export is included in the public repository.

## Early Test Release Status

- [x] Pages and Functions workflows are present.
- [x] Full player JSON is excluded from Git and static assets.
- [ ] Git push to the requested repository. The current workspace has no `.git` directory and Git is unavailable in this environment.
- [ ] Configure Azure Function App, private Blob, and Apps Script projection endpoint. These live services/credentials are not available in this workspace.
- [ ] Configure `AZURE_FUNCTIONAPP_NAME`, `AZURE_FUNCTIONAPP_PUBLISH_PROFILE`, `SPREADSHEET_PROJECTION_URL`, and `SPREADSHEET_PROJECTION_KEY` in GitHub/Azure.
- [ ] Set `lineup-api-base-url` to the deployed Function API URL and verify a real-player submission.

## Important notes

- The complete dataset belongs only in a private Blob container and local ignored files.
- Public API outputs can still be observed and inferred by app users; only raw records are withheld.
- The original spreadsheet files remain the reference implementation and should not be published accidentally.
