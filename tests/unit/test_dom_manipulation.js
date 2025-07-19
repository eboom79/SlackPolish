#!/usr/bin/env node

/**
 * SlackPolish DOM Manipulation Tests
 * Tests DOM interaction, message input finding, text extraction and replacement
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_NAME = 'DOM Manipulation';
let testsPassed = 0;
let testsTotal = 0;

function runTest(testName, testFunction) {
    testsTotal++;
    try {
        console.log(`🧪 Testing: ${testName}`);
        testFunction();
        testsPassed++;
        console.log(`✅ PASSED: ${testName}`);
    } catch (error) {
        console.log(`❌ FAILED: ${testName}`);
        console.log(`   Error: ${error.message}`);
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

// Load the main script for testing
const scriptPath = path.join(__dirname, '../../slack-text-improver.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

console.log(`🚀 Running ${TEST_NAME} Tests`);
console.log('=====================================\n');

// Test 1: Message Input Finding
runTest('Message Input Finding', () => {
    assert(scriptContent.includes('findMessageInput'), 'findMessageInput method not found');
    assert(scriptContent.includes('[data-qa="message_input"]'), 'Primary message input selector not found');
    assert(scriptContent.includes('.ql-editor[data-qa="message_input"]'), 'Quill editor selector not found');
    assert(scriptContent.includes('[contenteditable="true"]'), 'ContentEditable selector not found');
    assert(scriptContent.includes('[role="textbox"]'), 'Textbox role selector not found');
});

// Test 2: Text Extraction
runTest('Text Extraction', () => {
    assert(scriptContent.includes('getTextFromElement'), 'getTextFromElement method not found');
    assert(scriptContent.includes('innerText'), 'innerText extraction not found');
    assert(scriptContent.includes('textContent'), 'textContent fallback not found');
    assert(scriptContent.includes('return \'\''), 'Empty text fallback not found');
});

// Test 3: Text Replacement
runTest('Text Replacement', () => {
    assert(scriptContent.includes('setTextInElement'), 'setTextInElement method not found');
    assert(scriptContent.includes('innerHTML = \'\''), 'Content clearing not found');
    assert(scriptContent.includes('innerText = text'), 'Text setting not found');
    assert(scriptContent.includes('dispatchEvent'), 'Event dispatching not found');
});

// Test 4: Event Triggering
runTest('Event Triggering', () => {
    assert(scriptContent.includes('dispatchEvent'), 'Event dispatching not found');
    assert(scriptContent.includes('new Event') || scriptContent.includes('Event('), 'Event creation not found');
    assert(scriptContent.includes('input') || scriptContent.includes('change'), 'Event types not found');
});

// Test 5: Element Validation
runTest('Element Validation', () => {
    assert(scriptContent.includes('if (!element)'), 'Element validation not found');
    assert(scriptContent.includes('isContentEditable'), 'ContentEditable validation not found');
    assert(scriptContent.includes('return null'), 'Null return for invalid elements not found');
});

// Test 6: Multiple Selector Strategy
runTest('Multiple Selector Strategy', () => {
    assert(scriptContent.includes('const selectors = ['), 'Selector array not found');
    assert(scriptContent.includes('for (const selector of selectors)'), 'Selector iteration not found');
    assert(scriptContent.includes('document.querySelector(selector)'), 'Selector querying not found');
});

// Test 7: Loading Indicator DOM Manipulation
runTest('Loading Indicator DOM Manipulation', () => {
    assert(scriptContent.includes('showLoadingIndicator'), 'showLoadingIndicator method not found');
    assert(scriptContent.includes('hideLoadingIndicator'), 'hideLoadingIndicator method not found');
    assert(scriptContent.includes('createElement'), 'Element creation not found');
    assert(scriptContent.includes('document.body.appendChild'), 'Element appending not found');
});

// Test 8: Error Handling in DOM Operations
runTest('DOM Error Handling', () => {
    assert(scriptContent.includes('try {'), 'Error handling try blocks not found');
    assert(scriptContent.includes('catch (error)'), 'Error handling catch blocks not found');
    assert(scriptContent.includes('error') && scriptContent.includes('message'), 'Error message handling not found');
});

// Test 9: Focus Management
runTest('Focus Management', () => {
    assert(scriptContent.includes('.focus()') || scriptContent.includes('focus'), 'Focus method not found');
    assert(scriptContent.includes('element') && scriptContent.includes('focus'), 'Element focus not found');
});

// Test 10: DOM Ready State Handling
runTest('DOM Ready State Handling', () => {
    assert(scriptContent.includes('document.readyState'), 'Ready state check not found');
    assert(scriptContent.includes('DOMContentLoaded'), 'DOMContentLoaded event not found');
    assert(scriptContent.includes('addEventListener'), 'Event listener addition not found');
});

// Test 11: Element Property Access
runTest('Element Property Access', () => {
    assert(scriptContent.includes('tagName'), 'TagName property access not found');
    assert(scriptContent.includes('className'), 'ClassName property access not found');
    assert(scriptContent.includes('id'), 'ID property access not found');
});

// Test 12: Slack-Specific DOM Handling
runTest('Slack-Specific DOM Handling', () => {
    assert(scriptContent.includes('c-texty_input__container'), 'Slack input container selector not found');
    assert(scriptContent.includes('ql-editor'), 'Quill editor selector not found');
    assert(scriptContent.includes('data-qa'), 'Slack data-qa attributes not found');
});

console.log('\n=====================================');
console.log('📊 TEST SUMMARY');
console.log('=====================================');
console.log(`Total Tests: ${testsTotal}`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsTotal - testsPassed}`);
console.log(`📈 Success Rate: ${Math.round((testsPassed / testsTotal) * 100)}%`);

if (testsPassed === testsTotal) {
    console.log('\n🎉 All DOM manipulation tests passed!');
    process.exit(0);
} else {
    console.log('\n💥 Some DOM manipulation tests failed.');
    process.exit(1);
}
