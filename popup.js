function sendMessage(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      resolve(chrome.runtime.lastError ? null : response);
    });
  });
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

function render(result) {
  const content = document.querySelector('#content');
  if (!result) {
    content.innerHTML = '<p class="state">This page could not be scanned. Try a normal website, then refresh the page.</p>';
    return;
  }

  const concerns = result.concerns || [];
  const analyzedCharacters = Number.isFinite(result.analyzedCharacters) ? result.analyzedCharacters : 0;
  const link = result.termsUrl ? `<p class="terms-notice">Terms analyzed: <a class="terms-link" href="${escapeHtml(result.termsUrl)}" target="_blank" rel="noreferrer">${escapeHtml(result.termsLabel || 'Open Terms')}</a></p>` : '<p class="terms-notice">No obvious Terms link was found on this page.</p>';
  const summaryTitle = concerns.length ? 'Flags worth<br>reading' : 'No common<br>flags found';
  const safeFindings = concerns.length
    ? concerns.map((concern) => `
        <li class="finding">
          <h3>${escapeHtml(concern.title)}</h3>
          <p>${escapeHtml(concern.detail)}</p>
        </li>
      `).join('')
    : `
      <li class="finding">
        <h3>No common flags found</h3>
        <p>Nothing in the visible page text triggered the extension's local clause checks.</p>
      </li>
    `;

  content.innerHTML = `
    <div class="summary-panel">
      <div class="score">${concerns.length}</div>
      <div class="summary-copy">
        <h2>${summaryTitle}</h2>
        <p>Based on ${analyzedCharacters.toLocaleString()} page characters</p>
      </div>
    </div>
    <p class="section-label">01 / key findings</p>
    <ul class="findings">${safeFindings}</ul>
    ${link}
    <div class="actions">
      <button class="primary" id="rescan">Scan again</button>
      <button id="clear">Clear</button>
    </div>`;

  document.querySelector('#rescan').addEventListener('click', async () => {
    content.innerHTML = '<p class="state">Scanning this page...</p>';
    const scanned = await sendMessage(result.tabId, { type: 'scan-now' });
    render({ ...scanned, tabId: result.tabId });
  });
  document.querySelector('#clear').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'clear-analysis', tabId: result.tabId });
    content.innerHTML = '<p class="state">Review cleared for this tab.</p>';
  });
}

async function init() {
  const requestedTabId = new URLSearchParams(location.search).get('tabId');
  let tab;
  if (requestedTabId) {
    try {
      tab = await chrome.tabs.get(Number(requestedTabId));
    } catch (error) {
      tab = null;
    }
  } else {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  }
  let hostname = 'Current page';
  try {
    if (tab?.url) hostname = new URL(tab.url).hostname;
  } catch (error) {
    hostname = 'Current page';
  }
  document.querySelector('#site').textContent = hostname;
  if (!tab?.id) return render(null);

  const response = await new Promise((resolve) => chrome.runtime.sendMessage({ type: 'get-analysis', tabId: tab.id }, resolve));
  if (response?.result) return render(response.result);
  const scanned = await sendMessage(tab.id, { type: 'scan-now' });
  render(scanned ? { ...scanned, tabId: tab.id } : null);
}

init();