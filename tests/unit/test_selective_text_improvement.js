/**
 * SlackPolish - Selective Text Improvement Tests
 * Tests for the selective text improvement feature where only selected text is improved
 */

const assert = require('assert');

// Test counter
let testsPassed = 0;
let testsFailed = 0;

// Helper function to run a test
function runTest(testName, testFn) {
    try {
        testFn();
        testsPassed++;
        console.log(`✅ ${testName}`);
    } catch (error) {
        testsFailed++;
        console.error(`❌ ${testName}`);
        console.error(`   Error: ${error.message}`);
    }
}

// Mock DOM environment
function createMockElement(text) {
    return {
        textContent: text,
        innerText: text,
        classList: {
            contains: (className) => className === 'ql-editor'
        }
    };
}

// Mock selection info
function createMockSelectionInfo(selectedText, hasSelection = true) {
    return {
        hasSelection: hasSelection,
        selectedText: selectedText,
        range: null,
        selection: null
    };
}

console.log('\n=== Selective Text Improvement Tests ===\n');

// Test 1: Selection detection - has selection
runTest('Selection detection - has selection', () => {
    const selectionInfo = createMockSelectionInfo('selected text');
    assert.strictEqual(selectionInfo.hasSelection, true);
    assert.strictEqual(selectionInfo.selectedText, 'selected text');
});

// Test 2: Selection detection - no selection
runTest('Selection detection - no selection', () => {
    const selectionInfo = createMockSelectionInfo('', false);
    assert.strictEqual(selectionInfo.hasSelection, false);
});

// Test 3: Text matching - exact match
runTest('Text matching - exact match', () => {
    const fullText = 'Hello world, this is a test message.';
    const selectedText = 'this is a test';
    const index = fullText.indexOf(selectedText);
    assert.strictEqual(index, 13);
});

// Test 4: Text matching - beginning of text
runTest('Text matching - beginning of text', () => {
    const fullText = 'Hello world, this is a test message.';
    const selectedText = 'Hello world';
    const index = fullText.indexOf(selectedText);
    assert.strictEqual(index, 0);
});

// Test 5: Text matching - end of text
runTest('Text matching - end of text', () => {
    const fullText = 'Hello world, this is a test message.';
    const selectedText = 'test message.';
    const index = fullText.indexOf(selectedText);
    assert.strictEqual(index, 23);
});

// Test 6: Text replacement - middle selection
runTest('Text replacement - middle selection', () => {
    const fullText = 'Hello world, this is a test message.';
    const selectedText = 'this is a test';
    const improvedText = 'this is an improved test';
    
    const index = fullText.indexOf(selectedText);
    const beforeSelection = fullText.substring(0, index);
    const afterSelection = fullText.substring(index + selectedText.length);
    const newFullText = beforeSelection + improvedText + afterSelection;
    
    assert.strictEqual(newFullText, 'Hello world, this is an improved test message.');
});

// Test 7: Text replacement - beginning selection
runTest('Text replacement - beginning selection', () => {
    const fullText = 'Hello world, this is a test message.';
    const selectedText = 'Hello world';
    const improvedText = 'Greetings everyone';
    
    const index = fullText.indexOf(selectedText);
    const beforeSelection = fullText.substring(0, index);
    const afterSelection = fullText.substring(index + selectedText.length);
    const newFullText = beforeSelection + improvedText + afterSelection;
    
    assert.strictEqual(newFullText, 'Greetings everyone, this is a test message.');
});

// Test 8: Text replacement - end selection
runTest('Text replacement - end selection', () => {
    const fullText = 'Hello world, this is a test message.';
    const selectedText = 'test message.';
    const improvedText = 'sample text.';
    
    const index = fullText.indexOf(selectedText);
    const beforeSelection = fullText.substring(0, index);
    const afterSelection = fullText.substring(index + selectedText.length);
    const newFullText = beforeSelection + improvedText + afterSelection;
    
    assert.strictEqual(newFullText, 'Hello world, this is a sample text.');
});

// Test 9: Text replacement - entire text selected
runTest('Text replacement - entire text selected', () => {
    const fullText = 'Hello world, this is a test message.';
    const selectedText = fullText;
    const improvedText = 'This is completely new text.';
    
    const index = fullText.indexOf(selectedText);
    const beforeSelection = fullText.substring(0, index);
    const afterSelection = fullText.substring(index + selectedText.length);
    const newFullText = beforeSelection + improvedText + afterSelection;
    
    assert.strictEqual(newFullText, 'This is completely new text.');
});

// Test 10: Text replacement - multiline selection
runTest('Text replacement - multiline selection', () => {
    const fullText = 'Line 1\nLine 2\nLine 3\nLine 4';
    const selectedText = 'Line 2\nLine 3';
    const improvedText = 'Improved Line 2\nImproved Line 3';
    
    const index = fullText.indexOf(selectedText);
    const beforeSelection = fullText.substring(0, index);
    const afterSelection = fullText.substring(index + selectedText.length);
    const newFullText = beforeSelection + improvedText + afterSelection;
    
    assert.strictEqual(newFullText, 'Line 1\nImproved Line 2\nImproved Line 3\nLine 4');
});

