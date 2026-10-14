"""Codespace-only local proxy for the Terms Lens test browser."""

from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urljoin, urlparse
from urllib.request import Request, urlopen
import json
import re

MAX_BYTES = 5 * 1024 * 1024
TERM_LINK_WORDS = re.compile(r"terms(?:\s+of\s+service)?|conditions|user agreement|\btos\b", re.I)
TERM_PATHS = ("/terms", "/terms-of-service", "/legal/terms", "/legal/terms-of-service", "/legal")


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.headings = []
        self.links = []
        self.in_title = False
        self.skip_depth = 0
        self.title = ""
        self.active_heading = None
        self.active_link = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ("script", "style", "noscript", "svg"):
            self.skip_depth += 1
        if tag == "title":
            self.in_title = True
        if tag in ("h1", "h2"):
            self.headings.append([])
            self.active_heading = len(self.headings) - 1
        if tag == "a" and attrs.get("href"):
            self.links.append((attrs["href"], []))
            self.active_link = len(self.links) - 1

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript", "svg") and self.skip_depth:
            self.skip_depth -= 1
        if tag == "title":
            self.in_title = False
        if tag in ("h1", "h2"):
            self.active_heading = None
        if tag == "a":
            self.active_link = None

    def handle_data(self, data):
        if self.skip_depth:
            return
        clean = re.sub(r"\s+", " ", data).strip()
        if not clean:
            return
        self.parts.append(clean)
        if self.in_title:
            self.title += " " + clean
        if self.active_heading is not None:
            self.headings[self.active_heading].append(clean)
        if self.active_link is not None:
            self.links[self.active_link][1].append(clean)


def fetch(url):
    request = Request(url, headers={"User-Agent": "TermsLens-Codespace-Test/1.0"})
    with urlopen(request, timeout=15) as response:
        data = response.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise ValueError("The page is larger than the 5 MB test limit.")
        charset = response.headers.get_content_charset() or "utf-8"
        return response.geturl(), data.decode(charset, errors="replace")


def parse_page(html):
    parser = PageParser()
    parser.feed(html)
    return parser, " ".join(parser.parts)


def looks_like_terms(parser, text):
    header = f"{parser.title} {' '.join(' '.join(item) for item in parser.headings)}"
    body = text[:5000]
    legal_signals = (
        r"governing law|jurisdiction|arbitration|limitation of liability",
        r"intellectual property|user content|account termination",
        r"privacy|personal information|third[- ]party",
    )
    signal_count = sum(bool(re.search(signal, body, re.I)) for signal in legal_signals)
    return len(text) >= 300 and (
        re.search(r"\bterms?\b|\bconditions?\b|user agreement|\btos\b", header, re.I)
        or re.search(r"terms of service|terms and conditions|these terms|user agreement", body, re.I)
    ) and signal_count >= 2


def find_terms(base_url, parser):
    base = urlparse(base_url)
    candidates = []
    for href, label_parts in parser.links:
        label = " ".join(label_parts)
        if not TERM_LINK_WORDS.search(f"{label} {href}"):
            continue
        candidate = urljoin(base_url, href)
        parsed = urlparse(candidate)
        if parsed.scheme in ("http", "https"):
            score = (20 if parsed.netloc == base.netloc else 0) + (10 if re.search(r"\bterms?\b|\btos\b", f"{label} {href}", re.I) else 0)
            candidates.append((score, candidate))
    candidates.extend((15, urljoin(base_url, path)) for path in TERM_PATHS)
    seen = set()
    for _, candidate in sorted(candidates, reverse=True):
        if candidate in seen or candidate == base_url:
            continue
        seen.add(candidate)
        try:
            final_url, html = fetch(candidate)
            terms_parser, text = parse_page(html)
            if looks_like_terms(terms_parser, text):
                return final_url, text
        except Exception:
            continue
    return None, None


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/api/fetch"):
            try:
                url = parse_qs(urlparse(self.path).query).get("url", [""])[0]
                parsed = urlparse(url)
                if parsed.scheme not in ("http", "https") or not parsed.netloc:
                    raise ValueError("Enter a complete http or https URL.")
                final_url, html = fetch(url)
                parser, text = parse_page(html)
                terms_url, terms_text = find_terms(final_url, parser)
                payload = {"url": final_url, "html": html, "text": text, "termsUrl": terms_url, "termsText": terms_text}
                self.send_response(200)
            except Exception as error:
                payload = {"error": str(error)}
                self.send_response(502)
            body = json.dumps(payload).encode()
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:8765")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, format, *args):
        print(f"[test-browser] {format % args}")


if __name__ == "__main__":
    print("Terms Lens Test Browser: http://127.0.0.1:8765/test-browser.html")
    ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
