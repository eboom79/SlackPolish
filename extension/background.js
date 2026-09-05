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

/** Chat completion with the same request shape as the Slack script. `apiBase` is overridable for tests. */
async function polish(request) {
    const { settings = {} } = await chrome.storage.local.get('settings');
    const apiKey = (settings.apiKey || '').trim();
    if (!apiKey) {
        return { ok: false, error: 'No OpenAI API key configured (SlackPolish popup → Polish settings).' };
    }
    const apiBase = (settings.apiBase || 'https://api.openai.com/v1').replace(/\/$/, '');
    const body = {
        model: request.model || settings.model || 'gpt-4-turbo',
        messages: [{ role: 'user', content: request.prompt }],
        max_tokens: request.maxTokens || settings.maxTokens || 800,
        temperature: typeof request.temperature === 'number' ? request.temperature : (settings.temperature ?? 0.3)
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs || 45000);
    try {
        const response = await fetch(`${apiBase}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify(body),
            signal: controller.signal
        });
        if (!response.ok) {
            const detail = await response.json().catch(() => ({}));
            return { ok: false, error: (detail.error && detail.error.message) || `HTTP ${response.status}` };
        }
        const data = await response.json();
        const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (!text || !text.trim()) {
            return { ok: false, error: 'Empty response from the model' };
        }
        return { ok: true, text, usage: data.usage || null, model: body.model };
    } catch (error) {
        return { ok: false, error: error.name === 'AbortError' ? 'The model request timed out' : String(error.message || error) };
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
