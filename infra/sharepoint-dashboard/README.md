# Leodis Operations Dashboard

Custom SharePoint Framework 1.23.2 web part reproducing the approved `designs/leodis-sharepoint-home-draft.html` concept. Shadow DOM isolates the light card design from SharePoint's site theme. Container queries adapt to the web part width. The web part makes no API calls, requests no API permissions and uses verified links to existing resources.

## Build

Use Node 22 (>=22.14, <23), as required by SPFx. From this directory run `node generate-content.cjs`, then `node configure-package.cjs`. In `leodis-operations-dashboard`, run `npm ci` and `npm run build`.

Package: `leodis-operations-dashboard/sharepoint/solution/leodis-operations-dashboard.sppkg`. A convenience copy is in repository `.deployment/leodis-operations-dashboard.sppkg`.

Run `node infra/sharepoint-dashboard/preview.cjs` from the repository for the component preview at http://127.0.0.1:4331/. It renders the same content and renderer used by the web part, inside a deliberately conflicting dark host theme to check isolation.

## Validation on 9 September 2026

- Production TypeScript, lint and Webpack build passed under Node 22.23.2.
- Solution packaging validated and succeeded. The generated Jest runner has no unit test suites; it did not supply additional test coverage.
- Browser checks: desktop appearance, 390px mobile (no content overflow, one-column project/directory cards), 820px tablet (no content overflow, two-column directory), search matching suppliers, combined category/search empty results, clear/reset restoring all six groups, section navigation and 36px companies top margin.
- No live metrics. The Good Heating Co. remains disabled pending a destination URL.

## Installation / draft

User explicitly authorized Microsoft 365/SharePoint administration and app catalogue installation for Operations, with the page remaining unpublished. Install through the app catalogue and add the app only to Operations (`skipFeatureDeployment: false`). Place **Leodis Operations Dashboard** on the unpublished Operations-Dashboard.aspx page, replacing the earlier text layout. Use a full-width section where available, or a full-page host. The web part does not alter global SharePoint chrome, site theme or navigation.

Version 1.0.0.0 is enabled in the app catalogue and installed on Operations. The component replaced the earlier Text layout on Operations-Dashboard.aspx in a single-column section. The saved page was reloaded and verified as Draft; actual SharePoint appearance, supplier search/reset, section navigation and company spacing were checked. The existing homepage remains unchanged. Never publish or make the page the home page as part of this draft work.
