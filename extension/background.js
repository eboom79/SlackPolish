/**
 * Background service worker.
 *  - persists hotkey events (capped) and keeps the badge count
 *  - performs the OpenAI call for polishing with the extension's own copy of the key (no launcher involved)
 *  - keeps a lightweight WebSocket to the JustPolish launcher purely for settings sync: a Save in Slack is
 *    pushed here, a Save in the extension menu is pushed to Slack. Settings travel only when the sender's
 *    "Sync settings with …" box is checked; the OpenAI key is always shared (one key is valid for both).
 */
const MAX_EVENTS = 200;
const DEFAULT_SYNC_URL = 'ws://127.0.0.1:9223/slackpolish/sync'; // the JustPolish launcher (debug port + 1)
const SHARED_FIELDS = ['language', 'style', 'improveHotkey', 'personalPolish'];

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

async function getSettings() {
    const { settings = {} } = await chrome.storage.local.get('settings');
    return settings;
}
async function getSync() {
    const { sync = {} } = await chrome.storage.local.get('sync');
    return sync;
}
async function setSync(patch) {
    const sync = { ...(await getSync()), ...patch };
    await chrome.storage.local.set({ sync });
    return sync;
}

/** Chat completion with the same request shape as the Slack script, straight to OpenAI with the local key. */
async function polish(request) {
    const settings = await getSettings();
    const apiKey = (settings.apiKey || '').trim();
    if (!apiKey) {
        return { ok: false, error: 'No OpenAI API key yet. Enter it in the JustPolish settings (toolbar icon) or in Slack - one key is valid for both.' };
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

// ---------------------------------------------------------------------------
// Settings sync link to the JustPolish launcher (WebSocket; the launcher pings every 20s, which also keeps
// this worker alive). Reconnects with backoff; a one-minute alarm re-establishes it after the worker restarts.
// ---------------------------------------------------------------------------
let socket = null;
let reconnectTimer = null;
let backoffMs = 2000;

function sendSync(message) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
        return true;
    }
    return false;
}

function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => { reconnectTimer = null; ensureSyncConnected(); }, backoffMs);
    backoffMs = Math.min(backoffMs * 2, 60000);
}

async function ensureSyncConnected() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
    const settings = await getSettings();
    let ws;
    try {
        ws = new WebSocket(settings.syncUrl || DEFAULT_SYNC_URL);
    } catch (error) {
        await setSync({ connected: false, lastError: String(error.message || error) });
        scheduleReconnect();
        return;
    }
    socket = ws;
    ws.onopen = async () => {
        backoffMs = 2000;
        await setSync({ connected: true, connectedAt: Date.now(), lastError: null });
    };
    ws.onmessage = (event) => {
        let message = null;
        try { message = JSON.parse(event.data); } catch (error) { return; }
        handleSyncMessage(message).catch(error => setSync({ lastError: String(error.message || error) }));
    };
    ws.onclose = async () => {
        if (socket === ws) socket = null;
        await setSync({ connected: false });
        scheduleReconnect();
    };
    ws.onerror = () => { /* onclose follows */ };
}

/**
 * Apply what Slack shares. `reason` is 'hello' (connect: catch up on a Save we may have missed) or
 * 'slack-saved' (a Save in Slack just happened). Settings come only when Slack's sync box is checked
 * (otherwise `settings` is null); the key always comes when Slack has one.
 */
async function applySlackState(slack, reason) {
    const local = await getSettings();
    const sync = await getSync();
    const shared = slack.settings || null;
    const slackSavedAt = (shared && shared.savedAt) || slack.savedAt || 0;
    const next = { ...local };
    const applied = [];

    const applySettings = !!shared && (reason === 'slack-saved' || (shared.syncWithChrome === true && slackSavedAt > (sync.lastSlackSavedAt || 0)));
    if (applySettings) {
        for (const field of SHARED_FIELDS) {
            if (shared[field] !== undefined && shared[field] !== next[field]) {
                next[field] = shared[field];
                applied.push(field);
            }
        }
    }
    if (slack.apiKey) {
        // One key for both: take Slack's when we have none, or when Slack's is the more recent save
        const take = !local.apiKey || (slack.apiKey !== local.apiKey && slackSavedAt > (local.savedAt || 0));
        if (take && slack.apiKey !== local.apiKey) {
            next.apiKey = slack.apiKey;
            applied.push('apiKey');
        }
    } else if (local.apiKey && reason === 'hello') {
        sendSync({ type: 'chrome-saved', settings: null, apiKey: local.apiKey, savedAt: local.savedAt || Date.now() });
    }
    if (applied.length) await chrome.storage.local.set({ settings: next });
    await setSync({
        lastSlackSavedAt: applySettings ? Math.max(sync.lastSlackSavedAt || 0, slackSavedAt) : (sync.lastSlackSavedAt || 0),
        lastAppliedFromSlack: applied.length ? { at: Date.now(), fields: applied, reason } : (sync.lastAppliedFromSlack || null),
        slackHasKey: !!slack.apiKey,
        slackSyncEnabled: shared ? shared.syncWithChrome === true : (typeof slack.syncWithChrome === 'boolean' ? slack.syncWithChrome : sync.slackSyncEnabled)
    });
    return applied;
}

