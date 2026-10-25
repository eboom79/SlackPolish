/**
 * Drives Slack's message composer through CDP with real input events, and reads
 * back its DOM in a form the scenarios can assert on.
 *
 * Safety rules baked in:
 *  - never dispatches a bare Enter (that would SEND); newlines are Shift+Enter
 *  - mention autocomplete is accepted with Tab, which is a no-op without a popup
 *  - every action targets the composer whose aria-label matches the configured
 *    conversation, never "whatever is focused"
 */
import { sleep } from './cdp.mjs';

const MOD = { alt: 1, ctrl: 2, meta: 4, shift: 8 };

const SHIFTED = new Set('~!@#$%^&*()_+{}|:"<>?');
const CODE_FOR = {
    ' ': ['Space', 32], '.': ['Period', 190], ',': ['Comma', 188], '-': ['Minus', 189], '/': ['Slash', 191],
    ';': ['Semicolon', 186], ':': ['Semicolon', 186], "'": ['Quote', 222], '"': ['Quote', 222], '?': ['Slash', 191],
    '!': ['Digit1', 49], '@': ['Digit2', 50], '#': ['Digit3', 51], '&': ['Digit7', 55], '(': ['Digit9', 57], ')': ['Digit0', 48],
    '=': ['Equal', 187], '+': ['Equal', 187], '_': ['Minus', 189], '[': ['BracketLeft', 219], ']': ['BracketRight', 221]
};

function keyDescriptor(ch) {
    if (/^[a-z]$/.test(ch)) return { key: ch, code: `Key${ch.toUpperCase()}`, vk: ch.toUpperCase().charCodeAt(0), modifiers: 0 };
    if (/^[A-Z]$/.test(ch)) return { key: ch, code: `Key${ch}`, vk: ch.charCodeAt(0), modifiers: MOD.shift };
    if (/^[0-9]$/.test(ch)) return { key: ch, code: `Digit${ch}`, vk: ch.charCodeAt(0), modifiers: 0 };
    const known = CODE_FOR[ch];
    return { key: ch, code: known ? known[0] : '', vk: known ? known[1] : 0, modifiers: SHIFTED.has(ch) ? MOD.shift : 0 };
}

/** Selector logic shared with the page: the visible, non-thread composer. */
const FIND_COMPOSER_JS = `
    (() => {
        const editors = [...document.querySelectorAll('.ql-editor[contenteditable="true"]')]
            .filter(e => e.offsetParent !== null && !e.closest('.p-threads_flexpane, .p-thread_view, [data-qa*="thread"]'));
        return editors[0] || null;
    })()`;

export class Composer {
    constructor(cdp, { composerLabel, log = () => {} }) {
        this.cdp = cdp;
        this.composerLabel = composerLabel;
        this.log = log;
    }

    /** Guard: the composer must belong to the configured conversation. */
    async describeTarget() {
        return this.cdp.evaluate(`(() => {
            const ed = ${FIND_COMPOSER_JS};
            return {
                found: !!ed,
                ariaLabel: ed ? ed.getAttribute('aria-label') : null,
                dataQa: ed ? ed.getAttribute('data-qa') : null,
                title: document.title,
                url: location.href,
                isEmpty: ed ? (ed.textContent || '').trim().length === 0 && !ed.querySelector('ts-slug, ts-mention, a, img') : null,
                slackPolishInjected: typeof window.__SLACKPOLISH_RUNTIME_TEARDOWN__ === 'function',
                hasApiKey: !!(localStorage.getItem('slackpolish_openai_api_key') || '').trim(),
                settings: (() => { try { return JSON.parse(localStorage.getItem('slackpolish_settings') || '{}'); } catch { return {}; } })(),
                status: window.__SLACKPOLISH_STATUS__ ? window.__SLACKPOLISH_STATUS__.state : null
            };
        })()`);
    }

