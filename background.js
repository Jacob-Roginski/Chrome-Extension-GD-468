const analyses = new Map();

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ termsLensEnabled: true });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'terms-found' && sender.tab?.id) {
    const result = { ...message.result, url: sender.tab.url, tabId: sender.tab.id };
    const previous = analyses.get(sender.tab.id);
    analyses.set(sender.tab.id, result);

    if (result.termsUrl && (!previous || previous.url !== result.url)) {
      chrome.notifications.create(`terms-${sender.tab.id}`, {
        type: 'basic',
        iconUrl: 'icon.svg',
        title: 'Terms Lens found the Terms',
        message: `${result.concernCount} review area${result.concernCount === 1 ? '' : 's'} found on ${result.hostname}.`
      });
    }
    return;
  }

  if (message.type === 'get-analysis') {
    sendResponse({ result: analyses.get(message.tabId) || null });
    return true;
  }

  if (message.type === 'clear-analysis' && message.tabId) {
    analyses.delete(message.tabId);
  }

  if (message.type === 'open-review' && sender.tab?.id) {
    const url = new URL(chrome.runtime.getURL('popup.html'));
    url.searchParams.set('tabId', String(sender.tab.id));
    chrome.tabs.create({ url: url.toString() });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => analyses.delete(tabId));
