# Operations dashboard draft — 9 September 2026

Draft: https://leodisdevelopments.sharepoint.com/sites/Operations/SitePages/Operations-Dashboard.aspx

Saved and reopened successfully; SharePoint displays **Draft**. This page has not been published or made the site home page. Publication is to wait until RELAY is complete and launch is authorized. The existing home page, navigation, lists, document locations and site theme were not changed.

## Included

- Custom dashboard masthead and section navigation without a personal author byline.
- Welcome text and links to RELAY, New project, New client and New small works.
- Paired Tender List and Active Works links to the existing Project Tracker views. Active Works currently includes Pending Start, Active and Defects Liability; no view filters changed.
- Reports to review, repairs awaiting verification, open issues and report delivery failures.
- Project folders, standard documents, general documents and project-based document finding.
- Office Hub, WarmFloors, Compliance Management and DSBSC links. The Good Heating Co. remains a labelled placeholder because the current site navigation entry has no destination URL.
- Three-column directory covering projects, service, clients, procurement, planning, reports and documents, plus supporting libraries/site tools.
- Section shading and extra space above Across the Group. Comments turned off for this navigation dashboard.

## Design implementation

The local approved concept is `designs/leodis-sharepoint-home-draft.html`; its companies section has a 36px top margin. The earlier native Text adaptation has been replaced by the custom SPFx Leodis Operations Dashboard component in `infra/sharepoint-dashboard`. Version 1.0.0.0 was enabled in the app catalogue and installed on Operations. The component occupies a single-column page section and uses Shadow DOM to preserve the approved light cards, colours and typography within the existing dark SharePoint site. SharePoint's surrounding header and navigation remain unchanged.

Directory search, category filters and section navigation are implemented. The production build and package validation passed. Local responsive checks covered 390px mobile and 820px tablet widths without content overflow. On the saved SharePoint draft, the actual card appearance, supplier search, search reset, company navigation and additional company spacing were checked. The page was reloaded and still displayed Draft.

No live metrics or new data integrations were added. Destination URLs were taken from the previously verified site/list inventory. Saved content and draft status were checked after reopening; not every destination was reopened during this build.

## Launch

Review the custom dashboard before launch. Confirm The Good Heating Co. URL, remove test/demo list data when appropriate, and confirm RELAY readiness. Publishing and making this page the home page are separate later actions, neither performed here.
