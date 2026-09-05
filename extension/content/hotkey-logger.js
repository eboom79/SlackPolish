/**
 * Content script: on the SlackPolish hotkey, log where it was pressed and - on an Atlassian editor with
 * polishing enabled - polish the comment (or the selected part) with the same rules as in Slack:
 * mentions, links, inline code, emoji and quoted lines are protected and verified after write-back.
 * Events are persisted by the background worker in chrome.storage.local; see the popup.
 */
(function () {
    if (window.__SLACKPOLISH_EXTENSION_HOTKEY_ATTACHED__) {
        return;
    }
    window.__SLACKPOLISH_EXTENSION_HOTKEY_ATTACHED__ = true;

    const HOTKEY = 'Ctrl+Shift';
    // Revision of this content script, stamped on every event: tells whether a tab still runs an older script
    const CONTENT_REVISION = 'r6-polish';
    const hotkey = SlackPolishHotkey.parse(HOTKEY);
    const config = () => window.SLACKPOLISH_CONFIG || {};

    function describePage() {
        const appNameMeta = document.querySelector('meta[name="application-name"]');
        const surface = SlackPolishSurface.classify(location.hostname, { appName: appNameMeta ? appNameMeta.content : '' });
        return {
            time: new Date().toISOString(),
            hotkey: HOTKEY,
            revision: CONTENT_REVISION,
            surface,
            host: location.hostname,
            path: location.pathname,
            title: (document.title || '').slice(0, 120),
            editorFocused: !!(document.activeElement && (document.activeElement.isContentEditable || /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName))),
            // The editor's text and a compact DOM vocabulary (tag.class combos, attribute names - never values)
            editor: SlackPolishEditor.describe(SlackPolishEditor.findActive(document))
        };
    }

    function sendToWorker(message) {
        return new Promise(resolve => {
            try {
                chrome.runtime.sendMessage(message, reply => {
                    if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
                    else resolve(reply || { ok: false, error: 'No reply from the extension worker' });
                });
            } catch (error) {
                resolve({ ok: false, error: String(error && error.message || error) });
            }
        });
    }

    async function getSettings() {
        try {
            const { settings = {}, roundTrip = false } = await chrome.storage.local.get(['settings', 'roundTrip']);
            return { ...settings, roundTrip };
        } catch (error) {
            return {}; // extension reloaded under this page
        }
    }

    /** The current selection when it is non-empty and lies inside the editor (polish only that part, as in Slack). */
    function selectionInside(root) {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount || selection.isCollapsed) return null;
        const range = selection.getRangeAt(0);
        return root.contains(range.startContainer) && root.contains(range.endContainer) ? range : null;
    }

    /**
     * Extract -> prompt -> model (via the worker) -> repair tokens -> rebuild HTML -> paste -> verify.
     * Never throws; returns a result object that is logged with the event.
     */
    async function polishAtlassian(root, settings) {
        const A = SlackPolishAtlassian;
        const Core = SlackPolishCore;
        const cfg = config();
        const result = { ok: false, mode: 'message' };

        const whole = A.extract(root);
        const range = selectionInside(root);
        const state = range ? A.extractFragment(range.cloneContents()) : whole;
        if (range) result.mode = 'selection';
        result.modelText = state.text;
        result.entities = state.entities.map(e => ({ token: e.token, kind: e.kind, text: e.text }));
        if (!Core.isPolishable(state.text)) {
            result.skipped = 'nothing-to-polish';
            return result;
        }

        const style = settings.style || 'TONE_POLISH';
        const languageKey = settings.language || 'ENGLISH';
        const language = (cfg.SUPPORTED_LANGUAGES && cfg.SUPPORTED_LANGUAGES[languageKey] && cfg.SUPPORTED_LANGUAGES[languageKey].name) || languageKey;
        result.style = style;
        result.language = language;
        const prompt = Core.buildPrompt({ text: state.text, style, language, entities: state.entities, context: { issueTitle: document.title } });
        const request = {
            type: 'slackpolish-polish',
            prompt,
            model: cfg.OPENAI_MODEL,
            temperature: cfg.OPENAI_TEMPERATURE,
            maxTokens: Math.max(cfg.OPENAI_MAX_TOKENS || 500, Math.ceil(state.text.length / 2) + 200)
        };
        let reply = await sendToWorker(request);
        if (!reply.ok) {
            result.error = reply.error || 'The model request failed';
            return result;
        }
        result.response = reply.text;

        // Like Slack: when the model merged lines, ask once more with an explicit line count
        const wanted = Core.countContentLines(state.text);
        if (wanted > 1 && Core.countContentLines(reply.text) < wanted) {
            const retry = await sendToWorker({ ...request, prompt: `${prompt}\nIMPORTANT: The message has ${wanted} non-empty lines. Return exactly ${wanted} non-empty lines, each corresponding to the same original line, in the same order.` });
            if (retry.ok && Core.countContentLines(retry.text) >= wanted) {
                reply = retry;
                result.response = retry.text;
                result.retriedForLines = true;
            }
        }

        const repaired = Core.repairModelOutput(reply.text, state.text, state.entities);
        result.repaired = repaired;
        if (Core.detokenize(repaired.text, state.entities).trim() === Core.detokenize(state.text, state.entities).trim()) {
            result.skipped = 'unchanged';
            result.ok = true;
            return result;
        }

        const html = A.buildHtml(repaired.text, state.entities);
        const plain = A.plainText(repaired.text, state.entities);
        const paste = await A.writeBack(root, html, plain, { keepSelection: !!range });
        result.pasteHandled = paste.handled;
        result.waitedForKeysMs = paste.waitedForKeysMs;

        const after = A.extract(root);
        result.modelTextAfter = after.text;
        result.verification = Core.verifyEntities(whole.entities, after.entities);
        result.ok = paste.handled && result.verification.ok;
        if (!paste.handled) result.error = 'The editor ignored the write-back';
        else if (!result.verification.ok) result.error = `Protected content changed: ${result.verification.lost.join(', ')} - press Ctrl+Z to undo`;
        return result;
    }

    // Same status pill as in Slack: "SlackPolish Improving" while it would be polishing, then "SlackPolish Active",
    // which dims after 5s (like Slack) and is removed afterwards so other sites are not cluttered.
    function showBadge() {
        SlackPolishStatusBadge.set('busy', 'SlackPolish Improving');
        setTimeout(() => SlackPolishStatusBadge.set('active', 'SlackPolish Active', { removeAfterMs: 8000 }), 1600);
    }

    async function handlePress() {
        const event = describePage();
        console.log('🔧 SLACKPOLISH_HOTKEY', JSON.stringify({ ...event, editor: event.editor && { ...event.editor, text: event.editor.text.slice(0, 200) + (event.editor.textLength > 200 ? '…' : '') } }));

        const settings = await getSettings();
        event.polishEnabled = settings.polish === true;
        event.roundTripEnabled = settings.roundTrip === true;
        const root = SlackPolishEditor.findActive(document);
        event.atlassianEditor = !!(root && SlackPolishAtlassian.isAtlassianEditor(root));

        if (settings.polish && event.surface === 'atlassian' && event.atlassianEditor) {
            SlackPolishStatusBadge.set('busy', 'SlackPolish Improving');
            try {
                event.polish = await polishAtlassian(root, settings);
            } catch (error) {
                event.polish = { ok: false, error: String(error && error.message || error) };
            }
            const p = event.polish;
            console.log('🔧 SLACKPOLISH_POLISH', JSON.stringify({ ok: p.ok, mode: p.mode, skipped: p.skipped, error: p.error, repaired: p.repaired && { removed: p.repaired.removed, reanchored: p.repaired.reanchored, appended: p.repaired.appended, substituted: p.repaired.substituted } }));
            if (p.skipped === 'nothing-to-polish') {
                SlackPolishStatusBadge.set('active', 'SlackPolish: nothing to polish', { removeAfterMs: 5000 });
            } else if (p.ok) {
                SlackPolishStatusBadge.set('active', 'SlackPolish Active', { removeAfterMs: 8000 });
            } else {
                SlackPolishStatusBadge.set('error', /API key/i.test(p.error || '') ? 'SlackPolish Needs API Key' : 'SlackPolish Needs Attention', { removeAfterMs: 8000 });
            }
        } else if (settings.roundTrip && event.surface === 'atlassian' && event.atlassianEditor) {
            // Diagnostic (popup toggle): re-insert the same content through the editor's paste pipeline and check nothing changed
            SlackPolishStatusBadge.set('busy', 'SlackPolish Improving');
            try {
                event.roundTrip = await SlackPolishAtlassian.roundTrip(root, el => SlackPolishEditor.describe(el));
            } catch (error) {
                event.roundTrip = { ok: false, error: String(error && error.message || error) };
            }
            console.log('🔧 SLACKPOLISH_ROUNDTRIP', JSON.stringify({ ok: event.roundTrip.ok, pasteHandled: event.roundTrip.pasteHandled, textSame: event.roundTrip.textSame, nodesSame: event.roundTrip.nodesSame, error: event.roundTrip.error }));
            SlackPolishStatusBadge.set(event.roundTrip.ok ? 'active' : 'error', event.roundTrip.ok ? 'SlackPolish Active' : 'SlackPolish Needs Attention', { removeAfterMs: 8000 });
        } else {
            showBadge();
        }

        // Never persist the prompt/response verbatim beyond what the popup needs
        if (event.polish && event.polish.response && event.polish.response.length > 4000) event.polish.response = event.polish.response.slice(0, 4000) + '…';
        try {
            chrome.runtime.sendMessage({ type: 'slackpolish-hotkey', event }, () => void chrome.runtime.lastError);
        } catch (error) {
            // Extension was reloaded/updated under this page; the console line above still records the press.
        }
    }

    SlackPolishHotkey.attach(document, hotkey, () => { handlePress(); });

    // Let the popup ask whether the content script is alive on this tab
    try {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message && message.type === 'slackpolish-ping') {
                const page = describePage();
                sendResponse({ ok: true, surface: page.surface, host: page.host, revision: CONTENT_REVISION });
            }
        });
    } catch (error) {
        // ignore
    }
})();
