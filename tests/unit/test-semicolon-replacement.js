/**
 * Unit Tests for Semicolon Replacement Feature
 * 
 * Tests that semicolons (;) in AI responses are replaced with periods (.)
 * and the next sentence starts with a capital letter.
 */

const assert = require('assert');

// Test helper function that simulates the semicolon replacement logic
function replaceSemicolonsWithPeriods(text) {
    let processedText = text;
    
    // Replace semicolons with periods
    processedText = processedText.replace(/;\s*/g, function(match) {
        return '. ';
    });
    
    // Capitalize first letter after each period
    processedText = processedText.replace(/\.\s+([a-z])/g, function(match, letter) {
        return '. ' + letter.toUpperCase();
    });
    
    return processedText;
}

// Test Suite
const tests = [
    {
        name: 'Single semicolon replacement',
        input: 'Hello; this is a test',
        expected: 'Hello. This is a test'
    },
    {
        name: 'Multiple semicolons replacement',
        input: 'First part; second part; third part',
        expected: 'First part. Second part. Third part'
    },
    {
        name: 'Semicolon with multiple spaces',
        input: 'Hello;    this has spaces',
        expected: 'Hello. This has spaces'
    },
    {
        name: 'Semicolon without space after',
        input: 'Hello;world',
        expected: 'Hello. World'
    },
    {
        name: 'Text without semicolons (no change)',
        input: 'This has no semicolons at all',
        expected: 'This has no semicolons at all'
    },
    {
        name: 'Mixed punctuation',
        input: 'First sentence. Second part; third part',
        expected: 'First sentence. Second part. Third part'
    },
    {
        name: 'Semicolon at end of text',
        input: 'This ends with semicolon;',
        expected: 'This ends with semicolon. '
    },
    {
        name: 'Multiple semicolons in complex sentence',
        input: 'I need to finish this; then I will start that; finally I will rest',
        expected: 'I need to finish this. Then I will start that. Finally I will rest'
    },
    {
        name: 'Semicolon followed by uppercase (already capitalized)',
        input: 'Hello; This is already capitalized',
        expected: 'Hello. This is already capitalized'
    },
    {
        name: 'Semicolon in middle of numbers',
        input: 'Value is 100; next value is 200',
        expected: 'Value is 100. Next value is 200'
    },
    {
        name: 'Preserve existing periods with capitalization',
        input: 'First. second; third',
        expected: 'First. Second. Third'
    },
    {
        name: 'Empty string',
        input: '',
        expected: ''
    },
    {
        name: 'Only semicolon',
        input: ';',
        expected: '. '
    },
    {
        name: 'Multiline text with semicolons',
        input: 'First line; second part\nNew line; another part',
        expected: 'First line. Second part\nNew line. Another part'
    }
];

// Run all tests
console.log('🧪 Running Semicolon Replacement Tests...\n');

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
    try {
        const result = replaceSemicolonsWithPeriods(test.input);
        assert.strictEqual(result, test.expected, 
            `Expected: "${test.expected}", Got: "${result}"`);
        console.log(`✅ Test ${index + 1}: ${test.name}`);
        passed++;
    } catch (error) {
        console.log(`❌ Test ${index + 1}: ${test.name}`);
        console.log(`   Input:    "${test.input}"`);
        console.log(`   Expected: "${test.expected}"`);
        console.log(`   Got:      "${replaceSemicolonsWithPeriods(test.input)}"`);
        console.log(`   Error:    ${error.message}\n`);
        failed++;
    }
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`📊 Test Results: ${passed} passed, ${failed} failed out of ${tests.length} total`);
console.log('='.repeat(50));

if (failed === 0) {
    console.log('✅ All tests passed!');
    process.exit(0);
} else {
    console.log('❌ Some tests failed!');
    process.exit(1);
}

