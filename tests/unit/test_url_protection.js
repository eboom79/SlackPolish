#!/usr/bin/env node

/**
 * SlackPolish URL / Link Protection Tests
 * Links must survive polishing untouched: anchors are tokenised and cloned back,
 * bare URLs in plain text are tokenised too, selections keep their links, a
 * dropped token is re-appended rather than lost, and tokens never leak as text.
 */

const fs = require('fs');
const path = require('path');

const scriptPath = path.join(__dirname, '../../slack-text-improver.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

let testsPassed = 0;
let testsTotal = 0;

function runTest(name, fn) {
    testsTotal++;
    try {
        console.log(`🧪 Testing: ${name}`);
        fn();
        testsPassed++;
        console.log(`✅ PASSED: ${name}`);
    } catch (error) {
        console.log(`❌ FAILED: ${name}`);
        console.log(`   Error: ${error.message}`);
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function sliceBetween(startMarker, endMarker) {
    const start = scriptContent.indexOf(startMarker);
    assert(start !== -1, `Marker not found: ${startMarker}`);
    const end = scriptContent.indexOf(endMarker, start + startMarker.length);
    assert(end !== -1, `End marker not found after ${startMarker}: ${endMarker}`);
    return scriptContent.slice(start, end);
}

// Pull the pure helper out of the shipped script so the behavioural cases run the real code.
function loadFindUrlSpans() {
    const match = scriptContent.match(/findUrlSpans: function\(text\) \{([\s\S]*?)\n {8}\},/);
    assert(match, 'findUrlSpans helper not found');
    return new Function('text', match[1]);
}

console.log('🚀 Running URL / Link Protection Tests');
console.log('======================================\n');

runTest('Bare URLs are tokenised in every extraction path', () => {
    assert(scriptContent.includes('captureBareUrls: function(text, state)'), 'captureBareUrls missing');
    const extractor = sliceBetween('extractTextStateWithMentions: function(root)', 'getEntityAwareTextFromNode: function');
    assert(extractor.includes('return this.captureBareUrls(node.textContent, state);'), 'Top-level text nodes must be URL-tokenised');
    const entityAware = sliceBetween('getEntityAwareTextFromNode: function', 'isSlackMentionNode: function');
    assert(entityAware.includes('return this.captureBareUrls(node.textContent, state);'), 'Nested text nodes must be URL-tokenised');
    const modelState = sliceBetween('getModelTextState: function', 'createTextState: function');
    assert(modelState.includes('this.captureBareUrls(this.getTextFromElement(element), plainState)'), 'Plain path must URL-tokenise too');
    assert(scriptContent.includes('bare: true,'), 'Bare URL entities should be marked');
    assert(scriptContent.includes('node: document.createTextNode(span.url)'), 'Bare URLs restore as exact text nodes');
});

runTest('findUrlSpans: sentence punctuation excluded, balanced brackets kept, no false positives', () => {
    const find = loadFindUrlSpans();
    const urls = (text) => find(text).map(s => s.url);
    assert.deepEqual = (a, b, msg) => assert(JSON.stringify(a) === JSON.stringify(b), `${msg}\n  got: ${JSON.stringify(a)}\n  want: ${JSON.stringify(b)}`);

    assert.deepEqual(urls('see https://docs.google.com/document/d/abc/edit.'), ['https://docs.google.com/document/d/abc/edit'], 'trailing period');
    assert.deepEqual(urls('ticket https://redis.atlassian.net/browse/RED-1234, thanks'), ['https://redis.atlassian.net/browse/RED-1234'], 'trailing comma');
    assert.deepEqual(urls('ref https://x.io/a?b=1&c=2; also https://y.io/z!'), ['https://x.io/a?b=1&c=2', 'https://y.io/z'], 'query string kept, ; and ! trimmed');
    assert.deepEqual(urls('(see https://en.wikipedia.org/wiki/Foo_(bar))'), ['https://en.wikipedia.org/wiki/Foo_(bar)'], 'balanced parens kept, sentence paren trimmed');
    assert.deepEqual(urls('go to www.example.com/path now'), ['www.example.com/path'], 'www. form');
    assert.deepEqual(urls('*https://bold.example/x* and <https://angle.example/y>'), ['https://bold.example/x', 'https://angle.example/y'], 'markdown/angle wrappers excluded');
    assert.deepEqual(urls('https://a.b/c;jsessionid=1;x=2 end'), ['https://a.b/c;jsessionid=1;x=2'], 'interior semicolons kept');
    assert.deepEqual(urls('release v1.2.3 e.g. today, see docs. Thanks'), [], 'no false positives on versions/abbreviations');
    assert.deepEqual(urls('https:// and http://x'), [], 'too short to be a URL');
    assert.deepEqual(urls(''), [], 'empty');
    const spans = find('a https://x.io/p b');
    assert(spans[0].start === 2 && spans[0].end === 2 + 'https://x.io/p'.length, 'span offsets must be exact');
});

runTest('Selections are extracted from the DOM so links inside them are protected', () => {
    assert(scriptContent.includes('extractSelectionTextState: function(selectionInfo)'), 'extractSelectionTextState missing');
    assert(scriptContent.includes('this.extractTextStateWithMentions(selectionInfo.range.cloneContents())'), 'Selection state must come from range.cloneContents()');
    const modelState = sliceBetween('getModelTextState: function', 'createTextState: function');
    assert(modelState.includes('return this.extractSelectionTextState(activeSelectionInfo);'), 'getModelTextState must use the selection extractor');
    assert(!modelState.includes('mentions: [],\n                links: []\n            };'), 'Old empty-entity selection state must be gone');
});

runTest('Selection replacement keeps entities and never diverts to full-message replacement', () => {
    const setText = sliceBetween('setTextInElement: function', 'insertRichTextAtRange: function');
    assert(!setText.includes('!this.hasProtectedEntities(textState)'), 'Selection branch must not be gated on entity absence (would wipe the rest of the message)');
    assert(setText.includes('this.replaceSelectedTextWithPreservedInfo(') && setText.includes('textState\n                );'), 'Selection path must receive textState');
    assert(scriptContent.includes('insertRichTextAtRange: function(range, improvedText, textState)'), 'Shared range inserter missing');
    const preserved = sliceBetween('replaceSelectedTextWithPreservedInfo: function', 'findOriginalPosition: function');
    assert(preserved.includes('this.insertRichTextAtRange(range, improvedText, textState)'), 'Preserved-selection path must restore tokens');
    assert(!preserved.includes('document.createTextNode(improvedText)'), 'Bare text-node insertion (flattens links) must be gone');
    assert(preserved.includes('this.setTextWithFormatting(element, newFullText, textState)'), 'Manual fallback must pass textState');
    const live = sliceBetween('replaceSelectedText: function(element, improvedText, selectionInfo, textState = null)', 'replaceSelectedTextWithPreservedInfo: function');
    assert(live.includes('this.insertRichTextAtRange(range, improvedText, textState)'), 'Live-selection path must restore tokens');
});

runTest('A dropped token is re-appended instead of the link disappearing', () => {
    const restore = sliceBetween('restoreMissingProtectedTokens: function', 'appendTextWithMentions: function');
    assert(restore.includes('const stillMissing = entities.filter(entity => !restoredText.includes(entity.token));'), 'Missing-token detection not found');
    assert(restore.includes('restoredText += separator + stillMissing.map(entity => entity.token).join(\' \');'), 'Missing tokens must be appended');
    assert(restore.includes('Re-appended protected entities the model dropped'), 'Should log the recovery');
    assert(restore.includes('(?<![A-Za-z0-9_])${escapedCandidate}(?![A-Za-z0-9_])'), 'Re-anchoring must be whole-word (no <a>doc</a>ument splits)');
    assert(!restore.includes("restoredText.replace(candidate, entity.token)"), 'Plain substring re-anchoring must be gone');
});

runTest('Tokens never leak into plain (non-rich) inputs', () => {
    assert(scriptContent.includes('detokenizeToPlainText: function(text, textState)'), 'detokenizeToPlainText missing');
    const setText = sliceBetween('setTextInElement: function', 'insertRichTextAtRange: function');
    assert(setText.includes('element.innerText = this.detokenizeToPlainText('), 'Non-rich fallback must detokenise');
    const preserved = sliceBetween('replaceSelectedTextWithPreservedInfo: function', 'findOriginalPosition: function');
    assert(preserved.includes('element.innerText = this.detokenizeToPlainText(newFullText, textState);'), 'Manual non-rich fallback must detokenise');
});

runTest('Prompt tells the model to leave URLs, paths and issue keys verbatim', () => {
    assert(scriptContent.includes('Leave URLs, file paths, and identifiers such as issue keys (e.g. RED-1234, PROJ-42) exactly as written.'), 'Prompt instruction missing');
});

console.log('\n======================================');
console.log('📊 TEST SUMMARY');
console.log('======================================');
console.log(`Total Tests: ${testsTotal}`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsTotal - testsPassed}`);
process.exit(testsPassed === testsTotal ? 0 : 1);
