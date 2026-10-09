# PAM API Report
Next.js App Router + TypeScript + Tailwind CSS. Local read-only workspace for the seven miniOrange PAM API categories.

## Run
```powershell
npm install
npm run dev
```
Open http://127.0.0.1:3000 for the live executive A4 report. The same report is available at /executive-report; the Resources report remains at /resources-report and the seven-category workspace at /reports.

Run npm run dev from this project directory. Only one dev server can run for this project at a time.

## Configure
Edit .env.local:
- PAM_BASE_URL: https://pam3.lab2.trac
- PAM_CLIENT_ID: preconfigured
- PAM_CLIENT_SECRET: enter locally
- PAM_CUSTOMER_ID: actual PAM organization/tenant ID; 10001 in the vendor guide is only an example.

Restart the server after changing environment variables. No credentials or tokens are returned to the browser. .env files are ignored by Git.

Internal CA: obtain the organization CA in PEM format and set NODE_EXTRA_CA_CERTS before starting Node, e.g. `$env:NODE_EXTRA_CA_CERTS = 'C:\\certs\\lab-ca.pem'`. TLS verification stays enabled. Do not use NODE_TLS_REJECT_UNAUTHORIZED=0.

## Features
- Attempt GET for the seven documented categories and show their actual statuses; successful data retrieval depends on the installed PAM endpoints.
- Server-only client credentials token exchange; token cached in memory with expiry and one retry for HTTP 401.
- Display upstream HTTP status with guidance, without exposing credentials or raw upstream errors.
- Sensitive JSON fields redacted server-side.
- A4 print layouts for the current category or all seven; use browser Print / Save as PDF.
- Generic table and JSON view because response schemas have not yet been verified on the installation.
- The executive report paginates Users, Groups and Resources using their verified list response contracts, with a 100-page ceiling and explicit completeness status.
- No inferred user-to-machine ownership/allocation; the seven-category guide does not document that relationship endpoint.

## Endpoints
Reference: https://www.miniorange.com/pam/admin-docs/client-credentials
Token: POST /pam/apps/autheticate/oauth/token-generation/
Read header: Authorize: Bearer <token> (vendor spelling).
The vendor token example has an extra slash after the host; this app uses one slash.
Endpoints still need validation against the installed PAM version.

## Scope
This is a local workspace, bound to loopback by default. It has no application login and is not intended to be exposed on a shared network without adding authentication.

## Checks
```
npm run typecheck
npm run build
```

## Check the configured PAM API
Run `npm run check:api` to check configuration and read the seven documented API categories. This command reports status and shape only; it does not print credentials, access tokens, or record contents. Fill actual values in `.env.local`, not `.env.example`.

## Resources report

The /resources-report page shows the A4 Resources report. Click the refresh button to fetch live API data, or run npm run refresh:report. The report fetches live API data on every page request and refresh. Diagnostic JSON files in data/ are not used as report inputs. Unknown resource totals are shown as unavailable, not zero. All Resources uses /pam/apps/resources/ with zero-based page and limit; the PAM front end uses /assets/asset/?asset_id= for individual details. The Users endpoint needs page, page_size, search and filter_by.

PAM_CUSTOMER_ID=10001 was confirmed by a successful token response. PAM_TLS_CERT_SHA256 pins the leaf certificate fingerprint supplied by the user, verifies the hostname and validity period before any HTTP request, and applies only to PAM_BASE_URL. When the server certificate changes, confirm and update the fingerprint or use the organization CA via NODE_EXTRA_CA_CERTS.

## Executive report

Six sections cover overview, Users, roles embedded in Users, Groups and their members, Resources/allocation, and API diagnostics. Long lists continue on additional A4 pages. The report joins Group.users IDs to actual User.id values and does not infer machine ownership. Groups are read from /pam/apps/groups/groups/ with zero-based pagination; the singular documented /group/ endpoint returned 500 in the tested requests. JSON download is user-initiated and redacted; no datasets are automatically written to disk.

Run `npm run check:report` for live counts, completeness, group-member matching counts and HTTP diagnostics without printing row contents. See docs/report-plan.md for the report plan and outstanding upstream issues.

Resource detail selection: add `assets`, `applications`, and/or `webApps` comma-separated IDs to the report URL, or use the expandable selection form. IDs must come from actual inventory; source code contains no seeded inventory. The report fetches `/assets/asset/?asset_id=...` and `/apps/app/?app_id=...` live for the selected records. This supplements the unavailable list endpoint without claiming system-wide completeness. The CLI accepts the same query as its first argument. Group details are checked using live group IDs and ticket automation is read separately from ticket records.

Home-page selection defaults are configured in `.env.local` with `PAM_REPORT_ASSET_IDS`, `PAM_REPORT_APPLICATION_IDS`, and `PAM_REPORT_WEB_APP_IDS`. These store request IDs only; every visit and refresh fetches record data from PAM. URL parameters override the defaults, including empty values to clear a category. Restart the dev server after changing these settings.

The executive report now includes resource subtype/active summaries from successful details, boolean capability counts from roles embedded in Users, and per-resource allocation checks even when the aggregate Resources list fails. Roles, System Users, Tickets and Certificates have dedicated source-status pages. Unknown allocations remain unknown; failed requests do not mean no users are assigned. Additional source responses, group details and ticket settings are included in the redacted JSON download when available. Supplemental list queries do not yet assert complete pagination; their received rows are identified as partial evidence.

Run `npm run check:items` for read-only individual API diagnostics. Asset/App/WebApp IDs come from report configuration; Group and Role IDs come from live API responses. Optional `systemUsers` and `tickets` query parameters accept actual inventory IDs supplied by the operator. No ID ranges are scanned. The command prints HTTP status, field names and identity-match results, never record values or tokens. The Role `role_id` parameter remains under verification while its requests fail; a 500 response does not validate the parameter. Certificates are skipped until a detail URL and actual IDs are verified.

## Management report and discovery

The home page now groups data into five management sections: overview, inventory with subtype/active/allocation information, Users with roles, Groups with role access summaries, and the monthly-report readiness/follow-up page. Endpoint/HTTP appendices are optional; technical details remain available on screen and in the redacted JSON download.

`PAM_REPORT_DISCOVERY_MAX_ID` configures the default bounded Asset/App ID discovery range (currently 100). The report form or `?scanTo=1000` expands discovery up to ID 1000; `?scanTo=0` disables range discovery. Four GETs run concurrently per resource type. Only responses matching the requested ID become inventory rows. Failed discovery requests are retained as metadata, never treated as missing inventory proof. Inventory-derived references beyond the discovery range are also fetched, with a 2000-detail-per-type ceiling that is disclosed as incomplete when reached. Range discovery can take time: the live 1–1000 test took about 86 seconds and found the same seven Assets/two Apps. It does not establish global completeness or bypass permissions.

`month=YYYY-MM` selects a document reporting period only. All inventory remains a live current-state snapshot. The verified frontend Audit GET route is `/pam/apps/audits/generate-reports/`, with report types `asset_allocation_user_audit`, `asset_allocation_group_audit`, and `asset_allocation_role_audit`; all returned 403 with the configured OAuth client. Date-filter semantics and full audit pagination remain unverified. The report never interprets current inventory as historical month-end state or invents monthly activity metrics. No snapshots are written automatically.
