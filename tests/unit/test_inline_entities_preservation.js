#!/usr/bin/env node

/**
 * SlackPolish Inline Entities Preservation Tests
 * Inline code and emoji are protected entities (tokenised, cloned back); bold/italic/strike
 * are re-applied when the model keeps the words; deliberate blank lines survive.
 */
const fs = require('fs');
const path = require('path');
const scriptContent = fs.readFileSync(path.join(__dirname, '../../slack-text-improver.js'), 'utf8');
let testsPassed = 0, testsTotal = 0;
function runTest(name, fn) { testsTotal++; try { console.log(`🧪 Testing: ${name}`); fn(); testsPassed++; console.log(`✅ PASSED: ${name}`); } catch (e) { console.log(`❌ FAILED: ${name}`); console.log(`   Error: ${e.message}`); } }
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }
const between = (a, b) => { const s = scriptContent.indexOf(a); const e = scriptContent.indexOf(b, s + a.length); assert(s !== -1 && e !== -1, `markers ${a} / ${b}`); return scriptContent.slice(s, e); };

console.log('🚀 Running Inline Entities Preservation Tests');
console.log('=============================================\n');

runTest('Inline code and emoji are recognised and tokenised in both walkers', () => {
    assert(scriptContent.includes('isSlackCodeNode: function(node)') && scriptContent.includes('isSlackEmojiNode: function(node)'), 'matchers missing');
    assert(scriptContent.includes("tagName === 'code' || tagName === 'pre'"), 'code/pre must be code nodes');
    assert(scriptContent.includes("tagName === 'img' && (className.includes('emoji') || node.hasAttribute('data-stringify-text')"), 'Slack emoji <img class="emoji" data-stringify-text> must be recognised');
    assert(scriptContent.includes('captureCodeToken: function(node, state)') && scriptContent.includes('captureEmojiToken: function(node, state)'), 'capture functions missing');
    const top = between('extractTextStateWithMentions: function(root)', 'walkChildrenWithGlue: function');
    const nested = between('getEntityAwareTextFromNode: function', 'isSlackMentionNode: function');
    for (const w of [top, nested]) {
        assert(w.includes("this.isTopLevelProtectedNode(node, 'code')") && w.includes("this.isTopLevelProtectedNode(node, 'emoji')"), 'both walkers must check code and emoji');
    }
    assert(scriptContent.includes("codes: [], emojis: [], formats: []"), 'state must carry codes/emojis/formats');
    assert(scriptContent.includes('codeCount > 0 || emojiCount > 0'), 'code/emoji must count as protected entities');
});

runTest('Write-back restores code/emoji clones and all token handling knows the new kinds', () => {
    assert(scriptContent.split('__SLACKPOLISH_CODE_\\d+__|__SLACKPOLISH_EMOJI_\\d+__').length - 1 >= 2, 'appendTextWithMentions and detokenizeToPlainText must split on CODE/EMOJI tokens');
    assert(scriptContent.includes('parent.appendChild(code.node.cloneNode(true));') && scriptContent.includes('parent.appendChild(emoji.node.cloneNode(true));'), 'clones must be restored');
    assert(scriptContent.includes("/__SLACKPOLISH_(?:MENTION|LINK|QUOTE|CODE|EMOJI)_\\d+__/g"), 'span mapping must know CODE/EMOJI');
    assert(scriptContent.includes("remap('codes', 'CODE', 'nextCodeId');") && scriptContent.includes("remap('emojis', 'EMOJI', 'nextEmojiId');"), 'state merge must remap CODE/EMOJI');
    assert(scriptContent.includes("...(textState.codes || []).map(entity => ({ ...entity, type: 'code' }))"), 'missing-token recovery must include code');
    assert(scriptContent.includes('__SLACKPOLISH_CODE_1__ and __SLACKPOLISH_EMOJI_1__ represent real Slack entities'), 'prompt must describe code/emoji tokens');
});

runTest('Bold/italic/strike are remembered and re-applied best effort', () => {
    assert(scriptContent.includes('recordInlineFormat: function(node, state)') && scriptContent.includes('reapplyInlineFormatting: function(root, textState)'), 'format helpers missing');
    const nested = between('getEntityAwareTextFromNode: function', 'isSlackMentionNode: function');
    assert(nested.includes('this.recordInlineFormat(node, state);'), 'nested walker must record formats');
    const setText = between('setTextWithFormatting: function', 'notifySlackDraftChanged: function');
    assert(setText.includes('this.reapplyInlineFormatting(element, textState);'), 'write-back must re-apply formats');
    assert(scriptContent.includes("parent.closest('code, pre, a, ts-mention, ts-slug')"), 'formatting must not be re-applied inside code/links/pills');
});

runTest('Deliberate blank lines are preserved end to end', () => {
    assert(scriptContent.includes("return paragraphText.trim() ? paragraphText.trim() + '\\n' : '\\n';"), 'empty paragraph must yield a blank line');
    assert(scriptContent.includes("state.text = state.text.replace(/\\n[ \\t]*\\n(?:[ \\t]*\\n)+/g, '\\n\\n').trim();"), 'runs of blank lines collapse to one, not zero');
    const build = between('buildFormattedFragment: function', 'setTextWithFormatting: function');
    assert(build.includes('pendingBlankLine = fragment.childNodes.length > 0;') && build.includes("emptyParagraph.appendChild(document.createElement('br'));"), 'blank line must be rebuilt as <p><br></p> between content');
    assert(scriptContent.includes("processedResponse = /\\n[ \\t]*\\n/.test(originalText)"), 'TONE_POLISH must only collapse blank lines the model added');
});

runTest('Block-level code (Slack div.ql-code-block / pre) keeps its own line and is restored at top level', () => {
    assert(scriptContent.includes('isBlockLevelCodeNode: function(node)'), 'isBlockLevelCodeNode missing');
    assert(scriptContent.includes("return this.isBlockLevelCodeNode(node) ? codeToken + '\\n' : codeToken;"), 'block code must end its line on extraction');
    assert(scriptContent.includes('if (soleCode && this.isBlockLevelCodeNode(soleCode.node)) {'), 'write-back must place block code outside <p>');
    assert(scriptContent.includes("className.includes('ql-code')"), "Slack's ql-code-block class must be recognised");
});

runTest('Rich extractor is always used for Slack editor; merged-lines retry and nothing-to-polish guard exist', () => {
    const ms = between('getModelTextState: function', 'createTextState: function');
    assert(ms.includes('return this.extractTextStateWithMentions(element);') && !ms.includes('if (this.hasProtectedEntities(richTextState))'), 'ql-editor must always use the rich extractor');
    assert(scriptContent.includes('countContentLines(text) {'), 'countContentLines missing');
    assert(scriptContent.includes('retrying once with an explicit line-structure instruction'), 'merged-lines retry missing');
    assert(scriptContent.includes("Nothing to polish - message contains only links, mentions, emoji or quoted text"), 'nothing-to-polish guard missing');
    assert(scriptContent.includes("utils.showNotification('Nothing to polish', 'info');"), 'user must be told when there is nothing to polish');
});

console.log('\n=============================================');
console.log(`📊 Total: ${testsTotal}  ✅ Passed: ${testsPassed}  ❌ Failed: ${testsTotal - testsPassed}`);
process.exit(testsPassed === testsTotal ? 0 : 1);
