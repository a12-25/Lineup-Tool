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
- [x] Add a read-only Apps Script JSONP path for GitHub Pages
- [x] Add GitHub Pages and Azure Functions deployment workflows
- [x] Keep generated full player JSON out of the public assets and Git
- [x] Publish the converted folder contents to `https://github.com/a12-25/Lineup-Tool.git`
- [x] Add README and project documentation for the public repo
- [ ] Deploy the Apps Script web app and set `spreadsheet-projection-url` to its `/exec` URL
- [ ] Optionally configure Azure Functions and private Blob storage as a server-side proxy
- [x] In repository Settings > Pages, set the build and deployment source to GitHub Actions
- [x] Verify the source CSV and original spreadsheet files are excluded from the published converted-folder repository

## Recommended deployment path

1. Publish only the contents of `converted/` to `https://github.com/a12-25/Lineup-Tool.git`; do not include parent-folder CSV or Apps Script sources in the public repo.
2. Deploy the Apps Script web app and set its `/exec` URL in the frontend meta tag.
3. Configure the Azure proxy only if server-side secrets or additional request controls are required.
4. Enable GitHub Pages with GitHub Actions as its source; the included workflow publishes `public/`.
5. Confirm no source CSV, full JSON dataset, local settings, secrets, or spreadsheet export is included in the public repository.

## Early Test Release Status

- [x] Pages and Functions workflows are present.
- [x] Full player JSON is excluded from Git and static assets.
- [x] Git push to the requested repository as `a12-25`.
- [x] Publish all 492 player names/positions/eligible slots on GitHub Pages without player stat fields.
- [ ] Deploy the Apps Script JSONP web app and set its public `/exec` URL in `public/index.html` to enable real lineup calculations.
- [ ] Optionally configure Azure Functions/Blob and GitHub deploy settings if using the proxy path.

## Important notes

- Complete stat rows stay in the private spreadsheet/Apps Script backend or optional private Blob storage; Pages exposes only names, positions, and eligible slots.
- Public API outputs can still be observed and inferred by app users; only raw records are withheld.
- The original spreadsheet files remain the reference implementation and should not be published accidentally.
