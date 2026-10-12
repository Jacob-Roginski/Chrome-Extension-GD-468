function sendMessage(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      resolve(chrome.runtime.lastError ? null : response);
    });
  });
}

function render(result) {
  const content = document.querySelector('#content');
  if (!result) {
    content.innerHTML = '<p class="state">This page could not be scanned. Try a normal website, then refresh the page.</p>';
    return;
  }

  const concerns = result.concerns || [];
  const link = result.termsUrl ? `<p><a href="${result.termsUrl}" target="_blank">Open ${result.termsLabel || 'Terms of Service'} ↗</a></p>` : '<p class="state">No obvious Terms link was found on this page.</p>';
  content.innerHTML = `
    <div class="summary">
      <div class="score">${concerns.length}<small>flags</small></div>
      <div><strong>${concerns.length ? 'Worth a closer read' : 'No common flags found'}</strong><span>Based on ${result.analyzedCharacters.toLocaleString()} page characters</span></div>
    </div>
    ${concerns.map((concern) => `<article class="concern"><strong>${concern.title}</strong><p>${concern.detail}</p></article>`).join('')}
    ${link}
    <div class="actions"><button class="primary" id="rescan">Scan again</button><button id="clear">Clear</button></div>`;

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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
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