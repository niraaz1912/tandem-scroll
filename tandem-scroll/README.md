# Tandem Scroll

Tandem Scroll is a Chrome/Edge extension that pairs two browser tabs—even when they are in separate windows—and keeps their page scrolling synchronized in both directions.

## What it does

- Pairs the current tab with any other regular website tab.
- Syncs by **scroll percentage**, so pages of different lengths stay proportionally aligned.
- Works in either direction: scrolling either page moves its partner.
- Defaults to vertical scrolling, with an option to sync horizontal movement too.
- Lets you pause, resume, focus the partner tab, or unpair from the popup.
- Restores the pair after an extension service worker restart and clears it when the browser session ends.
- Keeps all pairing and scroll-position data inside the browser.

## Install locally

1. Download and unzip `tandem-scroll.zip`.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Turn on **Developer mode**.
4. Choose **Load unpacked** and select the unzipped `tandem-scroll` folder.
5. Pin **Tandem Scroll** to the toolbar if you want quick access.

## Use it

1. Open the two pages you want to compare. They may be in separate browser windows.
2. Open Tandem Scroll from the first page.
3. Select the second tab. Active tabs in other windows are listed first.
4. Choose **Pair selected tabs**.
5. Scroll either page.

The second page aligns to the first page immediately after pairing. The toolbar badge shows `↕` while the pair is live and `II` while it is paused.

## Permissions

- **Tabs**: lists the tabs you can choose and identifies the paired tab.
- **Storage**: remembers active pairs for the current browser session.
- **Scripting / website access**: reads and applies the top-level page scroll position on the two selected tabs.

No analytics, remote services, or network requests are included.

## Current limitations

- Browser pages such as `chrome://settings`, extension pages, and the Chrome Web Store block content scripts and cannot be paired.
- Local `file://` pages require **Allow access to file URLs** in the extension details.
- The extension syncs the main page viewport. A site that scrolls only inside a custom nested panel may not move.
- Browser PDF viewers and other protected viewers may block synchronization.
- On very different pages, proportional alignment is approximate by design.

## Development

The project has no runtime or development dependencies. With Node.js 20 or newer:

```bash
npm run check
```

This validates the manifest and referenced assets, checks JavaScript syntax, and runs the pairing and scroll-math tests.

## Project structure

```text
tandem-scroll/
├── manifest.json
├── background.js          # Pair state, routing, and tab lifecycle
├── content.js             # Scroll observation and application
├── pairing.js             # Pure pair-state helpers
├── shared/scroll-math.js  # Proportional scroll calculations
├── popup/                 # Pairing and settings interface
├── assets/                # Extension icons
└── tests/                 # Node test suite
```

## License

MIT
