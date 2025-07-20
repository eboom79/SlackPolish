#!/usr/bin/env node

/**
 * SlackPolish Emoji Signature Tests
 * Tests the emoji signature feature functionality
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_NAME = 'Emoji Signature Feature';
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

// Load scripts for testing
const settingsPath = path.join(__dirname, '../../slack-settings.js');
const settingsContent = fs.readFileSync(settingsPath, 'utf8');

const textImproverPath = path.join(__dirname, '../../slack-text-improver.js');
const textImproverContent = fs.readFileSync(textImproverPath, 'utf8');

console.log(`🚀 Running ${TEST_NAME} Tests`);
console.log('=====================================\n');

// Test 1: Default Setting Configuration
runTest('Default Setting Configuration', () => {
    assert(settingsContent.includes('addEmojiSignature: false'), 'Default emoji signature setting not found');
    assert(settingsContent.includes('defaultSettings'), 'Default settings object not found');
});

// Test 2: UI Element in Developer Menu
runTest('UI Element in Developer Menu', () => {
    assert(settingsContent.includes('emoji-signature'), 'Emoji signature checkbox ID not found');
    assert(settingsContent.includes('Add :slack_polish: emoji'), 'Emoji signature label not found');
    assert(settingsContent.includes('✨ Emoji Signature'), 'Emoji signature section header not found');
});

// Test 3: Settings Collection
runTest('Settings Collection', () => {
    assert(settingsContent.includes('querySelector(\'#emoji-signature\')'), 'Emoji signature settings collection not found');
    assert(settingsContent.includes('addEmojiSignature:'), 'Emoji signature property assignment not found');
});

// Test 4: Config Loading in Text Improver
runTest('Config Loading in Text Improver', () => {
    assert(textImproverContent.includes('CONFIG.ADD_EMOJI_SIGNATURE'), 'Config emoji signature property not found');
    assert(textImproverContent.includes('settings.addEmojiSignature'), 'Settings emoji signature loading not found');
});

// Test 5: Emoji Addition Logic
runTest('Emoji Addition Logic', () => {
    assert(textImproverContent.includes(' :slack_polish:'), 'Emoji signature text not found');
    assert(textImproverContent.includes('finalText = improvedText + \' :slack_polish:\';'), 'Emoji addition logic not found');
});

// Test 6: Conditional Emoji Addition
runTest('Conditional Emoji Addition', () => {
    assert(textImproverContent.includes('if (CONFIG.ADD_EMOJI_SIGNATURE)'), 'Conditional emoji logic not found');
    assert(textImproverContent.includes('let finalText = improvedText;'), 'Final text initialization not found');
});

// Test 7: Debug Logging
runTest('Debug Logging', () => {
    assert(textImproverContent.includes('emojiSignatureEnabled'), 'Emoji signature debug logging not found');
    assert(textImproverContent.includes('finalText'), 'Final text debug logging not found');
});

// Test 8: UI Checkbox State
runTest('UI Checkbox State', () => {
    assert(settingsContent.includes('${currentSettings.addEmojiSignature ? \'checked\' : \'\'}'), 'Checkbox state binding not found');
    assert(settingsContent.includes('currentSettings.addEmojiSignature'), 'Current settings reference not found');
});

// Test 9: Developer Menu Integration
runTest('Developer Menu Integration', () => {
    assert(settingsContent.includes('developer-options'), 'Developer options container not found');
    assert(settingsContent.includes('🔧 DEVELOPER MODE'), 'Developer mode indicator not found');
});

// Test 10: Settings Persistence
runTest('Settings Persistence', () => {
    assert(settingsContent.includes('localStorage.setItem'), 'Settings persistence not found');
    assert(settingsContent.includes('JSON.stringify'), 'Settings serialization not found');
});

// Test 11: Emoji Format Specification
runTest('Emoji Format Specification', () => {
    assert(textImproverContent.includes('\' :slack_polish:\''), 'Correct emoji format with space not found');
    assert(!textImproverContent.includes('\":slack_polish:\"'), 'Incorrect emoji format without space not found');
});

// Test 12: Feature Description
runTest('Feature Description', () => {
    assert(settingsContent.includes('Adds SlackPolish emoji signature'), 'Feature description not found');
    assert(settingsContent.includes('identify AI-improved messages'), 'Feature purpose description not found');
});

console.log('\n=====================================');
console.log('📊 TEST SUMMARY');
console.log('=====================================');
console.log(`Total Tests: ${testsTotal}`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsTotal - testsPassed}`);
console.log(`📈 Success Rate: ${Math.round((testsPassed / testsTotal) * 100)}%`);

if (testsPassed === testsTotal) {
    console.log('\n🎉 All emoji signature tests passed!');
    console.log('✨ Feature ready: SlackPolish emoji signature');
    console.log('📝 Default: OFF (no emoji)');
    console.log('🔧 Access: Hidden developer menu (10-click activation)');
    console.log('🎯 Format: "message! :slack_polish:" (space before emoji)');
    process.exit(0);
} else {
    console.log('\n💥 Some emoji signature tests failed.');
    process.exit(1);
}
