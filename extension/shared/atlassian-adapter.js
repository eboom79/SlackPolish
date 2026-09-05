/**
 * Atlassian editor (Jira / Confluence, ProseMirror) adapter.
 *
 * extract(root)  -> { text, entities }   text for the model with __SLACKPOLISH_*__ tokens standing in for
 *                                          mentions, emoji, inline cards, links, inline code and other node views
 * buildHtml()    -> HTML that re-creates the document from (possibly polished) text: tokens are replaced by
 *                   the ORIGINAL node HTML, which the editor's own parseDOM rules recognise
 * writeBack()    -> selects the editor content and inserts the HTML through the editor's paste pipeline
 *                   (ProseMirror re-renders from state; direct DOM mutation would be reverted)
 * roundTrip()    -> extract -> rebuild the same text -> writeBack -> compare: proves the mechanism is lossless
 *
 * Vocabulary confirmed on Jira Cloud (Sep 2026): every node has data-prosemirror-node-name (paragraph, mention,
 * emoji, blockquote, ...), marks have data-prosemirror-mark-name (link, code, ...), inline node views carry
 * data-prosemirror-node-inline and are padded with zero-width spaces.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.SlackPolishAtlassian = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const ZW = /[\u200B\u200C\u200D\uFEFF]/g;
    const TOKEN_RE = /(__SLACKPOLISH_(?:MENTION|LINK|CODE|EMOJI|NODE|QUOTE)_\d+__)/g;
    const BLOCK_HTML_RE = /^<(pre|div|table|ul|ol|blockquote|hr|figure)\b/i;

    function isAtlassianEditor(el) {
        if (!el || !el.classList || !el.classList.contains('ProseMirror')) return false;
        return el.id === 'ak-editor-textarea' || !!el.closest('.ak-editor-content-area, [data-editor-id]') || !!el.querySelector('[data-prosemirror-node-name]');
    }

    const nodeName = (el) => (el.getAttribute && el.getAttribute('data-prosemirror-node-name')) || null;
    const markName = (el) => (el.getAttribute && el.getAttribute('data-prosemirror-mark-name')) || null;
    const clean = (s) => String(s || '').replace(ZW, '');

    function newState() {
        return { text: '', entities: [], counters: {} };
    }

    function tokenFor(state, kind, el, text, html) {
        state.counters[kind] = (state.counters[kind] || 0) + 1;
        const token = `__SLACKPOLISH_${kind}_${state.counters[kind]}__`;
        const entity = { token, kind, text: clean(text).trim(), html: html !== undefined ? html : el.outerHTML };
        if (kind === 'LINK' && el.getAttribute) entity.href = el.getAttribute('href') || el.getAttribute('data-card-url') || '';
        state.entities.push(entity);
        return token;
    }

    function inlineText(el, state) {
        let out = '';
        for (const child of el.childNodes) {
            if (child.nodeType === 3) { out += clean(child.textContent); continue; }
            if (child.nodeType !== 1) continue;
            if (child.tagName === 'BR') continue; // ProseMirror-trailingBreak
            const nn = nodeName(child);
            if (child.hasAttribute('data-prosemirror-node-inline') || ['mention', 'emoji', 'inlineCard', 'status', 'date'].includes(nn)) {
                const kind = nn === 'mention' ? 'MENTION' : nn === 'emoji' ? 'EMOJI' : nn === 'inlineCard' ? 'LINK' : 'NODE';
                const label = child.getAttribute('data-emoji-short-name') || child.getAttribute('data-emoji-text') || clean(child.textContent).trim() || nn || 'node';
                out += tokenFor(state, kind, child, label);
                continue;
            }
            const mn = markName(child);
            if (child.tagName === 'A' || mn === 'link') { out += tokenFor(state, 'LINK', child, child.textContent); continue; }
            if (child.tagName === 'CODE' || mn === 'code') { out += tokenFor(state, 'CODE', child, child.textContent); continue; }
            out += inlineText(child, state); // strong / em / other marks: text only for now
        }
        return out;
    }

    function blockLines(el, state, prefix) {
        prefix = prefix || '';
        const nn = nodeName(el);
        const tag = el.tagName;
        const lines = [];
        if (nn === 'paragraph' || tag === 'P') {
            lines.push(prefix + inlineText(el, state));
        } else if (nn === 'blockquote' || tag === 'BLOCKQUOTE') {
            // Quoted words are someone else's: each quoted paragraph becomes a QUOTE token (as in Slack).
            // Its text keeps nested inline tokens; its html is the paragraph's inner HTML for write-back.
            for (const child of el.children) {
                const inner = inlineText(child, state);
                if (!inner.trim()) continue;
                lines.push('> ' + tokenFor(state, 'QUOTE', child, inner, child.innerHTML));
                state.entities[state.entities.length - 1].text = inner; // keep raw (tokens inside)
            }
        } else if (nn === 'bulletList' || tag === 'UL') {
            for (const item of el.children) lines.push(...blockLines(item, state, '• '));
        } else if (nn === 'orderedList' || tag === 'OL') {
            let index = 1;
            for (const item of el.children) lines.push(...blockLines(item, state, `${index++}. `));
        } else if (nn === 'listItem' || tag === 'LI') {
            if (!el.children.length) { lines.push(prefix + inlineText(el, state)); }
            let first = true;
            for (const child of el.children) { lines.push(...blockLines(child, state, first ? prefix : '   ')); first = false; }
        } else if (nn === 'codeBlock' || tag === 'PRE') {
            lines.push(prefix + tokenFor(state, 'CODE', el, el.textContent));
        } else if (nn === 'heading' || /^H[1-6]$/.test(tag)) {
            lines.push(prefix + inlineText(el, state));
        } else if (nn || el.hasAttribute('data-prosemirror-node-block')) {
            // panels, tables, cards, media, rules...: opaque, preserved as-is
            lines.push(prefix + tokenFor(state, 'NODE', el, clean(el.textContent).trim().slice(0, 60) || nn));
        } else {
            lines.push(prefix + inlineText(el, state));
        }
        return lines;
    }

    function finish(state, lines) {
        state.text = lines.join('\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
        return state;
    }

    function extract(root) {
        const state = newState();
        const lines = [];
        for (const block of root.children) lines.push(...blockLines(block, state));
        return finish(state, lines);
    }

    /** Extract the selected part of the editor (DocumentFragment from range.cloneContents()). */
    function extractFragment(fragment) {
        const state = newState();
        const lines = [];
        const hasBlocks = [...fragment.childNodes].some(n => n.nodeType === 1 && (nodeName(n) || /^(P|BLOCKQUOTE|UL|OL|LI|PRE|H[1-6]|DIV)$/.test(n.tagName)));
        if (hasBlocks) {
            for (const node of fragment.childNodes) {
                if (node.nodeType === 1) lines.push(...blockLines(node, state));
                else if (node.nodeType === 3 && clean(node.textContent).trim()) lines.push(clean(node.textContent));
            }
        } else {
            lines.push(inlineText(fragment, state));
        }
        return finish(state, lines);
    }

    const escapeHtml = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const find = (entities, token) => entities.find(e => e.token === token);

    function inlineHtml(text, entities) {
        return text.split(TOKEN_RE).map(part => {
            if (!part) return '';
            const entity = find(entities, part);
            if (entity) return entity.html;
            // HTML parsing folds runs of spaces; alternate with non-breaking spaces so typed spacing survives
            return escapeHtml(part).replace(/ {2,}/g, run => run.split('').map((c, i) => (i % 2 ? '&nbsp;' : ' ')).join(''));
        }).join('');
    }

    /** Rebuild document HTML from model text (quotes "> ", bullets "• "/"- ", numbers "1. ", blank lines) + entity HTML. */
    function buildHtml(text, entities) {
        const lines = String(text || '').split('\n');
        const isQuote = l => /^>\s?/.test(l), isBullet = l => /^[•\-*]\s/.test(l), isNumbered = l => /^\d+\.\s/.test(l);
        let html = '';
        let i = 0;
        while (i < lines.length) {
            const line = lines[i];
            if (isQuote(line)) {
                let inner = '';
                while (i < lines.length && isQuote(lines[i])) {
                    const content = lines[i].replace(/^>\s?/, '').trim();
                    const quote = /^__SLACKPOLISH_QUOTE_\d+__$/.test(content) ? find(entities, content) : null;
                    inner += `<p>${quote ? inlineHtml(quote.text, entities) : inlineHtml(content, entities)}</p>`;
                    i++;
                }
                html += `<blockquote>${inner}</blockquote>`;
                continue;
            }
            if (isBullet(line) || isNumbered(line)) {
                const numbered = isNumbered(line);
                const test = numbered ? isNumbered : isBullet;
                let inner = '';
                while (i < lines.length && test(lines[i])) { inner += `<li><p>${inlineHtml(lines[i].replace(numbered ? /^\d+\.\s/ : /^[•\-*]\s/, ''), entities)}</p></li>`; i++; }
                html += numbered ? `<ol>${inner}</ol>` : `<ul>${inner}</ul>`;
                continue;
            }
            const sole = line.trim().match(/^(__SLACKPOLISH_(?:CODE|NODE)_\d+__)$/);
            const blockEntity = sole && find(entities, sole[1]);
            if (blockEntity && BLOCK_HTML_RE.test(blockEntity.html)) { html += blockEntity.html; i++; continue; }
            html += line.trim() === '' ? '<p></p>' : `<p>${inlineHtml(line, entities)}</p>`;
            i++;
        }
        return html;
    }

    function plainText(text, entities, depth) {
        depth = depth || 0;
        if (depth > 5) return String(text || '');
        return String(text || '').replace(TOKEN_RE, token => {
            const e = find(entities, token);
            if (!e) return token;
            return e.kind === 'QUOTE' ? plainText(e.text, entities, depth + 1) : e.text;
        });
    }

    function selectAll(root) {
        const range = document.createRange();
        range.selectNodeContents(root);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    /**
     * ProseMirror pastes the text/plain flavour while it believes Shift is held (view.input.shiftKey, set on
     * keydown, cleared only by Shift's keyup). Our hotkey is Ctrl+Shift, so wait for the real release and
     * then also send a synthetic Shift keyup to the editor before pasting.
     */
    async function releaseModifiers(root) {
        let waited = 0;
        if (typeof SlackPolishHotkey !== 'undefined' && SlackPolishHotkey.whenModifiersReleased) {
            waited = await SlackPolishHotkey.whenModifiersReleased(2000);
        }
        for (const [key, code, keyCode] of [['Shift', 'ShiftLeft', 16], ['Control', 'ControlLeft', 17]]) {
            root.dispatchEvent(new KeyboardEvent('keyup', { key, code, keyCode, which: keyCode, bubbles: true }));
        }
        return waited;
    }

    /** Replace the current selection (default: everything) through the editor's paste pipeline. */
    async function writeBack(root, html, plain, options) {
        root.focus();
        if (!(options && options.keepSelection)) selectAll(root);
        const waitedForKeysMs = await releaseModifiers(root);
        await wait(60); // ProseMirror syncs its selection from the DOM selection
        const data = new DataTransfer();
        data.setData('text/html', html);
        data.setData('text/plain', plain);
        const notCancelled = root.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
        await wait(400);
        // A synthetic (untrusted) paste has no browser default action: if the editor did not handle it, nothing changed
        return { handled: !notCancelled, waitedForKeysMs };
    }

    /** Extract -> rebuild the SAME text -> write back -> compare. Proves the mechanism is lossless on this editor. */
    async function roundTrip(root, describe) {
        const before = describe(root);
        const state = extract(root);
        const html = buildHtml(state.text, state.entities);
        const plain = plainText(state.text, state.entities);
        const paste = await writeBack(root, html, plain);
        const after = describe(root);
        const norm = (s) => String(s || '').replace(ZW, '').replace(/\s+/g, ' ').trim();
        const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
        const textSame = norm(before.text) === norm(after.text);
        const nodesSame = same(before.nodeNames, after.nodeNames) && same(before.inlineNodes, after.inlineNodes);
        return {
            ok: paste.handled && textSame && nodesSame,
            pasteHandled: paste.handled,
            waitedForKeysMs: paste.waitedForKeysMs,
            textSame,
            nodesSame,
            modelText: state.text,
            entities: state.entities.map(e => ({ token: e.token, kind: e.kind, text: e.text })),
            htmlLength: html.length,
            before: { text: before.text, nodeNames: before.nodeNames, inlineNodes: before.inlineNodes, blocks: before.blocks },
            after: { text: after.text, nodeNames: after.nodeNames, inlineNodes: after.inlineNodes, blocks: after.blocks }
        };
    }

    return { TOKEN_RE, isAtlassianEditor, extract, extractFragment, buildHtml, plainText, inlineHtml, writeBack, roundTrip };
});
