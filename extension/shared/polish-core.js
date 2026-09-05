/**
 * Polishing core for the browser extension: prompt (parity with the Slack script), model-output repair
 * (tokens the model dropped or echoed), and post-write-back verification.
 *
 * Works on the adapter's model text (Slack-style lines with "> ", "• ", "1. ") and its entities
 * ({ token, kind, text, html }). Prompts/styles/languages/model come from the vendored slack-config.js
 * (window.SLACKPOLISH_CONFIG) so the two surfaces cannot drift.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.SlackPolishCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const TOKEN_RE = /(__SLACKPOLISH_(?:MENTION|LINK|CODE|EMOJI|NODE|QUOTE)_\d+__)/g;
    const INLINE_TOKEN_RE = /__SLACKPOLISH_(?:MENTION|LINK|CODE|EMOJI|NODE)_\d+__/g;

    function config() {
        return (typeof window !== 'undefined' && window.SLACKPOLISH_CONFIG) || (typeof globalThis !== 'undefined' && globalThis.SLACKPOLISH_CONFIG) || {};
    }

    const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const find = (entities, token) => (entities || []).find(e => e.token === token);

    /** Expand quote tokens so presence checks see the tokens nested inside them (mirrors the Slack script). */
    function expandQuoteTokens(text, entities, depth) {
        depth = depth || 0;
        if (!text || depth > 5) return text || '';
        return text.replace(/__SLACKPOLISH_QUOTE_\d+__/g, token => {
            const quote = find(entities, token);
            return quote && quote.kind === 'QUOTE' ? expandQuoteTokens(quote.text, entities, depth + 1) : token;
        });
    }

    function detokenize(text, entities, depth) {
        depth = depth || 0;
        if (depth > 5) return text || '';
        return String(text || '').replace(TOKEN_RE, token => {
            const e = find(entities, token);
            if (!e) return token;
            return e.kind === 'QUOTE' ? detokenize(e.text, entities, depth + 1) : e.text;
        });
    }

    /** The writer's own words remain after removing tokens, URLs and bare quote markers? */
    function isPolishable(text) {
        const rest = String(text || '').replace(/__SLACKPOLISH_[A-Z]+_\d+__|https?:\/\/\S+|www\.\S+|^\s*>\s*$/gm, '').trim();
        return /\p{L}/u.test(rest);
    }

    function countContentLines(text) {
        return String(text || '').split('\n').filter(line => line.trim()).length;
    }

    /**
     * Same prompt as the Slack script's buildPrompt(), minus Smart Context, plus optional Jira context.
     * @param {object} p  { text, style, language, entities, context: { issueTitle } }
     */
    function buildPrompt(p) {
        const cfg = config();
        const styles = (cfg.PROMPTS && cfg.PROMPTS.STYLES) || {};
        const style = p.style || 'TONE_POLISH';
        const language = p.language || 'English';
        const styleInstruction = styles[style] || `please improve ONLY the following message to be more ${style} in ${language}`;
        const entities = p.entities || [];

        let prompt = 'You are helping improve a comment written in Jira/Confluence.';
        if (p.context && p.context.issueTitle) {
            prompt += `\nFor reference only, it is a comment on the issue: "${String(p.context.issueTitle).slice(0, 160)}". Do not reproduce or paraphrase this title.`;
        }
        prompt += `

${styleInstruction}

=== MESSAGE TO IMPROVE (improve ONLY the text between these markers) ===
${p.text}
=== END OF MESSAGE TO IMPROVE ===

IMPORTANT: Respond with ONLY the improved version of the MESSAGE TO IMPROVE above. Do not include any explanations, quotation marks, requirements, or additional text. Do not reproduce or paraphrase the conversation context. Preserve the line structure: keep each line that starts with a quote marker (">") or a list marker ("1.", "•", "-") on its own line, beginning with the same marker. Leave URLs, file paths, and identifiers such as issue keys (e.g. RED-1234, PROJ-42) exactly as written. Use ${language} language.`;

        const inlineTokens = [...new Set(String(p.text).match(INLINE_TOKEN_RE) || [])];
        if (inlineTokens.length) {
            prompt += '\nIMPORTANT: Tokens like __SLACKPOLISH_MENTION_1__, __SLACKPOLISH_LINK_1__, __SLACKPOLISH_CODE_1__ and __SLACKPOLISH_EMOJI_1__ represent real entities such as mentions and links, inline code and emoji. Preserve every such token exactly, in place, without renaming, removing, reordering, or breaking it. Never add a token that is not already in the message.';
        }
        const quotes = entities.filter(e => e.kind === 'QUOTE');
        if (quotes.length) {
            prompt += '\nIMPORTANT: Lines of the form "> __SLACKPOLISH_QUOTE_n__" are quotations of someone else\'s words. Return every such line exactly as "> __SLACKPOLISH_QUOTE_n__", in the same order, without rewriting, merging, removing or reordering them. For context only, the quoted lines read:';
            quotes.forEach(q => { prompt += `\n${q.token}: "${detokenize(q.text, entities)}"`; });
        }
        const customInstructions = (p.customInstructions !== undefined ? p.customInstructions : cfg.CUSTOM_INSTRUCTIONS) || '';
        if (String(customInstructions).trim()) {
            prompt += `\n- Additional instructions: ${String(customInstructions).trim()}`;
        }
        return prompt;
    }

    /**
     * Repair the model output (mirrors restoreMissingProtectedTokens in the Slack script):
     * - strip surrounding quotation marks
     * - tokens that only lived inside a quote must not appear standalone (echo guard)
     * - a dropped token is re-anchored on its text (whole word) or appended; dropped quotes go back on top
     */
    function repairModelOutput(output, bodyText, entities) {
        let text = String(output || '').trim();
        if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
            text = text.slice(1, -1);
        }
        const isPresent = (token) => text.includes(token) || expandQuoteTokens(text, entities).includes(token);
        const removed = [];
        const appended = [];
        const reanchored = [];

        (entities || []).forEach(e => {
            if (e.kind !== 'QUOTE' && !bodyText.includes(e.token) && text.includes(e.token)) {
                text = text.split(e.token).join('').replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+([.,!?;:])/g, '$1').replace(/[ \t]+$/gm, '');
                removed.push(e.token);
            }
        });
        (entities || []).forEach(e => {
            if (isPresent(e.token)) return;
            const candidates = [e.text];
            if (e.kind === 'LINK' && e.href && e.href !== e.text) candidates.push(e.href);
            for (const candidate of candidates) {
                if (!candidate || candidate.length < 2) continue;
                const re = new RegExp(`(?<![A-Za-z0-9_])${escapeRe(candidate)}(?![A-Za-z0-9_])`, 'g');
                if ((text.match(re) || []).length === 1) {
                    text = text.replace(re, e.kind === 'QUOTE' ? `> ${e.token}` : e.token);
                    reanchored.push(e.token);
                    return;
                }
            }
        });
        // The model rewrote quoted lines instead of returning their tokens: when the output has exactly as many
        // token-less quote lines as quote tokens are missing, put the tokens back in order (verbatim quote wins).
        const substituted = [];
        const missingQuotesEarly = (entities || []).filter(e => e.kind === 'QUOTE' && !isPresent(e.token));
        if (missingQuotesEarly.length) {
            const lines = text.split('\n');
            const bareQuoteLines = lines.map((line, i) => (/^\s*>\s?/.test(line) && !/__SLACKPOLISH_QUOTE_\d+__/.test(line) && line.replace(/^\s*>\s?/, '').trim() ? i : -1)).filter(i => i >= 0);
            if (bareQuoteLines.length === missingQuotesEarly.length) {
                bareQuoteLines.forEach((i, k) => { lines[i] = `> ${missingQuotesEarly[k].token}`; substituted.push(missingQuotesEarly[k].token); });
                text = lines.join('\n');
            }
        }
        const missingQuotes = (entities || []).filter(e => e.kind === 'QUOTE' && !isPresent(e.token));
        if (missingQuotes.length) {
            text = missingQuotes.map(e => `> ${e.token}`).join('\n') + (text ? `\n${text}` : '');
            appended.push(...missingQuotes.map(e => e.token));
        }
        // Only now judge inline tokens: those living inside a restored quote are present again
        const missingInline = (entities || []).filter(e => e.kind !== 'QUOTE' && !isPresent(e.token));
        if (missingInline.length) {
            text += (!text || /\s$/.test(text) ? '' : ' ') + missingInline.map(e => e.token).join(' ');
            appended.push(...missingInline.map(e => e.token));
        }
        // a bare quote token whose ">" was dropped is still a quote line
        text = text.split('\n').map(line => (/^__SLACKPOLISH_QUOTE_\d+__$/.test(line.trim()) ? `> ${line.trim()}` : line)).join('\n');
        return { text, removed, reanchored, appended, substituted };
    }

    /** Compare entity kinds before/after (from adapter extractions): nothing protected may disappear. */
    function verifyEntities(beforeEntities, afterEntities) {
        const count = (list) => (list || []).reduce((acc, e) => { acc[e.kind] = (acc[e.kind] || 0) + 1; return acc; }, {});
        const before = count(beforeEntities);
        const after = count(afterEntities);
        const lost = Object.keys(before).filter(kind => (after[kind] || 0) < before[kind]).map(kind => `${kind}: ${before[kind]} -> ${after[kind] || 0}`);
        return { ok: lost.length === 0, lost, before, after };
    }

    return { TOKEN_RE, INLINE_TOKEN_RE, config, buildPrompt, repairModelOutput, verifyEntities, detokenize, expandQuoteTokens, isPolishable, countContentLines };
});
