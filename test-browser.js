const page = document.querySelector('#page');
const address = document.querySelector('#address');
const site = document.querySelector('#site');
const status = document.querySelector('#status');
const results = document.querySelector('#results');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function render(result) {
  const concerns = result.concerns || [];
  results.innerHTML = `
    <div class="summary"><div class="score">${concerns.length}<small>flags</small></div>
      <div><strong>${concerns.length ? 'Worth a closer read' : 'No common flags found'}</strong><span>Based on ${result.analyzedCharacters.toLocaleString()} page characters</span></div>
    </div>
    ${result.termsUrl ? `<p class="terms-link">Terms analyzed: <a href="${escapeHtml(result.termsUrl)}" target="_blank" rel="noreferrer">${escapeHtml(result.termsUrl)}</a></p>` : '<p class="hint">No obvious Terms page was found. The visible page was reviewed.</p>'}
    ${concerns.map((concern) => `<article class="concern"><strong>${escapeHtml(concern.severity)}: ${escapeHtml(concern.title)}</strong><p>${escapeHtml(concern.detail)}</p><p><b>What to check:</b> ${escapeHtml(concern.check)}</p><p><b>Detected:</b> “${escapeHtml(concern.evidence)}”</p></article>`).join('')}
    ${concerns.length ? '' : '<p class="hint">No rules matched the text returned by the page.</p>'}`;
}

async function scan() {
  let url;
  try {
    url = new URL(address.value.trim());
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http and https URLs can be tested.');
  } catch (error) {
    results.innerHTML = `<p class="state">${escapeHtml(error.message)}</p>`;
    return;
  }

  status.textContent = 'Fetching through this Codespace...';
  results.innerHTML = '<p class="state">Fetching page and looking for its Terms...</p>';
  site.textContent = url.hostname;
  try {
    const response = await fetch(`/api/fetch?url=${encodeURIComponent(url.href)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'The local browser could not fetch this page.');
    page.srcdoc = payload.html;
    const text = payload.termsText || payload.text;
    render({ ...TermsLensScanner.analyze(text), termsUrl: payload.termsUrl });
    status.textContent = `Scanned locally at ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    results.innerHTML = `<p class="state">${escapeHtml(error.message)}</p><p class="hint">Some sites block automated requests or require a login. Try another URL.</p>`;
    status.textContent = 'Request failed';
  }
}

document.querySelector('#address-form').addEventListener('submit', (event) => {
  event.preventDefault();
  scan();
});
document.querySelector('#scan').addEventListener('click', scan);
