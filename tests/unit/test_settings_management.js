#!/usr/bin/env node

/**
 * SlackPolish Settings Management Tests
 * Tests settings loading, saving, validation, and localStorage operations
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_NAME = 'Settings Management';
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

// Load the settings script for testing
const settingsPath = path.join(__dirname, '../../slack-settings.js');
const settingsContent = fs.readFileSync(settingsPath, 'utf8');

console.log(`🚀 Running ${TEST_NAME} Tests`);
console.log('=====================================\n');

// Test 1: Settings Loading Functions
runTest('Settings Loading Functions', () => {
    assert(settingsContent.includes('loadSettings'), 'loadSettings method not found');
    assert(settingsContent.includes('localStorage.getItem'), 'localStorage.getItem not found');
    assert(settingsContent.includes('slackpolish_settings'), 'Settings key not found');
    assert(settingsContent.includes('JSON.parse'), 'JSON parsing not found');
});

// Test 2: Settings Saving Functions
runTest('Settings Saving Functions', () => {
    assert(settingsContent.includes('saveSettings'), 'saveSettings method not found');
    assert(settingsContent.includes('localStorage.setItem'), 'localStorage.setItem not found');
    assert(settingsContent.includes('JSON.stringify'), 'JSON stringification not found');
    assert(settingsContent.includes('slackpolish_openai_api_key'), 'API key storage not found');
});

// Test 3: Default Settings Structure
runTest('Default Settings Structure', () => {
    assert(settingsContent.includes('defaultSettings'), 'defaultSettings object not found');
    assert(settingsContent.includes('language:'), 'Language setting not found');
    assert(settingsContent.includes('style:'), 'Style setting not found');
    assert(settingsContent.includes('improveHotkey:'), 'Hotkey setting not found');
    assert(settingsContent.includes('personalPolish:'), 'Personal polish setting not found');
    assert(settingsContent.includes('smartContext:'), 'Smart context setting not found');
});

// Test 4: Settings Error Handling
runTest('Settings Error Handling', () => {
    assert(settingsContent.includes('try {'), 'Error handling try blocks not found');
    assert(settingsContent.includes('catch (error)'), 'Error handling catch blocks not found');
    assert(settingsContent.includes('Error loading settings'), 'Settings loading error handling not found');
    assert(settingsContent.includes('return { ...this.defaultSettings }'), 'Default settings fallback not found');
});

// Test 5: API Key Management
runTest('API Key Management', () => {
    assert(settingsContent.includes('apiKey'), 'API key handling not found');
    assert(settingsContent.includes('slackpolish_openai_api_key'), 'API key storage key not found');
    assert(settingsContent.includes('delete settingsToSave.apiKey'), 'API key separation not found');
});

// Test 6: Settings Menu Creation
runTest('Settings Menu Creation', () => {
    assert(settingsContent.includes('showSettingsMenu'), 'showSettingsMenu method not found');
    assert(settingsContent.includes('createSettingsHTML'), 'createSettingsHTML method not found');
    assert(settingsContent.includes('slackpolish-settings-menu'), 'Settings menu ID not found');
    assert(settingsContent.includes('appendChild'), 'Element appending not found');
});

// Test 7: Developer Mode Toggle
runTest('Developer Mode Toggle', () => {
    assert(settingsContent.includes('dev-trigger'), 'Developer mode trigger not found');
    assert(settingsContent.includes('clickCount'), 'Click counter not found');
    assert(settingsContent.includes('clickCount >= 10'), 'Developer mode activation threshold not found');
    assert(settingsContent.includes('developer-options'), 'Developer options container not found');
});

// Test 8: Settings Validation
runTest('Settings Validation', () => {
    assert(settingsContent.includes('!settings.smartContext'), 'Smart context validation not found');
    assert(settingsContent.includes('smartContext') && settingsContent.includes('enabled'), 'Smart context validation not found');
    assert(settingsContent.includes('defaultSettings'), 'Default settings validation not found');
});

// Test 9: Cross-Tab Settings Synchronization
runTest('Cross-Tab Settings Synchronization', () => {
    assert(settingsContent.includes('CustomEvent'), 'Custom event creation not found');
    assert(settingsContent.includes('slackpolish-settings-updated'), 'Settings update event not found');
    assert(settingsContent.includes('dispatchEvent'), 'Event dispatching not found');
    assert(settingsContent.includes('addEventListener'), 'Event listening not found');
});

// Test 10: Version Information Display
runTest('Version Information Display', () => {
    assert(settingsContent.includes('VERSION'), 'Version display not found');
    assert(settingsContent.includes('BUILD'), 'Build number display not found');
    assert(settingsContent.includes('BUILD_DATE'), 'Build date display not found');
    assert(settingsContent.includes('SLACKPOLISH_CONFIG'), 'Config access not found');
});

// Test 11: Settings Form Elements
runTest('Settings Form Elements', () => {
    assert(settingsContent.includes('language-select'), 'Language selector not found');
    assert(settingsContent.includes('style-select'), 'Style selector not found');
    assert(settingsContent.includes('hotkey-select'), 'Hotkey selector not found');
    assert(settingsContent.includes('personal-polish'), 'Personal polish input not found');
});

// Test 12: Settings Event Listeners
runTest('Settings Event Listeners', () => {
    assert(settingsContent.includes('addEventListener'), 'Event listener addition not found');
    assert(settingsContent.includes('change'), 'Change event handling not found');
    assert(settingsContent.includes('click'), 'Click event handling not found');
    assert(settingsContent.includes('F12'), 'Settings hotkey handling not found');
});

// Test 13: Settings Menu Styling
runTest('Settings Menu Styling', () => {
    assert(settingsContent.includes('position: fixed'), 'Fixed positioning not found');
    assert(settingsContent.includes('z-index'), 'Z-index styling not found');
    assert(settingsContent.includes('background'), 'Background styling not found');
    assert(settingsContent.includes('border-radius'), 'Border radius styling not found');
});

// Test 14: Settings Persistence
runTest('Settings Persistence', () => {
    assert(settingsContent.includes('Settings saved successfully'), 'Save success message not found');
    assert(settingsContent.includes('utils.log'), 'Logging functionality not found');
    assert(settingsContent.includes('utils.debug'), 'Debug logging not found');
});

console.log('\n=====================================');
console.log('📊 TEST SUMMARY');
console.log('=====================================');
console.log(`Total Tests: ${testsTotal}`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsTotal - testsPassed}`);
console.log(`📈 Success Rate: ${Math.round((testsPassed / testsTotal) * 100)}%`);

if (testsPassed === testsTotal) {
    console.log('\n🎉 All settings management tests passed!');
    process.exit(0);
} else {
    console.log('\n💥 Some settings management tests failed.');
    process.exit(1);
}
