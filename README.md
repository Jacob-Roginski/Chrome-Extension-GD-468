# Terms Lens

Terms Lens finds a site's Terms of Service page and flags common areas worth a closer read. Analysis runs locally in the extension; page text is not sent to a server. It is an educational review aid, not legal advice.

## Files

- `manifest.json` - Extension configuration and permissions
- `background.js` - Notifications and tab-level analysis cache
- `content.js` - Terms link discovery and local text analysis
- `popup.html` / `popup.js` - Review panel

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository folder:
   `/workspaces/Chrome-Extension-GD-468`

## Automatic site testing

Open any regular website and click the Terms Lens toolbar icon. The extension
automatically uses the active tab, finds a Terms of Service link, fetches that
document, and reviews it locally. If the page has no matching link, it also
tries common paths such as `/terms` and `/terms-of-service`.

The extension works best on regular web pages. Chrome internal pages and sites that block extension scripts cannot be scanned.