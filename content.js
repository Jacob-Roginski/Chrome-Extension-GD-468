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
    console.warn('Terms Lens could not load ToS;DR data.', error);
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
      position: fixed; z-index: 2147483647; right: 20px; bottom: 20px; width: 286px;
      box-sizing: border-box; padding: 16px; border: 1px solid #555b57;
      border-radius: 8px; background: #171a18; color: #f1f1ed;
      box-shadow: 0 12px 40px rgba(0, 0, 0, .28);
      cursor: pointer;
      font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .label { margin: 0 0 5px; color: #aeb4ae; font-size: 10px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; }
    h2 { margin: 0; font-size: 17px; letter-spacing: -.3px; }
    .close { border: 0; background: transparent; color: #aeb4ae; cursor: pointer; font-size: 20px; line-height: 1; padding: 0; }
    .score { display: flex; align-items: center; gap: 9px; margin-top: 15px; padding: 11px; border: 1px solid #3f4541; border-radius: 5px; background: #222624; }
    .number { color: #f1f1ed; font-size: 23px; font-weight: 800; }
    .score span { color: #b8beb8; font-size: 11px; }
    .details { margin: 12px 0 0; color: #b8beb8; font-size: 11px; }
    .issue { margin-top: 10px; padding-top: 10px; border-top: 1px solid #383d39; }
    .issue strong { display: block; color: #f1f1ed; font-size: 11px; }
    .issue span { display: block; margin-top: 3px; color: #aeb4ae; font-size: 10px; line-height: 1.35; }
    a { display: inline-block; margin-top: 12px; color: #f1f1ed; font-size: 11px; font-weight: 800; text-decoration: underline; text-underline-offset: 3px; }
  `;
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.setAttribute('role', 'button');
  panel.setAttribute('tabindex', '0');
  panel.setAttribute('aria-label', 'Open the full Terms Lens review');
  panel.innerHTML = `
    <div class="top"><div><p class="label">Terms Lens</p><h2>Site review complete</h2></div><button class="close" aria-label="Dismiss">×</button></div>
    <div class="score"><strong class="number">${flags}</strong><span>${flags === 1 ? 'review area flagged' : 'review areas flagged'}</span></div>
    <p class="details">${result.termsUrl ? 'Terms were found and examined locally.' : 'No Terms page was found; the visible page was reviewed.'}</p>
    ${result.concerns.slice(0, 3).map((concern) => `<div class="issue"><strong>${escapeHtml(concern.severity)}: ${escapeHtml(concern.title)}</strong><span>${escapeHtml(concern.check)}</span></div>`).join('')}
    ${result.termsUrl ? `<a href="${escapeHtml(result.termsUrl)}" target="_blank" rel="noreferrer">Open Terms ↗</a>` : ''}
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