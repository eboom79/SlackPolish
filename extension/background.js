/**
 * Background service worker: persists hotkey events (capped), keeps the badge count, and performs the
 * OpenAI call for polishing (the content script cannot call cross-origin APIs itself).
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

const DEFAULT_PROXY_BASE = 'http://127.0.0.1:9223/v1'; // the SlackPolish launcher's local proxy (debug port + 1)

/**
 * Chat completion with the same request shape as the Slack script.
 * Key source (settings.keySource):
 *  - 'slack' (default): no key in the browser; the request goes to the SlackPolish launcher's local proxy,
 *    which adds the key saved in Slack (only for requests from a browser extension origin).
 *  - 'own': settings.apiKey straight to OpenAI (settings.apiBase is overridable for tests).
 */
async function polish(request) {
    const { settings = {} } = await chrome.storage.local.get('settings');
    const useOwnKey = settings.keySource === 'own';
    const ownKey = (settings.apiKey || '').trim();
    if (useOwnKey && !ownKey) {
        return { ok: false, error: 'No OpenAI API key configured (SlackPolish popup → Polish settings).' };
    }
    const apiBase = (useOwnKey ? (settings.apiBase || 'https://api.openai.com/v1') : (settings.proxyBase || DEFAULT_PROXY_BASE)).replace(/\/$/, '');
    const headers = { 'Content-Type': 'application/json' };
    if (useOwnKey) headers.Authorization = `Bearer ${ownKey}`;
    const body = {
        model: request.model || settings.model || 'gpt-4-turbo',
        messages: [{ role: 'user', content: request.prompt }],
        max_tokens: request.maxTokens || settings.maxTokens || 800,
        temperature: typeof request.temperature === 'number' ? request.temperature : (settings.temperature ?? 0.3)
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs || 45000);
    try {
        const response = await fetch(`${apiBase}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
        if (!response.ok) {
            const detail = await response.json().catch(() => ({}));
            return { ok: false, error: (detail.error && detail.error.message) || `HTTP ${response.status}`, keySource: useOwnKey ? 'own' : 'slack' };
        }
        const data = await response.json();
        const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (!text || !text.trim()) {
            return { ok: false, error: 'Empty response from the model' };
        }
        return { ok: true, text, usage: data.usage || null, model: body.model, keySource: useOwnKey ? 'own' : 'slack' };
    } catch (error) {
        if (error.name === 'AbortError') return { ok: false, error: 'The model request timed out' };
        if (!useOwnKey) {
            return { ok: false, keySource: 'slack', error: 'SlackPolish is not running, so the key saved in Slack is not reachable. Start Slack through SlackPolish, or choose "Use my own key" in the popup.' };
        }
        return { ok: false, error: String(error.message || error) };
    } finally {
        clearTimeout(timer);
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message) return false;
    if (message.type === 'slackpolish-hotkey') {
        appendEvent(message.event, sender)
            .then(count => sendResponse({ ok: true, count }))
            .catch(error => sendResponse({ ok: false, error: String(error) }));
        return true;
    }
    if (message.type === 'slackpolish-polish') {
        polish(message)
            .then(sendResponse)
            .catch(error => sendResponse({ ok: false, error: String(error) }));
        return true;
    }
    return false;
});

chrome.runtime.onInstalled.addListener(async () => {
    const { events = [] } = await chrome.storage.local.get('events');
    await chrome.action.setBadgeText({ text: events.length ? String(events.length) : '' });
});
