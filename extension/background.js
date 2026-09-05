/**
 * Background service worker: persist hotkey events (capped) and show the count on the toolbar badge.
 */
const MAX_EVENTS = 200;

async function appendEvent(event, sender) {
    const { events = [] } = await chrome.storage.local.get('events');
    events.push({ ...event, tabId: sender && sender.tab ? sender.tab.id : null });
    while (events.length > MAX_EVENTS) {
        events.shift();
    }
    await chrome.storage.local.set({ events });
    await chrome.action.setBadgeText({ text: events.length > 999 ? '999+' : String(events.length) });
    await chrome.action.setBadgeBackgroundColor({ color: '#1264a3' });
    return events.length;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== 'slackpolish-hotkey') {
        return false;
    }
    appendEvent(message.event, sender)
        .then(count => sendResponse({ ok: true, count }))
        .catch(error => sendResponse({ ok: false, error: String(error) }));
    return true; // async response
});

chrome.runtime.onInstalled.addListener(async () => {
    const { events = [] } = await chrome.storage.local.get('events');
    await chrome.action.setBadgeText({ text: events.length ? String(events.length) : '' });
});
