const TERM_LINK_WORDS = /terms(?:\s+of\s+service)?|conditions|user agreement|\btos\b/i;
const TERM_PATHS = ['/terms', '/terms-of-service', '/legal/terms', '/legal/terms-of-service', '/legal'];

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
    .filter((link) => TERM_LINK_WORDS.test(`${link.textContent} ${link.getAttribute('href')}`))
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
  return result;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'scan-now') {
    scan().then(sendResponse);
    return true;
  }
});

scan();