// Test 11: Normalized whitespace matching
runTest('Normalized whitespace matching', () => {
    const fullText = 'Hello  world,   this is a test.';
    const selectedText = 'Hello world, this is a test.';
    
    const normalizedFull = fullText.replace(/\s+/g, ' ').trim();
    const normalizedSelected = selectedText.replace(/\s+/g, ' ').trim();
    
    assert.strictEqual(normalizedFull, normalizedSelected);
});

// Test 12: Selection position calculation - simple case
runTest('Selection position calculation - simple case', () => {
    const fullText = 'Hello world, this is a test message.';
    const selectedText = 'this is a test';
    const improvedText = 'this is an improved test';
    
    const selectionIndex = fullText.indexOf(selectedText);
    const selectionStart = selectionIndex;
    const selectionEnd = selectionIndex + improvedText.length;
    
    assert.strictEqual(selectionStart, 13);
    assert.strictEqual(selectionEnd, 37);
});

// Test 13: Selection position calculation - with length change
runTest('Selection position calculation - with length change', () => {
    const fullText = 'Hello world, this is a test message.';
    const selectedText = 'this is a test';
    const improvedText = 'improved';
    
    const selectionIndex = fullText.indexOf(selectedText);
    const selectionStart = selectionIndex;
    const selectionEnd = selectionIndex + improvedText.length;
    
    assert.strictEqual(selectionStart, 13);
    assert.strictEqual(selectionEnd, 21);
});

// Test 14: Text not found - should return -1
runTest('Text not found - should return -1', () => {
    const fullText = 'Hello world, this is a test message.';
    const selectedText = 'nonexistent text';
    const index = fullText.indexOf(selectedText);
    
    assert.strictEqual(index, -1);
});

// Test 15: Empty selection handling
runTest('Empty selection handling', () => {
    const selectionInfo = createMockSelectionInfo('', false);
    assert.strictEqual(selectionInfo.hasSelection, false);
    assert.strictEqual(selectionInfo.selectedText, '');
});

// Test 16: Large text selection
runTest('Large text selection', () => {
    const paragraph1 = 'This is the first paragraph that should not be changed.';
    const paragraph2 = 'This is the second paragraph with some grammar errors that needs fixing.';
    const paragraph3 = 'This is the third paragraph that should also remain unchanged.';
    
    const fullText = `${paragraph1}\n${paragraph2}\n${paragraph3}`;
    const selectedText = paragraph2;
    const improvedText = 'This is the second paragraph with some grammar errors that need fixing.';
    
    const index = fullText.indexOf(selectedText);
    const beforeSelection = fullText.substring(0, index);
    const afterSelection = fullText.substring(index + selectedText.length);
    const newFullText = beforeSelection + improvedText + afterSelection;
    
    assert.ok(newFullText.includes(paragraph1));
    assert.ok(newFullText.includes(improvedText));
    assert.ok(newFullText.includes(paragraph3));
    assert.ok(!newFullText.includes(paragraph2));
});

// Test 17: Partial word selection
runTest('Partial word selection', () => {
    const fullText = 'Hello world, this is a test message.';
    const selectedText = 'world, this is';
    const improvedText = 'everyone, this is';
    
    const index = fullText.indexOf(selectedText);
    const beforeSelection = fullText.substring(0, index);
    const afterSelection = fullText.substring(index + selectedText.length);
    const newFullText = beforeSelection + improvedText + afterSelection;
    
    assert.strictEqual(newFullText, 'Hello everyone, this is a test message.');
});

// Test 18: Selection with special characters
runTest('Selection with special characters', () => {
    const fullText = 'Hello! How are you? I\'m fine, thanks.';
    const selectedText = 'How are you? I\'m fine';
    const improvedText = 'How are you doing? I am fine';
    
    const index = fullText.indexOf(selectedText);
    const beforeSelection = fullText.substring(0, index);
    const afterSelection = fullText.substring(index + selectedText.length);
    const newFullText = beforeSelection + improvedText + afterSelection;
    
    assert.strictEqual(newFullText, 'Hello! How are you doing? I am fine, thanks.');
});

// Test 19: Selection with numbers
runTest('Selection with numbers', () => {
    const fullText = 'We have 3 options: option 1, option 2, and option 3.';
    const selectedText = 'option 1, option 2, and option 3';
    const improvedText = 'options 1, 2, and 3';
    
    const index = fullText.indexOf(selectedText);
    const beforeSelection = fullText.substring(0, index);
    const afterSelection = fullText.substring(index + selectedText.length);
    const newFullText = beforeSelection + improvedText + afterSelection;
    
    assert.strictEqual(newFullText, 'We have 3 options: options 1, 2, and 3.');
});

// Test 20: Selection with formatting markers
runTest('Selection with formatting markers', () => {
    const fullText = '1. First item\n2. Second item\n3. Third item';
    const selectedText = '2. Second item';
    const improvedText = '2. Improved second item';
    
    const index = fullText.indexOf(selectedText);
    const beforeSelection = fullText.substring(0, index);
    const afterSelection = fullText.substring(index + selectedText.length);
    const newFullText = beforeSelection + improvedText + afterSelection;
    
    assert.strictEqual(newFullText, '1. First item\n2. Improved second item\n3. Third item');
});

// Print summary
console.log('\n=== Test Summary ===');
console.log(`Total tests: ${testsPassed + testsFailed}`);
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);

if (testsFailed > 0) {
    process.exit(1);
}

