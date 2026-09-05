/**
 * Find and describe the editable field the hotkey was pressed in.
 *
 * kinds: prosemirror (Atlassian editor: Jira, Confluence), quill (Slack web), contenteditable,
 *        textarea, input, none.
 * describe() returns the text plus a compact DOM "vocabulary" (tag.class combos and attribute
 * NAMES of the editor's descendants) - enough to design an editor adapter without seeing the page.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.SlackPolishEditor = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const EDITOR_SELECTORS = [
        '.ProseMirror[contenteditable="true"]',
        '.ql-editor[contenteditable="true"]',
        '[contenteditable="true"]',
        'textarea'
    ];

    function isEditable(el) {
        if (!el || el.nodeType !== 1) return false;
        const tag = el.tagName.toLowerCase();
        if (tag === 'textarea') return true;
        if (tag === 'input') return /^(text|search|email|url|)$/.test((el.getAttribute('type') || '').toLowerCase());
        return el.isContentEditable === true;
    }

    /** Pure: classify an editable element from its tag/class/ancestry hints. */
    function classify(tagName, className, hints) {
        const tag = String(tagName || '').toLowerCase();
        const cls = String(className || '');
        const h = hints || {};
        if (tag === 'textarea') return 'textarea';
        if (tag === 'input') return 'input';
        if (/\bProseMirror\b/.test(cls) || h.insideProseMirror || h.dataEditorType === 'prosemirror') return 'prosemirror';
        if (/\bql-editor\b/.test(cls) || h.insideQuill) return 'quill';
        return 'contenteditable';
    }

    /** The editable root that owns `el` (walk up to the contenteditable host / ProseMirror root). */
    function editableRoot(el) {
        let node = el;
        let root = null;
        while (node && node.nodeType === 1) {
            if (node.tagName === 'TEXTAREA' || node.tagName === 'INPUT') return node;
            if (node.getAttribute && node.getAttribute('contenteditable') === 'true') root = node;
            node = node.parentElement;
        }
        return root;
    }

    function isVisible(el) {
        return !!(el && el.offsetParent !== null && el.getClientRects().length);
    }

    /** Focused editable first; otherwise the first visible editor on the page. */
    function findActive(doc) {
        const active = doc.activeElement;
        if (active && active !== doc.body && isEditable(active)) {
            return editableRoot(active) || active;
        }
        for (const selector of EDITOR_SELECTORS) {
            const el = [...doc.querySelectorAll(selector)].find(isVisible);
            if (el) return el;
        }
        return null;
    }

    /** Pure: drop zero-width characters Atlassian's inline node views pad mentions/cards with. */
    function stripZeroWidth(text) {
        return String(text || '').replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
    }

    /** Pure: which Jira field an editor is, from Atlassian's aria-label ("Comment area…", "Main content area…"). */
    function fieldFromAriaLabel(label) {
        const l = String(label || '').toLowerCase();
        if (/\bcomment\b/.test(l)) return 'comment';
        if (/main content|description/.test(l)) return 'description';
        return null;
    }

    function extractText(el) {
        if (!el) return '';
        const tag = el.tagName.toLowerCase();
        if (tag === 'textarea' || tag === 'input') return el.value || '';
        // innerText keeps line breaks between blocks; textContent does not
        return stripZeroWidth((el.innerText !== undefined ? el.innerText : el.textContent) || '');
    }

    function vocabulary(el, limit) {
        const seen = new Map();
        for (const node of el.querySelectorAll('*')) {
            const classes = String(node.className && node.className.baseVal !== undefined ? node.className.baseVal : node.className || '')
                .trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.');
            const attrs = [...node.attributes].map(a => a.name).filter(n => n !== 'class' && n !== 'style').sort().join(',');
            const key = node.tagName.toLowerCase() + (classes ? '.' + classes : '') + (attrs ? '[' + attrs + ']' : '');
            seen.set(key, (seen.get(key) || 0) + 1);
            if (seen.size >= (limit || 40)) break;
        }
        return [...seen.entries()].map(([k, n]) => (n > 1 ? `${k} x${n}` : k));
    }

    function describe(el, options) {
        if (!el) return { kind: 'none' };
        const maxText = (options && options.maxText) || 5000;
        const kind = classify(el.tagName, el.className, {
            insideProseMirror: !!el.closest('.ProseMirror, .ak-editor-content-area, [data-editor-container-id]'),
            insideQuill: !!el.closest('.ql-container'),
            dataEditorType: el.getAttribute('data-editor-type') || ''
        });
        const text = extractText(el);
        const isField = kind === 'textarea' || kind === 'input';
        const blocks = isField ? [] : [...el.children].slice(0, 30).map(b => `${b.getAttribute('data-prosemirror-node-name') || b.tagName.toLowerCase()}${b.className && !b.getAttribute('data-prosemirror-node-name') ? '.' + String(b.className).trim().split(/\s+/).slice(0, 2).join('.') : ''}: ${stripZeroWidth(b.innerText || b.textContent || '').trim().slice(0, 80)}`);
        // Atlassian's editor names every node (paragraph, mention, inlineCard, bulletList, codeBlock, ...): the vocabulary an adapter is built on
        const nodeNames = isField ? [] : [...new Set([...el.querySelectorAll('[data-prosemirror-node-name]')].map(n => n.getAttribute('data-prosemirror-node-name')))].slice(0, 40);
        const inlineNodes = isField ? [] : [...el.querySelectorAll('[data-prosemirror-node-inline]')].slice(0, 30).map(n => ({ nodeName: n.getAttribute('data-prosemirror-node-name'), text: stripZeroWidth(n.textContent).trim().slice(0, 80) }));
        return {
            kind,
            field: fieldFromAriaLabel(el.getAttribute('aria-label')),
            nodeNames,
            inlineNodes,
            tag: el.tagName.toLowerCase(),
            id: el.id || null,
            classes: String(el.className || '').trim().split(/\s+/).filter(Boolean).slice(0, 6),
            attrs: [...el.attributes].map(a => a.name).filter(n => !['class', 'style', 'id'].includes(n)).sort(),
            ariaLabel: el.getAttribute('aria-label') || null,
            textLength: text.length,
            text: text.slice(0, maxText),
            blocks,
            vocabulary: kind === 'textarea' || kind === 'input' ? [] : vocabulary(el, 40)
        };
    }

    return { EDITOR_SELECTORS, isEditable, classify, editableRoot, findActive, extractText, describe, stripZeroWidth, fieldFromAriaLabel };
});
