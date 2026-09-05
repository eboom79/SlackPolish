/**
 * Content script: log where the SlackPolish hotkey is pressed.
 * Records surface, host, path, title and the focused editor's text + DOM vocabulary - never the query string.
 * Persisted by the background worker in chrome.storage.local; see the popup.
 */
(function () {
    if (window.__SLACKPOLISH_EXTENSION_HOTKEY_ATTACHED__) {
        return;
    }
    window.__SLACKPOLISH_EXTENSION_HOTKEY_ATTACHED__ = true;

    const HOTKEY = 'Ctrl+Shift';
    // Revision of this content script, stamped on every event: tells whether a tab still runs an older script
    const CONTENT_REVISION = 'r5-roundtrip';
    const hotkey = SlackPolishHotkey.parse(HOTKEY);

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

    // Same status pill as in Slack: "SlackPolish Improving" while it would be polishing, then "SlackPolish Active",
    // which dims after 5s (like Slack) and is removed afterwards so other sites are not cluttered.
    function showBadge() {
        SlackPolishStatusBadge.set('busy', 'SlackPolish Improving');
        setTimeout(() => SlackPolishStatusBadge.set('active', 'SlackPolish Active', { removeAfterMs: 8000 }), 1600);
    }

    async function handlePress() {
        const event = describePage();
        console.log('🔧 SLACKPOLISH_HOTKEY', JSON.stringify({ ...event, editor: event.editor && { ...event.editor, text: event.editor.text.slice(0, 200) + (event.editor.textLength > 200 ? '…' : '') } }));

        // Experimental, opt-in (popup toggle): on an Atlassian editor, re-insert the same content through the
        // editor's paste pipeline and check nothing changed. Proves write-back is lossless before any polishing.
        let settings = {};
        try { settings = await chrome.storage.local.get('roundTrip'); } catch (error) { /* extension reloaded */ }
        event.roundTripEnabled = settings.roundTrip === true;
        const root = SlackPolishEditor.findActive(document);
        event.atlassianEditor = !!(root && SlackPolishAtlassian.isAtlassianEditor(root));
        if (settings.roundTrip && event.surface === 'atlassian' && root && SlackPolishAtlassian.isAtlassianEditor(root)) {
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
                sendResponse({ ok: true, surface: page.surface, host: page.host });
            }
        });
    } catch (error) {
        // ignore
    }
})();
