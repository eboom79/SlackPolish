/**
 * Content script: on the SlackPolish hotkey, log where it was pressed and - on an Atlassian editor with
 * polishing enabled - polish the comment (or the selected part) with the same rules as in Slack:
 * mentions, links, inline code, emoji and quoted lines are protected and verified after write-back.
 * By default the settings saved in Slack (style, language, personal polish, hotkey) are followed; they are
 * read through the SlackPolish launcher. Events are persisted by the background worker; see the popup.
 */
(function () {
    if (window.__SLACKPOLISH_EXTENSION_HOTKEY_ATTACHED__) {
        return;
    }
    window.__SLACKPOLISH_EXTENSION_HOTKEY_ATTACHED__ = true;

    const DEFAULT_HOTKEY = 'Ctrl+Shift';
    // Revision of this content script, stamped on every event: tells whether a tab still runs an older script
    const CONTENT_REVISION = 'r7-slack-settings';
    const config = () => window.SLACKPOLISH_CONFIG || {};

    // The hotkey in force on this page (Slack's improveHotkey when followed); re-attached when it changes
    let activeHotkey = DEFAULT_HOTKEY;
    let detachHotkey = null;

    function usableHotkey(hotkeyString) {
        const parsed = SlackPolishHotkey.parse(hotkeyString || '');
        return parsed && (parsed.ctrl || parsed.alt || parsed.shift || parsed.tab) ? hotkeyString : DEFAULT_HOTKEY;
    }

    function applyHotkey(hotkeyString) {
        const wanted = usableHotkey(hotkeyString);
        if (detachHotkey && wanted === activeHotkey) return;
        if (detachHotkey) detachHotkey();
        activeHotkey = wanted;
        detachHotkey = SlackPolishHotkey.attach(document, SlackPolishHotkey.parse(wanted), () => { handlePress(); });
    }

    function describePage() {
        const appNameMeta = document.querySelector('meta[name="application-name"]');
        const surface = SlackPolishSurface.classify(location.hostname, { appName: appNameMeta ? appNameMeta.content : '' });
        return {
            time: new Date().toISOString(),
            hotkey: activeHotkey,
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

    /** The SlackPolish settings saved in Slack, via the launcher (worker caches the last good copy). */
    async function fetchSlackSettings() {
        const reply = await sendToWorker({ type: 'slackpolish-slack-settings' });
        if (reply && reply.ok) return { settings: reply.settings || {}, source: 'slack' };
        if (reply && reply.cached && reply.cached.settings) return { settings: reply.cached.settings, source: 'slack-cached', error: reply.error };
        return { settings: null, source: 'unavailable', error: (reply && reply.error) || 'no reply' };
    }

    /**
     * Effective polishing settings: Slack's (default, followSlack !== false) or the extension's own.
     * Slack stores the same catalog keys (style CASUAL..., language ENGLISH...) plus personalPolish and improveHotkey.
     */
    async function resolveSettings(extensionSettings) {
        const cfg = config();
        const own = {
            style: extensionSettings.style || 'TONE_POLISH',
            languageKey: extensionSettings.language || 'ENGLISH',
            personalPolish: '',
            hotkey: DEFAULT_HOTKEY,
            source: 'extension'
        };
        if (extensionSettings.followSlack === false) return own;
        const slack = await fetchSlackSettings();
        if (!slack.settings) return { ...own, slackError: slack.error };
        const s = slack.settings;
        const style = s.style && cfg.PROMPTS && cfg.PROMPTS.STYLES && cfg.PROMPTS.STYLES[s.style] ? s.style : own.style;
        const languageKey = s.language && cfg.SUPPORTED_LANGUAGES && cfg.SUPPORTED_LANGUAGES[s.language] ? s.language : (s.language || own.languageKey);
        return {
            style,
            languageKey,
            personalPolish: (s.personalPolish || s.customInstructions || '').toString(),
            hotkey: usableHotkey(s.improveHotkey),
            source: slack.source,
            slackError: slack.error
        };
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
    async function polishAtlassian(root, settings, effective) {
        const A = SlackPolishAtlassian;
        const Core = SlackPolishCore;
        const cfg = config();
        const result = { ok: false, mode: 'message', settingsSource: effective.source };
        if (effective.slackError) result.slackError = effective.slackError;

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

        const style = effective.style;
        const languageKey = effective.languageKey;
        const language = (cfg.SUPPORTED_LANGUAGES && cfg.SUPPORTED_LANGUAGES[languageKey] && cfg.SUPPORTED_LANGUAGES[languageKey].name) || languageKey;
        result.style = style;
        result.language = language;
        if (effective.personalPolish) result.personalPolish = effective.personalPolish;
        const prompt = Core.buildPrompt({ text: state.text, style, language, entities: state.entities, customInstructions: effective.personalPolish, context: { issueTitle: document.title } });
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
                const effective = await resolveSettings(settings);
                event.settingsSource = effective.source;
                applyHotkey(effective.hotkey); // Slack's hotkey may have changed since this page loaded
                event.polish = await polishAtlassian(root, settings, effective);
            } catch (error) {
                event.polish = { ok: false, error: String(error && error.message || error) };
            }
            const p = event.polish;
            console.log('🔧 SLACKPOLISH_POLISH', JSON.stringify({ ok: p.ok, mode: p.mode, settings: p.settingsSource, style: p.style, language: p.language, skipped: p.skipped, error: p.error, repaired: p.repaired && { removed: p.repaired.removed, reanchored: p.repaired.reanchored, appended: p.repaired.appended, substituted: p.repaired.substituted } }));
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

    // Listen right away with the default chord, then switch to the hotkey saved in Slack once it is known
    applyHotkey(DEFAULT_HOTKEY);
    async function refreshHotkey() {
        try {
            const effective = await resolveSettings(await getSettings());
            applyHotkey(effective.hotkey);
        } catch (error) {
            // keep the current chord
        }
    }
    refreshHotkey();
    try {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local') return;
            if (changes.settings) {
                // followSlack toggled in the popup: re-resolve (one fetch)
                const before = (changes.settings.oldValue || {}).followSlack !== false;
                const after = (changes.settings.newValue || {}).followSlack !== false;
                if (before !== after) refreshHotkey();
                return;
            }
            if (changes.slackSettings) {
                // The worker stores the Slack settings only when they changed: switch chords without fetching again
                const next = changes.slackSettings.newValue && changes.slackSettings.newValue.settings;
                getSettings().then(settings => { if (settings.followSlack !== false && next) applyHotkey(next.improveHotkey); });
            }
        });
    } catch (error) {
        // extension reloaded under this page
    }

    // Let the popup ask whether the content script is alive on this tab
    try {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message && message.type === 'slackpolish-ping') {
                const page = describePage();
                sendResponse({ ok: true, surface: page.surface, host: page.host, revision: CONTENT_REVISION, hotkey: activeHotkey });
            }
        });
    } catch (error) {
        // ignore
    }
})();