    async assertTarget() {
        const info = await this.describeTarget();
        if (!info.found) throw new Error('No visible message composer found in the Slack window.');
        const label = info.ariaLabel || '';
        if (!label.toLowerCase().includes(this.composerLabel.toLowerCase())) {
            throw new Error(`Refusing to type: composer is "${label}" but the suite is configured for "${this.composerLabel}". Open that conversation first.`);
        }
        return info;
    }

    async focus() {
        await this.cdp.evaluate(`(() => {
            const ed = ${FIND_COMPOSER_JS};
            if (!ed) return false;
            const sel = window.getSelection();
            // Keep an existing non-collapsed selection inside the editor (selection scenarios)
            if (sel && sel.rangeCount && !sel.isCollapsed && ed.contains(sel.anchorNode) && ed.contains(sel.focusNode)) {
                ed.focus();
                return document.activeElement === ed;
            }
            ed.focus();
            const range = document.createRange(); range.selectNodeContents(ed); range.collapse(false);
            sel.removeAllRanges(); sel.addRange(range);
            return document.activeElement === ed;
        })()`);
    }

    async key(type, { key, code = '', vk = 0, text, modifiers = 0 }) {
        const params = { type, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers };
        if (type === 'keyDown' && text !== undefined) { params.text = text; params.unmodifiedText = text; }
        await this.cdp.send('Input.dispatchKeyEvent', params);
    }

    async press(descriptor) {
        await this.key('keyDown', descriptor);
        await this.key('keyUp', { ...descriptor, text: undefined });
    }

    /** Type text with real key events. "\n" becomes Shift+Enter (never a bare Enter). */
    async type(text, { delayMs = 4 } = {}) {
        let rest = text;
        const marker = /^(> |1\. |- |\* )/.exec(text);
        if (marker) {
            await this.typeMarker(marker[1]);
            rest = text.slice(marker[1].length);
        }
        for (const ch of rest) {
            if (ch === '\n') { await this.newline(); continue; }
            const d = keyDescriptor(ch);
            await this.press({ ...d, text: ch });
            if (delayMs) await sleep(delayMs);
        }
    }

    /**
     * Type a block-format marker ("> ", "1. ", "- ") and verify Slack's autoformat applied it.
     * Slack occasionally misses the conversion when keys arrive quickly; undo and retry.
     */
    async typeMarker(marker) {
        const predicate = marker === '> ' ? "ed.querySelector('blockquote')" : marker === '1. ' ? "ed.querySelector('ol')" : "ed.querySelector('ul')";
        const typeIt = async () => { for (const ch of marker) { const d = keyDescriptor(ch); await this.press({ ...d, text: ch }); await sleep(25); } };
        for (let attempt = 1; attempt <= 3; attempt++) {
            await typeIt();
            if (await this.waitForComposer(predicate, { timeoutMs: 700, intervalMs: 50 })) return true;
            for (let i = 0; i < marker.length; i++) await this.press({ key: 'Backspace', code: 'Backspace', vk: 8 });
            await sleep(200);
        }
        this.log(`  (Slack did not autoformat "${marker.trim()}" after 3 attempts; leaving it as literal text)`);
        await typeIt();
        return false;
    }

    async newline() {
        await this.press({ key: 'Enter', code: 'Enter', vk: 13, text: '\r', modifiers: MOD.shift });
        await sleep(40);
    }

    async tab() {
        await this.press({ key: 'Tab', code: 'Tab', vk: 9 });
    }

