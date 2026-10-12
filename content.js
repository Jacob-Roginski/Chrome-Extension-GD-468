const TERM_LINK_WORDS = /terms(?:\s+of\s+service)?|conditions|user agreement|\btos\b/i;
const TERM_PATHS = ['/terms', '/terms-of-service', '/legal/terms', '/legal/terms-of-service', '/legal'];
const SEARCH_ENGINE_HOSTS = new Set([
  'www.google.com', 'google.com', 'www.bing.com', 'bing.com', 'duckduckgo.com',
  'www.duckduckgo.com', 'search.yahoo.com', 'search.brave.com', 'www.baidu.com',
  'www.yandex.com', 'www.ecosia.org', 'www.startpage.com'
]);

const CONCERN_RULES = [
  { title: 'Data sharing and tracking', severity: 'Review', pattern: /(?:sell|share|disclos|advertis|third[- ]party|tracking|analytics|personal information).{0,160}(?:data|information|partner|service)/i, detail: 'The agreement appears to allow data disclosure, targeted advertising, analytics, or third-party processing.', check: 'Check which data is shared, who receives it, the opt-out process, and how long it is retained.' },
  { title: 'Automatic renewal or billing', severity: 'High attention', pattern: /(?:automatic(?:ally)? renew|recurring billing|subscription|free trial).{0,160}(?:charge|payment|cancel|fee|renew)/i, detail: 'The agreement appears to describe recurring charges, trial conversion, or renewal terms.', check: 'Check the renewal date, price changes, cancellation deadline, and whether refunds are available.' },
  { title: 'Arbitration and class-action waiver', severity: 'High attention', pattern: /(?:arbitration|class action|jury trial|dispute resolution).{0,180}(?:waive|waiver|require|agree|claim|dispute)/i, detail: 'The agreement may require private dispute resolution or limit participation in a class action.', check: 'Check the opt-out deadline, arbitration location and costs, and which claims are covered.' },
  { title: 'Broad liability limits', severity: 'High attention', pattern: /(?:limitation of liability|not liable|as is|no warranty|indemnif).{0,180}(?:damage|loss|claim|warranty|defend|reimburse)/i, detail: 'The agreement appears to limit company responsibility or shift claims and defense costs to you.', check: 'Check damage caps, excluded losses, warranty disclaimers, and any indemnity obligations.' },
  { title: 'Unilateral changes', severity: 'Review', pattern: /(?:modify|change these terms|updated terms|at any time).{0,180}(?:notice|effective|agree|accept|post)/i, detail: 'The company may be able to change the agreement without negotiating each change with you.', check: 'Check how notice is delivered, when changes take effect, and whether continued use counts as acceptance.' },
  { title: 'Suspension or termination', severity: 'Review', pattern: /(?:terminate|suspend|disable|close your account).{0,180}(?:without notice|any time|content|access|refund)/i, detail: 'The company may be able to suspend access or terminate the account, potentially without advance notice.', check: 'Check what happens to your data, paid balance, subscriptions, and content after termination.' },
  { title: 'Governing law and venue', severity: 'Review', pattern: /(?:governing law|jurisdiction|venue|laws of the (?:state|country)).{0,140}(?:court|dispute|claim|law)/i, detail: 'The agreement names a law or location that may control how disputes are handled.', check: 'Check whether the required court or location is practical for you and whether another clause changes this rule.' }
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
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  const concerns = CONCERN_RULES.flatMap((rule) => {
    const match = rule.pattern.exec(normalizedText);
    if (!match) return [];
    const start = Math.max(0, normalizedText.lastIndexOf('.', match.index) + 1);
    const end = normalizedText.indexOf('.', match.index + match[0].length);
    return [{
      title: rule.title,
      severity: rule.severity,
      detail: rule.detail,
      check: rule.check,
      evidence: normalizedText.slice(start, end === -1 ? Math.min(normalizedText.length, start + 240) : Math.min(end + 1, start + 240)).trim()
    }];
  });
  return { concerns, concernCount: concerns.length, analyzedCharacters: text.length };
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
  panel.innerHTML = `
    <div class="top"><div><p class="label">Terms Lens</p><h2>Site review complete</h2></div><button class="close" aria-label="Dismiss">×</button></div>
    <div class="score"><strong class="number">${flags}</strong><span>${flags === 1 ? 'review area flagged' : 'review areas flagged'}</span></div>
    <p class="details">${result.termsUrl ? 'Terms were found and examined locally.' : 'No Terms page was found; the visible page was reviewed.'}</p>
    ${result.concerns.slice(0, 3).map((concern) => `<div class="issue"><strong>${escapeHtml(concern.severity)}: ${escapeHtml(concern.title)}</strong><span>${escapeHtml(concern.check)}</span></div>`).join('')}
    ${result.termsUrl ? `<a href="${escapeHtml(result.termsUrl)}" target="_blank" rel="noreferrer">Open Terms ↗</a>` : ''}
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