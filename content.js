const TERM_LINK_WORDS = /terms(?:\s+of\s+service)?|conditions|user agreement|\btos\b/i;
const TERM_PATHS = ['/terms', '/terms-of-service', '/legal/terms', '/legal/terms-of-service', '/legal'];
const SEARCH_ENGINE_HOSTS = new Set([
  'www.google.com', 'google.com', 'www.bing.com', 'bing.com', 'duckduckgo.com',
  'www.duckduckgo.com', 'search.yahoo.com', 'search.brave.com', 'www.baidu.com',
  'www.yandex.com', 'www.ecosia.org', 'www.startpage.com'
]);

const CONCERN_RULES = [
  { title: 'Data sharing and tracking', pattern: /sell|share|disclos|advertis|third[- ]party|tracking|analytics|personal information/i, detail: 'Look for what data is shared, with whom, and whether advertising or analytics partners can combine it.' },
  { title: 'Automatic renewal or billing', pattern: /automatic(?:ally)? renew|recurring|subscription|cancel(?:lation)?|refund/i, detail: 'Check renewal timing, cancellation steps, trial conversion, and refund limits.' },
  { title: 'Arbitration and class-action waiver', pattern: /arbitration|class action|jury trial|dispute resolution/i, detail: 'These clauses can change how disputes are handled and may limit group or court actions.' },
  { title: 'Broad liability limits', pattern: /limitation of liability|not liable|as is|no warranty|indemnif/i, detail: 'Notice exclusions of warranties, damage caps, and obligations to defend or reimburse the company.' },
  { title: 'Unilateral changes or termination', pattern: /modify|change these terms|at any time|terminate|suspend|without notice/i, detail: 'See how the company can change the agreement, suspend access, or keep content after termination.' },
  { title: 'Governing law and venue', pattern: /governing law|jurisdiction|venue|laws of the state|laws of .* country/i, detail: 'The named law or location can affect where and how a dispute is resolved.' }
];

function findTermsLink() {
  const links = [...document.querySelectorAll('a[href]')];
  const match = links
    .filter((link) => {
      try {
        const href = new URL(link.href);
        return ['http:', 'https:'].includes(href.protocol) &&
          TERM_LINK_WORDS.test(`${link.textContent} ${link.getAttribute('href')}`);
      } catch (error) {
        return false;
      }
    })
    .sort((first, second) => {
      const firstText = `${first.textContent} ${first.getAttribute('href')}`;
      const secondText = `${second.textContent} ${second.getAttribute('href')}`;
      return Number(/terms|tos/i.test(secondText)) - Number(/terms|tos/i.test(firstText));
    })[0];
  return match ? { href: match.href, label: match.textContent.trim() || 'Terms of Service' } : null;
}

function analyze(text) {
  const concerns = CONCERN_RULES.filter((rule) => rule.pattern.test(text));
  return { concerns, concernCount: concerns.length, analyzedCharacters: text.length };
}

function isSearchEngine() {
  return SEARCH_ENGINE_HOSTS.has(location.hostname.toLowerCase());
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
    a { display: inline-block; margin-top: 12px; color: #f1f1ed; font-size: 11px; font-weight: 800; text-decoration: underline; text-underline-offset: 3px; }
  `;
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="top"><div><p class="label">Terms Lens</p><h2>Site review complete</h2></div><button class="close" aria-label="Dismiss">×</button></div>
    <div class="score"><strong class="number">${flags}</strong><span>${flags === 1 ? 'review area flagged' : 'review areas flagged'}</span></div>
    <p class="details">${result.termsUrl ? 'Terms were found and examined locally.' : 'No Terms page was found; the visible page was reviewed.'}</p>
    ${result.termsUrl ? `<a href="${result.termsUrl}" target="_blank" rel="noreferrer">Open Terms ↗</a>` : ''}
  `;
  root.append(style, panel);
  panel.querySelector('.close').addEventListener('click', () => host.remove());
  document.documentElement.append(host);
}

async function scan() {
  const pageLink = findTermsLink();
  const fallbackLinks = TERM_PATHS.map((path) => new URL(path, location.origin).href);
  const linksToTry = pageLink ? [pageLink] : fallbackLinks.map((href) => ({ href, label: 'Terms of Service' }));
  let text = document.body?.innerText || '';
  let termsLink = pageLink;

  for (const candidate of linksToTry) {
    if (!candidate.href || candidate.href === location.href) continue;
    try {
      const response = await fetch(candidate.href, { credentials: 'include' });
      if (!response.ok) continue;
      const html = await response.text();
      const termsDocument = new DOMParser().parseFromString(html, 'text/html');
      const termsText = termsDocument.body?.innerText?.trim();
      if (!termsText) continue;
      text = termsText;
      termsLink = { href: response.url || candidate.href, label: candidate.label };
      break;
    } catch (error) {
      // Try the next candidate; the visible page remains a useful fallback.
    }
  }

  const result = {
    hostname: location.hostname.replace(/^www\./, ''),
    termsUrl: termsLink?.href || null,
    termsLabel: termsLink?.label || null,
    ...analyze(text)
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