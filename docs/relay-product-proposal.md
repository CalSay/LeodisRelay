# RELAY by Leodis — initial product proposal

Draft 0.1 · 7 September 2026

**Status: exploratory proposal, parked for future discussion.** This captures the
direction discussed, not an approved full-suite build, launch commitment or final
architecture. Continue the existing reporting work; do not expand implementation
into accounting, billing or commercial onboarding on the strength of this draft.

## 1. Product vision

RELAY could develop from a site-reporting tool into a practical job-management
and business-administration product for sole traders and very small construction
businesses. Its working proposition is: **RELAY runs the paperwork around your
work.** The customer should not need Microsoft 365, SharePoint, an IT administrator,
an existing accounting package or their own server.

The full-suite ambition is long-term. The immediate reporting product remains
the foundation, with Leodis providing real operational testing. Sole traders
must independently validate the broader proposition: Leodis is not a substitute
for testing that audience's needs, terminology and willingness to pay.

## 2. Intended customer experience

A business creates an account, enters its details and starts working in a private
workspace. One person can operate everything without assigning artificial office,
reviewer or administrator departments. They can invite employees as they grow.

The possible end-to-end workflow is:

    Customer → Quote → Job → Record work and extras → Invoice → Track payment

Engineers use a mobile app; owners and office staff can also use a web browser.
Jobs, customers and straightforward action labels are likely to suit this audience
better than enterprise terminology. Final language requires customer testing.

## 3. Product scope and sequencing

### Current foundation and agreed adjacent scope

Site reports, issue follow-through, photographs, signatures, immutable submitted
reports, PDF generation and recovery of drafts. The agreed front-end backlog also
covers faster capture, reliable drafts, PM acknowledgement, issue navigation and
traceable corrections. Living project diaries and capacity for additional report
types are agreed directions; their detailed specifications remain open.

See [product-backlog.md](./product-backlog.md) for exact approvals and exclusions.
Client sign-off for undertaken variations is described separately in
[variation-signoff.md](./variation-signoff.md); that wording is not legally approved.

### Possible later small-business suite — not approved for implementation

- Customer and job records.
- Quotes and recorded acceptance.
- Site diaries, inspections and completion reports.
- Additional-work/variation records and client agreement.
- Invoices and payment-status tracking.
- Expense capture and basic commercial visibility.
- Data exports for an accountant, and optional accounting integrations.

Job management, invoicing and expense capture are not by themselves a complete
accounting system. A general ledger, bank reconciliation, payroll, statutory
reporting and tax submissions would be a separate, substantial product decision.
Do not market those capabilities until they exist and meet applicable requirements.

Earlier ideas for wider project tracking, procurement, budgets and retentions
remain possibilities, not a commitment to an enterprise construction platform.
Formal decision-request routing is parked; mandatory location hierarchies were
rejected because of setup and naming burdens. Do not revive them by implication.

## 4. Proposed hosted architecture

The preferred commercial direction is one hosted product, with independent
company workspaces, shared maintained code and company-specific configuration.
Leodis should be one customer of the product, not a separate code fork.

- RELAY-hosted data is the proposed authoritative commercial-product record.
- RELAY manages private evidence and PDF storage, server APIs and background jobs.
- Company membership and project permissions must govern every read, write,
  download, search, queued job and offline cache; test cross-company denial.
- Offer independent accounts, with Microsoft sign-in optional rather than required.
- Configure branding, report types, rates and signature statements per business.
- Keep app and backend releases compatible, including older installed mobile apps.

"One place" describes the customer experience, not a requirement to put everything
on one physical server. Database choice, hosting topology, storage provider,
identity service, region and scaling approach are still undecided. Do not carry
the Leodis pilot's €8–9 VPS assumption forward as a full commercial operating budget.

## 5. Microsoft's role

Microsoft integration is principally useful to Leodis and should not be a
prerequisite imposed on sole traders. The commercial proposal is an optional
connector, initially for SharePoint PDF filing/export rather than unrestricted
two-way synchronisation.

For Microsoft customers, a versioned provisioning package could create a dedicated
site and the necessary Lists, columns, indexes, libraries and folders. A guided
installer would capture resource IDs, verify access and support safe schema
upgrades. Appropriate tenant approval cannot be automated away. Separate privileged
setup from restricted everyday access to the chosen site.

