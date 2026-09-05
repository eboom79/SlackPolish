/**
 * Content script: log where the SlackPolish hotkey is pressed.
 * Records surface, host, path and title - never the query string (it can carry tokens).
 * Persisted by the background worker in chrome.storage.local; see the popup.
 */
(function () {
    if (window.__SLACKPOLISH_EXTENSION_HOTKEY_ATTACHED__) {
        return;
    }
    window.__SLACKPOLISH_EXTENSION_HOTKEY_ATTACHED__ = true;

    const HOTKEY = 'Ctrl+Shift';
    const hotkey = SlackPolishHotkey.parse(HOTKEY);

    function describePage() {
        const appNameMeta = document.querySelector('meta[name="application-name"]');
        const surface = SlackPolishSurface.classify(location.hostname, { appName: appNameMeta ? appNameMeta.content : '' });
        return {
            time: new Date().toISOString(),
            hotkey: HOTKEY,
            surface,
            host: location.hostname,
            path: location.pathname,
            title: (document.title || '').slice(0, 120),
            editorFocused: !!(document.activeElement && (document.activeElement.isContentEditable || /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)))
        };
    }

    // Same status pill as in Slack: "SlackPolish Improving" while it would be polishing, then "SlackPolish Active",
    // which dims after 5s (like Slack) and is removed afterwards so other sites are not cluttered.
    function showBadge() {
        SlackPolishStatusBadge.set('busy', 'SlackPolish Improving');
        setTimeout(() => SlackPolishStatusBadge.set('active', 'SlackPolish Active', { removeAfterMs: 8000 }), 1600);
    }

    SlackPolishHotkey.attach(document, hotkey, () => {
        const event = describePage();
        console.log('🔧 SLACKPOLISH_HOTKEY', JSON.stringify(event));
        showBadge();
        try {
            chrome.runtime.sendMessage({ type: 'slackpolish-hotkey', event }, () => void chrome.runtime.lastError);
        } catch (error) {
            // Extension was reloaded/updated under this page; the console line above still records the press.
        }
    });

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
