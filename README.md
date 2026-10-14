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
automatically uses the active tab, discovers the site's Terms of Service link,
fetches and validates the linked document, and reviews that document locally.
If the page has no usable matching link, it also checks official same-site
paths such as `/terms` and `/terms-of-service` before falling back to the
visible page.

After a regular site loads, a compact in-page review panel appears
automatically. Search engines are excluded so normal searching is not
interrupted. The toolbar popup remains available for the full review and
manual rescans. Click the in-page panel to open the full review in an
extension tab; the panel dismisses after opening. Chrome does not allow
extensions to programmatically open the toolbar popup, so the in-page panel
opens the extension review in a tab instead.

Each finding includes a severity label, the specific clause text that matched,
and focused questions to check. This is more useful than counting keywords:
the extension searches the site's linked Terms candidates and official
same-site Terms paths, rejects pages that do not look like a Terms document,
extracts readable text, and shows the evidence behind each rule. It remains a
local educational review, not legal advice.

The extension works best on regular web pages. Chrome internal pages and sites that block extension scripts cannot be scanned.