async function flushPendingSave() {
    const { pendingChromeSave } = await getSync();
    if (pendingChromeSave) sendSync(pendingChromeSave); // the ack clears it
}

async function handleSyncMessage(message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'ping') {
        sendSync({ type: 'pong' });
        return;
    }
    if (message.type === 'hello') {
        await setSync({ connected: true, lastHelloAt: Date.now(), launcherVersion: message.launcherVersion || null });
        await applySlackState(message.slack || {}, 'hello');
        await flushPendingSave();
        return;
    }
    if (message.type === 'slack-saved') {
        await applySlackState(message, 'slack-saved');
        return;
    }
    if (message.type === 'chrome-saved-ack') {
        await setSync({ lastPushAt: Date.now(), lastPushOk: !!message.ok, lastError: message.ok ? null : (message.error || 'Slack did not accept the settings'), pendingChromeSave: message.ok ? null : (await getSync()).pendingChromeSave });
    }
}

/** Save from the settings menu: store locally, then push to Slack (settings only if the box is checked, key always). */
async function saveSettings(incoming) {
    const local = await getSettings();
    const next = {
        ...local,
        language: incoming.language || local.language || 'ENGLISH',
        style: incoming.style || local.style || 'CASUAL',
        improveHotkey: incoming.improveHotkey || local.improveHotkey || 'Ctrl+Shift',
        personalPolish: typeof incoming.personalPolish === 'string' ? incoming.personalPolish.trim() : (local.personalPolish || ''),
        apiKey: typeof incoming.apiKey === 'string' ? incoming.apiKey.trim() : (local.apiKey || ''),
        syncWithSlack: incoming.syncWithSlack === true,
        savedAt: Date.now()
    };
    await chrome.storage.local.set({ settings: next });
    const payload = {
        type: 'chrome-saved',
        settings: next.syncWithSlack ? Object.fromEntries(SHARED_FIELDS.map(f => [f, next[f]])) : null,
        apiKey: next.apiKey || '',
        savedAt: next.savedAt
    };
    if (!payload.settings && !payload.apiKey) return { ok: true, synced: 'nothing-to-sync' };
    if (sendSync(payload)) {
        await setSync({ pendingChromeSave: null, lastPushAt: Date.now() });
        return { ok: true, synced: 'sent' };
    }
    await setSync({ pendingChromeSave: payload });
    ensureSyncConnected();
    return { ok: true, synced: 'pending' };
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
    if (message.type === 'slackpolish-save-settings') {
        saveSettings(message.settings || {})
            .then(sendResponse)
            .catch(error => sendResponse({ ok: false, error: String(error) }));
        return true;
    }
    if (message.type === 'slackpolish-sync-status') {
        ensureSyncConnected();
        Promise.all([getSync(), getSettings()])
            .then(([sync, settings]) => sendResponse({ ok: true, sync: { ...sync, connected: !!(socket && socket.readyState === WebSocket.OPEN) }, hasApiKey: !!settings.apiKey }))
            .catch(error => sendResponse({ ok: false, error: String(error) }));
        return true;
    }
    return false;
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'slackpolish-sync') ensureSyncConnected();
});

async function startup() {
    const { events = [] } = await chrome.storage.local.get('events');
    await chrome.action.setBadgeText({ text: events.length ? String(events.length) : '' });
    // The round-trip diagnostic is a one-shot switch from the activity log; never let it survive a reload
    await chrome.storage.local.set({ roundTrip: false });
    await chrome.alarms.create('slackpolish-sync', { periodInMinutes: 1 });
    ensureSyncConnected();
}
chrome.runtime.onInstalled.addListener(startup);
chrome.runtime.onStartup.addListener(startup);
ensureSyncConnected();
