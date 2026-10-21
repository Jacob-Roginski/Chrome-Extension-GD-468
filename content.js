const TERM_LINK_WORDS = /terms(?:\s+of\s+service)?|conditions|user agreement|\btos\b/i;
const TERM_PATHS = ['/terms', '/terms-of-service', '/legal/terms', '/legal/terms-of-service', '/legal'];
const TERM_PAGE_WORDS = /\bterms?\b|\bconditions?\b|user agreement|\btos\b/i;
const SEARCH_ENGINE_HOSTS = new Set([
  'www.google.com', 'google.com', 'www.bing.com', 'bing.com', 'duckduckgo.com',
  'www.duckduckgo.com', 'search.yahoo.com', 'search.brave.com', 'www.baidu.com',
  'www.yandex.com', 'www.ecosia.org', 'www.startpage.com'
]);

function findTermsCandidates() {
  const origin = location.origin;
  const linkedCandidates = [...document.querySelectorAll('a[href]')].flatMap((link) => {
    try {
      const href = new URL(link.href);
      const linkText = `${link.textContent} ${link.getAttribute('href')}`;
      if (!['http:', 'https:'].includes(href.protocol) || !TERM_LINK_WORDS.test(linkText)) return [];
      return [{
        href: href.href,
        label: link.textContent.trim() || 'Terms of Service',
        score: (href.origin === origin ? 20 : 0) + (/\bterms?\b|\btos\b/i.test(linkText) ? 10 : 0)
      }];
    } catch (error) {
      return [];
    }
  });
  const pathCandidates = TERM_PATHS.map((path) => ({
    href: new URL(path, location.origin).href,
    label: 'Terms of Service',
    score: 15
  }));
  const unique = new Map();
  [...linkedCandidates, ...pathCandidates].forEach((candidate) => {
    if (!unique.has(candidate.href) || unique.get(candidate.href).score < candidate.score) {
      unique.set(candidate.href, candidate);
    }
  });
  return [...unique.values()].sort((first, second) => second.score - first.score);
}

function extractPageText(html) {
  const pageDocument = new DOMParser().parseFromString(html, 'text/html');
  const title = pageDocument.title || '';
  const headings = [...pageDocument.querySelectorAll('h1, h2')]
    .map((heading) => heading.textContent)
    .join(' ');
  const text = pageDocument.body?.innerText?.replace(/\s+/g, ' ').trim() || '';
  return { title, headings, text };
}

function isTermsPage(page) {
  const header = `${page.title} ${page.headings}`;
  const body = page.text.slice(0, 5000);
  const legalSignals = [
    /governing law|jurisdiction|arbitration|limitation of liability/i,
    /intellectual property|user content|account termination/i,
    /privacy|personal information|third[- ]party/i
  ];
  const hasTermsHeading = TERM_PAGE_WORDS.test(header);
  const hasTermsPhrase = /terms of service|terms and conditions|these terms|user agreement/i.test(body);
  const legalSignalCount = legalSignals.filter((signal) => signal.test(body)).length;
  return page.text.length >= 300 &&
    (hasTermsHeading || hasTermsPhrase) &&
    legalSignalCount >= 2;
}

async function findTermsPage() {
  for (const candidate of findTermsCandidates()) {
    if (candidate.href === location.href) continue;
    try {
      const response = await fetch(candidate.href, { credentials: 'include' });
      if (!response.ok) continue;
      const page = extractPageText(await response.text());
      if (isTermsPage(page)) {
        return {
          href: response.url || candidate.href,
          label: candidate.label,
          text: page.text
        };
      }
    } catch (error) {
      // Try the next official candidate if this page blocks extension requests.
    }
  }
  return null;
}

async function findToSDrData() {
  try {
    return await TermsLensToSDr.lookup(location.hostname);
  } catch (error) {
    console.warn('FinePrint could not load ToS;DR data.', error);
    return { error: 'ToS;DR data is unavailable right now.' };
  }
}