    /** Type an @/# query, wait for Slack's autocomplete, accept with Tab, verify the pill appeared. */
    async mention(query, labelIncludes) {
        await this.type(query);
        const popup = "document.querySelector('[data-qa*=\"autocomplete\"], .c-tabcomplete, [role=\"listbox\"]')";
        const appeared = await this.waitForComposer(popup, { timeoutMs: 5000, intervalMs: 100 });
        if (!appeared) return { ok: false, reason: `autocomplete for "${query}" did not appear` };
        await sleep(350);
        // Only accept if the popup actually offers what we asked for (never pick a random person)
        const offered = await this.cdp.evaluate(`(() => { const el = ${popup}; return el ? (el.textContent || '').toLowerCase() : ''; })()`);
        if (labelIncludes && !offered.includes(labelIncludes.toLowerCase())) {
            await this.press({ key: 'Escape', code: 'Escape', vk: 27 });
            return { ok: false, reason: `autocomplete does not offer "${labelIncludes}" here (offers: ${offered.slice(0, 80).replace(/\s+/g, ' ')})` };
        }
        await this.tab();
        const needle = JSON.stringify((labelIncludes || '').toLowerCase());
        const created = await this.waitForComposer(`[...ed.querySelectorAll('ts-mention')].some(m => (m.getAttribute('data-label') || m.textContent || '').toLowerCase().includes(${needle}))`, { timeoutMs: 2500, intervalMs: 100 });
        if (!created) {
            const labels = await this.cdp.evaluate(`(() => { const ed = ${FIND_COMPOSER_JS}; return ed ? [...ed.querySelectorAll('ts-mention')].map(m => m.getAttribute('data-label')) : []; })()`);
            return { ok: false, reason: `pill containing "${labelIncludes}" not created (got ${JSON.stringify(labels)})` };
        }
        await sleep(150);
        return { ok: true, note: `pill for "${query}" created` };
    }

    async backspace() {
        await this.press({ key: 'Backspace', code: 'Backspace', vk: 8 });
        await sleep(60);
    }

    /** Paste plain text via a synthetic ClipboardEvent (what Slack's link/slug resolution reacts to). */
    async paste(text) {
        const ok = await this.cdp.evaluate(`(() => {
            const ed = ${FIND_COMPOSER_JS};
            if (!ed) return false;
            ed.focus();
            const dt = new DataTransfer();
            dt.setData('text/plain', ${JSON.stringify(text)});
            const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
            ed.dispatchEvent(ev);
            return true;
        })()`);
        if (!ok) throw new Error('Composer not found for paste');
        await sleep(150);
        // If Slack ignored the synthetic paste, fall back to typing the text.
        const text_ = await this.readText();
        if (!text_.includes(text)) {
            this.log(`  (synthetic paste ignored; typing "${text.slice(0, 40)}…" instead)`);
            await this.type(text, { delayMs: 2 });
        }
    }

    /** Set the composer DOM directly (used to reproduce exact states Slack has been observed to produce). */
    async setHtml(html) {
        const ok = await this.cdp.evaluate(`(() => {
            const ed = ${FIND_COMPOSER_JS};
            if (!ed) return false;
            ed.focus();
            ed.innerHTML = ${JSON.stringify(html)};
            ed.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: false, inputType: 'insertReplacementText' }));
            return true;
        })()`);
        if (!ok) throw new Error('Composer not found for setHtml');
        await sleep(400);
    }

    async readText() {
        return this.cdp.evaluate(`(() => { const ed = ${FIND_COMPOSER_JS}; return ed ? (ed.textContent || '') : ''; })()`);
    }

