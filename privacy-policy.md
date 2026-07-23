# PairPane Privacy Policy

**Effective version:** PairPane 1.0.1  
**Last updated:** July 22, 2026

PairPane is a local-first Chrome extension for aligning, comparing, and reviewing two pages selected by the user. PairPane has no account system, advertising, behavioral analytics, remote executable code, or PairPane-operated backend.

## Information PairPane handles

PairPane handles information only as needed for a feature the user invokes.

### Active comparison sessions

PairPane temporarily stores paired tab identifiers, scroll positions, scrolling-panel identities, alignment points, permission state, and active tool state in `chrome.storage.session`. This information normally ends with the browser session.

### Smart Align

After the user invokes Smart Align, PairPane reads bounded page headings, heading IDs, hierarchy, and local positions. The information is compared locally to propose explainable alignment points. It is not sent to PairPane servers.

### Difference Lens

After the user invokes Difference Lens, PairPane reads bounded visible text blocks from the main page content. PairPane excludes inputs, textareas, selects, options, password fields, editable content, scripts, styles, `noscript` content, and hidden content. Extracted comparison text is transient unless the user explicitly adds a result to a saved review.

### Page Signals

After the user invokes Page Signals, PairPane reads limited document metadata including titles, headings, canonical links, descriptions, robots directives, language, Open Graph presence, and structured-data presence. Processing is local.

### Visible captures

PairPane captures the active tab’s visible page area only after an explicit user action. A capture can contain private information visible on the page. PairPane provides preview, crop, blur, solid-mask redaction, retention, and deletion controls.

Capture image blobs are stored in extension-owned IndexedDB. Lightweight capture metadata and indexes are stored in `chrome.storage.local`. New captures default to session retention unless the user chooses another retention period or explicitly attaches the capture to a saved review or report.

### Saved profiles, Review Runs, and reviews

PairPane can persist the following locally when requested:

- Environment names, exact origins, and path-prefix mappings.
- Explicitly allowlisted query keys.
- Dynamic-content ignore rules.
- Route sets and Review Run progress.
- Pass, Fail, N/A, and open statuses.
- Severity, notes, route labels, page URLs, and capture references.
- User preferences such as capture retention and status-chip position.

PairPane rejects credential-like query keys such as passwords, tokens, secrets, session identifiers, authorization values, and API keys.

## Permissions

- `activeTab` grants temporary access after the user invokes PairPane on a selected page.
- `scripting` injects packaged PairPane code only into selected pages.
- `storage` keeps session state and explicitly saved local information.
- `sidePanel` hosts the persistent comparison workspace.
- Optional host access may be requested for the two exact origins displayed in a saved profile. It is off by default and can be revoked per profile.

PairPane does not request broad host access at installation.

## Data transmission

PairPane does not automatically transmit page text, captures, browsing URLs, review notes, or profile data to a PairPane server. Core extension features contain no runtime network client.

When a user exports and saves or shares a report, the exported file leaves PairPane’s control. The export preview lists included routes, URLs, notes, statuses, and capture references. Query strings are stripped by default; only explicitly approved profile query keys may be retained when the user changes that setting.

## Analytics

PairPane does not use behavioral analytics or page-level browsing telemetry. Performance measurements and workflow counters, where present, remain local unless the user explicitly creates and shares sanitized diagnostics. Diagnostics exclude browsing URLs, page text, screenshots, and notes.

## User control

The **Privacy and local data** settings view shows local storage usage by category and provides scoped deletion for:

- Captures.
- Reviews.
- Profiles.
- Route sets and Review Runs.
- All persistent local data.

Users can preview and delete individual captures, rebuild the capture index, revoke optional origin access, clear transient comparisons, and export selected review information.

## Security boundaries

PairPane does not synchronize clicks, typing, form values, file inputs, authentication, payments, destructive actions, or form submissions. Path Sync performs only safe route navigation within explicitly saved origins.

## Changes

Material privacy changes must update this policy and the Chrome Web Store disclosures before release. Features that introduce remote processing, accounts, or third-party integrations require separate, explicit disclosure and user consent.