**Unresolved Leodis decision:** the current pilot plan uses SharePoint Lists as
the authoritative issue store. This proposal does not silently change that plan.
Choose explicitly whether Leodis keeps that adapter or moves to hosted authority
with SharePoint as a destination. Never let two stores independently act as master.
The prototype is not yet connected to SharePoint, so integration boundaries can
still be established before tenant-specific assumptions become entrenched.

## 6. Official mobile distribution

The long-term commercial target includes one public iOS App Store listing and one
Google Play listing for RELAY by Leodis, alongside the desktop web application.
The existing app-store-free PWA remains the near-term Leodis pilot route.

Evaluate a small Capacitor proof of concept to reuse React interfaces and shared
logic. This is not a promise that the current Next.js application can simply be
uploaded to the stores: server routes and PDF workers remain hosted; the mobile
client needs appropriate authentication, secure credential storage, native camera
integration, persistent drafts and tested synchronisation. iOS builds require a
macOS/Xcode build environment, locally or through a suitable build service.

Store review, privacy disclosures, account management/deletion, reviewer access,
device testing and ongoing platform updates are part of delivery. A thin website
wrapper should not be assumed to pass review. App approval is not guaranteed.

## 7. Commercial model — undecided

Free app download with a paid business subscription is an initial hypothesis.
Possible allowances include active users and storage. Avoid incentives to ration
reports; make invited-recipient access practical. No prices, tiers, trial duration,
free plan, payment provider or white-labelling commitments have been agreed.

The earlier organisation-only web-billing proposal needs re-evaluation for sole
traders and individual subscriptions. App-store billing exceptions cannot be
assumed to cover the final model. Verify store rules in target markets before
designing purchase flows or estimating platform fees.

## 8. Readiness to sell

Required work extends beyond features: tenant isolation, dependable backups and
restore tests, account recovery, staff offboarding, data export, cancellation and
retention rules, monitoring, support, operational access controls and clear terms.
Costs include evidence storage, backups, email, identity, payment processing,
maintenance and support as well as hosting. Establish unit costs from realistic use.

Because Leodis also operates in construction, explain separation between the
contracting business and software operations, including customer-data access.
Brand/trademark/domain availability and the selling legal entity remain unchecked.

## 9. Suggested validation stages

1. Finish and validate the reporting loop at Leodis; record practical feedback.
2. Establish company-independent configuration and demonstrable data isolation.
3. Test the product with a few sole traders/small firms without Microsoft setup.
4. Validate one complete additional workflow, likely job-to-extra-work-to-billing,
   before committing to a full suite. Measure duplication removed and usage.
5. Prove the mobile packaging approach and decide the subscription model.
6. Pilot supported onboarding, then self-service onboarding and public store release.

These are suggested stages, not dates or approved delivery milestones. Discovery
and technical proofs can overlap; do not postpone critical feasibility checks
until a full product has been built.

## 10. Questions to reopen later

- Initial trade/customer segment and smallest genuinely useful paid product?
- Hosted versus SharePoint authority for Leodis specifically?
- Native packaging approach and realistic offline expectations?
- Initial report types and configuration boundaries?
- Invoicing only, accounting integration, or eventual full accounting?
- Pricing, individual subscriptions and store billing obligations?
- Hosting/data residency, identity, support model and operating budget?
- Customer ownership, exports, retention, legal entity and brand availability?

## Reference material checked during discussion

Provider policies and fees may change; recheck before implementation or launch.

- [Capacitor documentation](https://capacitorjs.com/docs)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Payments guidance](https://support.google.com/googleplay/android-developer/answer/10281818?hl=en)
- [Google Play user-data requirements](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en-GB)
- [Microsoft multitenant identity](https://learn.microsoft.com/en-us/entra/identity-platform/single-and-multi-tenant-apps)
- [SharePoint site templates](https://learn.microsoft.com/en-us/sharepoint/dev/declarative-customization/site-design-overview)
- [Selected SharePoint permissions](https://learn.microsoft.com/en-us/graph/permissions-selected-overview)
- [PnP provisioning templates](https://learn.microsoft.com/en-us/sharepoint/dev/solution-guidance/pnp-provisioning-tenant-templates)
- [HMRC Making Tax Digital for VAT](https://www.gov.uk/government/collections/making-tax-digital-for-vat)