    /** Wait until `predicateJs` (evaluated against the composer element `ed`) is truthy. */
    async waitForComposer(predicateJs, { timeoutMs = 8000, intervalMs = 200 } = {}) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const ok = await this.cdp.evaluate(`(() => { const ed = ${FIND_COMPOSER_JS}; if (!ed) return false; return !!(${predicateJs}); })()`);
            if (ok) return true;
            await sleep(intervalMs);
        }
        return false;
    }

    /** Select an exact substring of the composer text (must live inside one text node). */
    async select(substring) {
        return this.cdp.evaluate(`(() => {
            const ed = ${FIND_COMPOSER_JS};
            if (!ed) return { ok: false, reason: 'no composer' };
            const needle = ${JSON.stringify(substring)};
            const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
                const idx = node.textContent.indexOf(needle);
                if (idx !== -1) {
                    const range = document.createRange();
                    range.setStart(node, idx); range.setEnd(node, idx + needle.length);
                    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
                    ed.focus();
                    return { ok: true, selected: sel.toString() };
                }
            }
            return { ok: false, reason: 'substring not found in a single text node' };
        })()`);
    }

    /** Cmd+A then Backspace, verified; falls back to a DOM reset + input event. */
    async clear() {
        await this.focus();
        await this.press({ key: 'a', code: 'KeyA', vk: 65, modifiers: MOD.meta });
        await sleep(60);
        await this.press({ key: 'Backspace', code: 'Backspace', vk: 8 });
        await sleep(150);
        let info = await this.describeTarget();
        if (!info.isEmpty) {
            await this.cdp.evaluate(`(() => {
                const ed = ${FIND_COMPOSER_JS};
                if (!ed) return;
                ed.innerHTML = '<p><br></p>';
                ed.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: false, inputType: 'deleteContentBackward' }));
            })()`);
            await sleep(200);
            info = await this.describeTarget();
        }
        if (!info.isEmpty) throw new Error('Could not clear the composer');
    }

    async pressHotkey(hotkey = 'Ctrl+Shift') {
        const parts = hotkey.split('+');
        const wantsCtrl = parts.includes('Ctrl'), wantsShift = parts.includes('Shift'), wantsAlt = parts.includes('Alt'), wantsTab = parts.includes('Tab');
        let mods = 0;
        const held = [];
        const hold = async (key, code, vk, bit) => { mods |= bit; held.push({ key, code, vk, bit }); await this.key('keyDown', { key, code, vk, modifiers: mods }); await sleep(30); };
        if (wantsCtrl) await hold('Control', 'ControlLeft', 17, MOD.ctrl);
        if (wantsAlt) await hold('Alt', 'AltLeft', 18, MOD.alt);
        if (wantsShift) await hold('Shift', 'ShiftLeft', 16, MOD.shift);
        if (wantsTab) await this.press({ key: 'Tab', code: 'Tab', vk: 9, modifiers: mods });
        await sleep(60);
        for (const h of held.reverse()) { mods &= ~h.bit; await this.key('keyUp', { key: h.key, code: h.code, vk: h.vk, modifiers: mods }); }
    }

    async status() {
        return this.cdp.evaluate(`window.__SLACKPOLISH_STATUS__ ? window.__SLACKPOLISH_STATUS__.state : null`);
    }

    /** SlackPolish error/notification toasts currently on screen. */
    async toasts() {
        return this.cdp.evaluate(`[...document.body.children]
            .filter(el => el.tagName === 'DIV' && el.style && el.style.position === 'fixed' && el.style.top === '20px' && el.style.right === '20px')
            .map(el => (el.textContent || '').trim()).filter(Boolean)`);
    }

    /** Wait until no SlackPolish toast is on screen (they linger ~3s after a previous attempt). */
    async waitForNoToasts(timeoutMs = 6000) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            if ((await this.toasts()).length === 0) return true;
            await sleep(150);
        }
        return false;
    }

    /**
     * Press the hotkey and wait for the outcome. The toast baseline and t0 are captured BEFORE the key
     * press: SlackPolish's guards ("Nothing to polish") toast synchronously on keydown.
     */
    async polishAndWait(hotkey = 'Ctrl+Shift', opts = {}) {
        const baseline = new Set(await this.toasts());
        const t0 = Date.now();
        await this.pressHotkey(hotkey);
        return this.waitForPolish({ ...opts, baseline, t0 });
    }

    /** Wait for a polish to start (busy) and finish (not busy). */
    async waitForPolish({ startTimeoutMs = 5000, finishTimeoutMs = 90000, baseline = null, t0 = null } = {}) {
        t0 = t0 || Date.now();
        let sawBusy = false;
        baseline = baseline || new Set(await this.toasts()); // toasts that pre-date this attempt are not its outcome
        const seenToasts = new Set();
        const collectToasts = async () => { for (const t of await this.toasts()) if (!baseline.has(t)) seenToasts.add(t); };
        while (Date.now() - t0 < startTimeoutMs) {
            await collectToasts();
            if ((await this.status()) === 'busy') { sawBusy = true; break; }
            // A guard (e.g. "Nothing to polish") ends the attempt without ever going busy
            if ([...seenToasts].some(t => /Nothing to polish|No text to improve/i.test(t))) break;
            await sleep(100);
        }
        if (!sawBusy) {
            await collectToasts();
            const logs = this.cdp.consoleLogs.filter(l => l.t >= t0 && /SLACKPOLISH|Nothing to polish/i.test(l.text)).map(l => l.text);
            if (logs.some(l => /Nothing to polish/i.test(l))) seenToasts.add('Nothing to polish');
            return { triggered: false, finalState: await this.status(), toasts: [...seenToasts], durationMs: Date.now() - t0, logs };
        }
        while (Date.now() - t0 < finishTimeoutMs) {
            await collectToasts();
            const state = await this.status();
            if (state !== 'busy') {
                await sleep(700); // let Quill normalise the inserted DOM
                await collectToasts();
                const logs = this.cdp.consoleLogs.filter(l => l.t >= t0 && /SLACKPOLISH|DEBUG:|merged lines|Nothing to polish/i.test(l.text)).map(l => l.text);
                return { triggered: true, finalState: state, toasts: [...seenToasts], durationMs: Date.now() - t0, logs };
            }
            await sleep(200);
        }
        return { triggered: true, finalState: 'timeout', toasts: [...seenToasts], durationMs: Date.now() - t0 };
    }

    async messageCount() {
        return this.cdp.evaluate(`document.querySelectorAll('[data-qa="message_container"]').length`);
    }

    /** Structured snapshot of the composer DOM. */
    async snapshot() {
        return this.cdp.evaluate(`(() => {
            const ed = ${FIND_COMPOSER_JS};
            if (!ed) return null;
            const q = (s) => [...ed.querySelectorAll(s)];
            const text = ed.textContent || '';
            return {
                html: ed.innerHTML,
                text,
                lines: [...ed.children].map(c => c.textContent),
                counts: { p: q('p').length, blockquote: q('blockquote').length, ol: q('ol').length, ul: q('ul').length, li: q('li').length, a: q('a').length, tsSlug: q('ts-slug').length, tsMention: q('ts-mention').length,
                          code: q('code').length, pre: q('pre, .ql-code-block').length, strong: q('strong, b').length, em: q('em, i').length, strike: q('s, del, strike').length,
                          emoji: q('img, [data-stringify-emoji], ts-emoji, .c-emoji, span[data-emoji]').length },
                codeSpans: q('code').map(c => c.textContent),
                preBlocks: q('pre, .ql-code-block').map(p => p.textContent),
                emojis: q('img, [data-stringify-emoji], ts-emoji, .c-emoji, span[data-emoji]').map(e => ({ tag: e.tagName, alt: e.getAttribute('alt'), name: e.getAttribute('data-stringify-emoji') || e.getAttribute('data-emoji') || e.getAttribute('data-name'), cls: String(e.className).slice(0, 60) })),
                otherTags: [...new Set(q('*').map(e => e.tagName.toLowerCase()).filter(t => !['p','br','blockquote','ol','ul','li','a','ts-slug','ts-mention'].includes(t)))],
                mentionDetails: q('ts-mention').map(m => ({ id: m.getAttribute('data-id'), label: m.getAttribute('data-label'), cls: String(m.className).slice(0, 80) })),
                anchors: q('a').map(a => ({ href: a.getAttribute('href'), text: a.textContent })),
                slugs: q('ts-slug').map(s => ({ url: s.getAttribute('data-url'), label: s.textContent, resolved: s.classList.contains('c-slackslug--resolved') })),
                mentions: q('ts-mention').map(m => ({ id: m.getAttribute('data-id'), text: m.textContent })),
                blockquotes: q('blockquote').map(b => b.textContent),
                listItems: q('li').map(li => li.textContent),
                urlsInText: [...text.matchAll(/https?:\\/\\/[^\\s<>"']+/g)].map(m => m[0]),
                leaks: /__SLACKPOLISH_/.test(ed.innerHTML)
            };
        })()`);
    }
}