function isSearchEngine() {
  return SEARCH_ENGINE_HOSTS.has(location.hostname.toLowerCase());
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

function showInlineReview(result) {
  if (isSearchEngine() || document.querySelector('#terms-lens-review')) return;

  const host = document.createElement('aside');
  host.id = 'terms-lens-review';
  const root = host.attachShadow({ mode: 'closed' });
  const flags = result.concerns.length;
  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .panel {
      position: fixed; z-index: 2147483647; right: 22px; bottom: 22px; width: 312px;
      box-sizing: border-box; padding: 18px; border: 1px solid #d6d0cb;
      border-radius: 14px; background: #f7f5f3; color: #1a1f25;
      box-shadow: 0 16px 42px rgba(26, 31, 37, .2);
      cursor: pointer;
      font: 13px/1.4 Inter, "Segoe UI", Helvetica, Arial, sans-serif;
      letter-spacing: -.02em;
    }
    .top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .label { margin: 0 0 6px; color: #565f5b; font-size: 10px; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; }
    h2 { margin: 0; color: #1a1f25; font-size: 19px; line-height: 1.1; letter-spacing: -.01em; }
    .close { border: 0; background: transparent; color: #565f5b; cursor: pointer; font-size: 22px; line-height: .8; padding: 2px; }
    .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 18px; }
    .metric { min-width: 0; padding: 13px 12px 12px; border: 1px solid #d6d0cb; border-radius: 10px; background: #f3f0ee; }
    .metric.rating { border-color: #ef6a6d; background: #fff0ef; }
    .metric-label { display: block; color: #565f5b; font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
    .number, .rating-value { display: block; margin-top: 5px; color: #1a1f25; font-size: 28px; line-height: 1; font-weight: 900; letter-spacing: -.06em; }
    .rating-value { color: #c94f56; font-size: 24px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .footer { margin: 14px 0 0; padding-top: 12px; border-top: 1px solid #d6d0cb; color: #565f5b; font-size: 11px; letter-spacing: .01em; }
    .footer strong { color: #1a1f25; }
  `;
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.setAttribute('role', 'button');
  panel.setAttribute('tabindex', '0');
  panel.setAttribute('aria-label', 'Open the full FinePrint review');
  const rating = result.tosdr?.rating || 'N/A';
  panel.innerHTML = `
    <div class="top"><div><p class="label">FinePrint review</p><h2>Site review complete</h2></div><button class="close" aria-label="Dismiss">×</button></div>
    <div class="metrics">
      <div class="metric"><span class="metric-label">Issues found</span><strong class="number">${flags}</strong></div>
      <div class="metric rating"><span class="metric-label">ToS;DR rating</span><strong class="rating-value">${escapeHtml(rating)}</strong></div>
    </div>
    <p class="footer">${result.tosdr?.name ? `<strong>${escapeHtml(result.tosdr.name)}</strong> · click to open the full review` : 'Click to open the full review'}</p>
  `;
  root.append(style, panel);
  const openReview = () => {
    chrome.runtime.sendMessage({ type: 'open-review' });
    host.remove();
  };
  panel.addEventListener('click', (event) => {
    if (event.target.closest('a, button')) return;
    openReview();
  });
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openReview();
    }
  });
  panel.querySelector('.close').addEventListener('click', () => host.remove());
  document.documentElement.append(host);
}

async function scan() {
  let text = document.body?.innerText || '';
  const termsPage = await findTermsPage();
  const termsLink = termsPage ? { href: termsPage.href, label: termsPage.label } : null;
  if (termsPage) text = termsPage.text;

  const result = {
    hostname: location.hostname.replace(/^www\./, ''),
    termsUrl: termsLink?.href || null,
    termsLabel: termsLink?.label || null,
    tosdr: await findToSDrData(),
    ...TermsLensScanner.analyze(text)
  };
  chrome.runtime.sendMessage({ type: 'terms-found', result });
  showInlineReview(result);
  return result;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'scan-now') {
    scan().then(sendResponse);
    return true;
  }
});

scan();