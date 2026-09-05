#!/usr/bin/env node

/**
 * JustPolish URL / Link Protection Tests
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
    assert(preserved.includes('this.rebuildMessageAroundSelection(element, improvedText, selectedText, textState)'), 'Manual fallback must rebuild the message entity-aware');
    const live = sliceBetween('replaceSelectedText: function(element, improvedText, selectionInfo, textState = null)', 'replaceSelectedTextWithPreservedInfo: function');
    assert(live.includes('this.insertRichTextAtRange(range, improvedText, textState)'), 'Live-selection path must restore tokens');
});

runTest('A dropped token is re-appended instead of the link disappearing', () => {
    const restore = sliceBetween('restoreMissingProtectedTokens: function', 'appendTextWithMentions: function');
    assert(restore.includes('const stillMissing = entities.filter(entity => !isPresent(entity.token));'), 'Missing-token detection not found');
    assert(restore.includes('restoredText += separator + missingInline.map(entity => entity.token).join(\' \');'), 'Missing inline tokens must be appended');
    assert(restore.includes('restoredText = restoredText ? `${quoteLines}\\n${restoredText}` : quoteLines;'), 'Missing quote lines must be re-inserted on top');
    assert(restore.includes('Re-appended protected entities the model dropped'), 'Should log the recovery');
    assert(restore.includes('(?<![A-Za-z0-9_])${escapedCandidate}(?![A-Za-z0-9_])'), 'Re-anchoring must be whole-word (no <a>doc</a>ument splits)');
    assert(!restore.includes("restoredText.replace(candidate, entity.token)"), 'Plain substring re-anchoring must be gone');
});

runTest('Tokens never leak into plain (non-rich) inputs', () => {
    assert(scriptContent.includes('detokenizeToPlainText: function(text, textState)'), 'detokenizeToPlainText missing');
    const setText = sliceBetween('setTextInElement: function', 'insertRichTextAtRange: function');
    assert(setText.includes('element.innerText = this.detokenizeToPlainText('), 'Non-rich fallback must detokenise');
    const preserved = sliceBetween('replaceSelectedTextWithPreservedInfo: function', 'findOriginalPosition: function');
    assert(preserved.includes('element.innerText = this.detokenizeToPlainText(beforeSelection + improvedText + afterSelection, textState);'), 'Manual non-rich fallback must detokenise');
});

runTest('Slack app rich-link slugs (Jira/Drive/Confluence pills) are recognised as links', () => {
    const detect = sliceBetween('isSlackLinkNode: function(node)', 'getLinkNodeUrl: function(node)');
    assert(detect.includes("if (tagName === 'ts-slug')"), 'ts-slug elements must be treated as links');
    assert(detect.includes("node.getAttribute('data-url')"), 'data-url must count as a link');
    assert(detect.includes("role === 'link'"), 'role="link" must count as a link');
    assert(detect.includes("className.includes('slackslug')"), 'c-slackslug class must count as a link');
    assert(detect.includes("aria-roledescription"), 'aria-roledescription="Attachment link" must count as a link');
    assert(scriptContent.includes("getLinkNodeUrl: function(node)"), 'getLinkNodeUrl missing');
    assert(scriptContent.includes("for (const attribute of ['href', 'data-url', 'data-id', 'data-stringify-link'])"), 'URL must be read from href or slug data attributes');
    const capture = sliceBetween('captureLinkToken: function(node, state)', 'getMentionByToken: function');
    assert(capture.includes('href: this.getLinkNodeUrl(node),'), 'captureLinkToken must record the slug URL so a dropped token can be re-anchored');
});

runTest('Alphanumeric run glued after a link (Slack fast-typing race) is absorbed into the link entity', () => {
    assert(scriptContent.includes('walkChildrenWithGlue: function(parent, state, processChild)'), 'walkChildrenWithGlue missing');
    const walker = sliceBetween('walkChildrenWithGlue: function', 'getEntityAwareTextFromNode: function');
    assert(walker.includes('/^[A-Za-z0-9]+/.exec(next.textContent'), 'Only alphanumeric runs may be glued (punctuation stays editable)');
    assert(walker.includes("this.isTopLevelProtectedNode(child, 'link')"), 'Gluing applies to link entities only');
    assert(walker.includes('entity.text += match[0];'), 'Glued text must join the entity text for re-anchoring');
    assert(walker.includes('children[index + 1] = document.createTextNode(next.textContent.slice(match[0].length));'), 'Remainder must be processed without mutating the live DOM');
    const extractor = sliceBetween('extractTextStateWithMentions: function(root)', 'walkChildrenWithGlue: function');
    assert(extractor.includes('state.text += this.walkChildrenWithGlue(root, state, processNode);'), 'Top-level walk must use the glue-aware walker');
    const entityAware = sliceBetween('getEntityAwareTextFromNode: function', 'isSlackMentionNode: function');
    assert(entityAware.includes('return this.walkChildrenWithGlue(node, state, child => this.getEntityAwareTextFromNode(child, state));'), 'Nested walk must use the glue-aware walker');
});

runTest('Selection fallbacks never flatten or wipe the rest of the message', () => {
    assert(scriptContent.includes('rebuildMessageAroundSelection: function(element, improvedText, selectedText, selectionState)'), 'Entity-aware whole-message rebuild missing');
    assert(scriptContent.includes('mapPlainSpanToTokenized: function(tokenizedText, textState, plainStart, plainEnd)'), 'Plain->tokenised span mapping missing');
    assert(scriptContent.includes('mergeTextStateInto: function(targetState, sourceState, text)'), 'State merge helper missing');
    const preserved = sliceBetween('replaceSelectedTextWithPreservedInfo: function', 'findOriginalPosition: function');
    assert(preserved.includes('this.rebuildMessageAroundSelection(element, improvedText, selectedText, textState)'), 'Manual fallback must rebuild entity-aware');
    assert(!preserved.includes('this.setTextWithFormatting(element, newFullText'), 'textContent-based flattening must be gone');
    assert(!preserved.includes('this.setTextWithFormatting(element, improvedText, textState);'), 'catch must not replace the whole message with the selection text');
    const live = sliceBetween('replaceSelectedText: function(element, improvedText, selectionInfo, textState = null)', 'replaceSelectedTextWithPreservedInfo: function');
    assert(!live.includes('this.setTextWithFormatting(element, improvedText, textState);'), 'live-range catch must not replace the whole message either');
    assert(scriptContent.split('message left unchanged').length - 1 >= 3, 'User must be told when the selection could not be applied');
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
