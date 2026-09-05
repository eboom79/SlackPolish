/**
 * SlackPolish hotkey chord detection.
 *
 * Same semantics as the listener inside slack-text-improver.js: a modifier-only
 * combination such as "Ctrl+Shift" fires on the keydown of the modifier that
 * completes the chord, exactly once per press (reset when a required key is
 * released or the window loses focus). "Tab" combinations fire on the Tab key.
 *
 * Plain script (no modules) so it can run as a content script; also exported
 * for Node tests.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.SlackPolishHotkey = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function parse(hotkeyString) {
        const parts = String(hotkeyString || 'Ctrl+Shift').split('+');
        return {
            ctrl: parts.includes('Ctrl'),
            shift: parts.includes('Shift'),
            alt: parts.includes('Alt'),
            tab: parts.includes('Tab'),
            displayName: String(hotkeyString || 'Ctrl+Shift')
        };
    }

    function matches(event, hotkey) {
        if (!event || !hotkey) {
            return false;
        }
        if (hotkey.tab) {
            return event.key === 'Tab' &&
                !!event.ctrlKey === hotkey.ctrl &&
                !!event.shiftKey === hotkey.shift &&
                !!event.altKey === hotkey.alt;
        }
        if (!['Control', 'Shift', 'Alt'].includes(event.key)) {
            return false;
        }
        return !!event.ctrlKey === hotkey.ctrl &&
            !!event.shiftKey === hotkey.shift &&
            !!event.altKey === hotkey.alt;
    }

    /**
     * Listen on `target` (a Document) for the chord; call `onTrigger(event)` once per press.
     * Listeners run in the capture phase so pages that stop propagation (rich editors) cannot hide it.
     * Returns a function that removes the listeners.
     */
    function attach(target, hotkey, onTrigger, options) {
        const minIntervalMs = options && typeof options.minIntervalMs === 'number' ? options.minIntervalMs : 500;
        let pressedOnce = false;
        let lastTrigger = 0;

        const onKeyDown = (event) => {
            if (!matches(event, hotkey)) {
                return;
            }
            if (hotkey.tab) {
                event.preventDefault();
            }
            if (pressedOnce) {
                return;
            }
            const now = Date.now();
            if (now - lastTrigger < minIntervalMs) {
                return;
            }
            pressedOnce = true;
            lastTrigger = now;
            onTrigger(event);
        };
        const onKeyUp = (event) => {
            const released =
                (hotkey.ctrl && event.key === 'Control') ||
                (hotkey.shift && event.key === 'Shift') ||
                (hotkey.alt && event.key === 'Alt') ||
                (hotkey.tab && event.key === 'Tab');
            if (released) {
                pressedOnce = false;
            }
        };
        const onBlur = () => { pressedOnce = false; };

        target.addEventListener('keydown', onKeyDown, true);
        target.addEventListener('keyup', onKeyUp, true);
        const view = target.defaultView || null;
        if (view && view.addEventListener) {
            view.addEventListener('blur', onBlur);
        }
        return function detach() {
            target.removeEventListener('keydown', onKeyDown, true);
            target.removeEventListener('keyup', onKeyUp, true);
            if (view && view.removeEventListener) {
                view.removeEventListener('blur', onBlur);
            }
        };
    }

    return { parse, matches, attach };
});
