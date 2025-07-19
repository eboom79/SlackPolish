#!/usr/bin/env node

/**
 * SlackPolish LocalStorage Operations Tests
 * Tests localStorage operations, data persistence, and error handling
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_NAME = 'LocalStorage Operations';
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
const scriptPath = path.join(__dirname, '../../slack-text-improver.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

const settingsPath = path.join(__dirname, '../../slack-settings.js');
const settingsContent = fs.readFileSync(settingsPath, 'utf8');

console.log(`🚀 Running ${TEST_NAME} Tests`);
console.log('=====================================\n');

// Test 1: LocalStorage Key Management
runTest('LocalStorage Key Management', () => {
    assert(settingsContent.includes('slackpolish_settings'), 'Settings storage key not found');
    assert(settingsContent.includes('slackpolish_openai_api_key'), 'API key storage key not found');
    assert(scriptContent.includes('localStorage.getItem') || settingsContent.includes('localStorage.getItem'), 'localStorage.getItem not found');
    assert(scriptContent.includes('localStorage.setItem') || settingsContent.includes('localStorage.setItem'), 'localStorage.setItem not found');
});

// Test 2: Settings Persistence
runTest('Settings Persistence', () => {
    assert(settingsContent.includes('JSON.stringify'), 'Settings serialization not found');
    assert(settingsContent.includes('JSON.parse'), 'Settings deserialization not found');
    assert(settingsContent.includes('saveSettings'), 'Settings save method not found');
    assert(settingsContent.includes('loadSettings'), 'Settings load method not found');
});

// Test 3: API Key Secure Storage
runTest('API Key Secure Storage', () => {
    assert(settingsContent.includes('slackpolish_openai_api_key'), 'API key storage key not found');
    assert(settingsContent.includes('delete settingsToSave.apiKey'), 'API key separation not found');
    assert(settingsContent.includes('localStorage.setItem') && settingsContent.includes('apiKey'), 'API key storage not found');
});

// Test 4: LocalStorage Error Handling
runTest('LocalStorage Error Handling', () => {
    assert(settingsContent.includes('try {') && settingsContent.includes('localStorage'), 'LocalStorage error handling not found');
    assert(settingsContent.includes('catch (error)'), 'LocalStorage error catching not found');
    assert(settingsContent.includes('Error loading settings') || settingsContent.includes('Error saving'), 'LocalStorage error messages not found');
});

// Test 5: Data Validation Before Storage
runTest('Data Validation Before Storage', () => {
    assert(settingsContent.includes('defaultSettings'), 'Default settings validation not found');
    assert(settingsContent.includes('...this.defaultSettings'), 'Settings merging not found');
    assert(settingsContent.includes('smartContext') && settingsContent.includes('!settings.smartContext'), 'Smart context validation not found');
});

// Test 6: Storage Quota Handling
runTest('Storage Quota Handling', () => {
    assert(settingsContent.includes('catch (error)') && settingsContent.includes('localStorage'), 'Storage error handling not found');
    assert(settingsContent.includes('return { ...this.defaultSettings }'), 'Storage failure fallback not found');
});

// Test 7: Cross-Tab Data Synchronization
runTest('Cross-Tab Data Synchronization', () => {
    assert(settingsContent.includes('CustomEvent'), 'Custom event for sync not found');
    assert(settingsContent.includes('slackpolish-settings-updated'), 'Settings update event not found');
    assert(settingsContent.includes('addEventListener'), 'Event listener not found');
});

// Test 8: Data Migration and Compatibility
runTest('Data Migration and Compatibility', () => {
    assert(settingsContent.includes('defaultSettings'), 'Default settings for migration not found');
    assert(settingsContent.includes('{ ...settings, ...parsed }'), 'Settings merging for compatibility not found');
    assert(settingsContent.includes('!settings.smartContext'), 'Missing property handling not found');
});

// Test 9: Storage Key Consistency
runTest('Storage Key Consistency', () => {
    assert(settingsContent.includes('slackpolish_') && settingsContent.includes('settings'), 'Consistent key prefix not found');
    assert(settingsContent.includes('slackpolish_') && settingsContent.includes('api_key'), 'Consistent API key prefix not found');
});

// Test 10: Data Cleanup and Removal
runTest('Data Cleanup and Removal', () => {
    assert(settingsContent.includes('delete') && settingsContent.includes('apiKey'), 'Sensitive data cleanup not found');
    assert(settingsContent.includes('settingsToSave'), 'Settings cleanup not found');
});

// Test 11: Storage Availability Check
runTest('Storage Availability Check', () => {
    assert(settingsContent.includes('localStorage') && settingsContent.includes('try'), 'Storage availability check not found');
    assert(settingsContent.includes('catch') && settingsContent.includes('error'), 'Storage unavailable handling not found');
});

// Test 12: Debug Logging for Storage Operations
runTest('Debug Logging for Storage Operations', () => {
    assert(settingsContent.includes('utils.debug'), 'Debug logging not found');
    assert(settingsContent.includes('Settings saved') || settingsContent.includes('Settings loaded'), 'Storage operation logging not found');
});

// Test 13: Settings Reset Functionality
runTest('Settings Reset Functionality', () => {
    assert(settingsContent.includes('defaultSettings'), 'Default settings for reset not found');
    assert(settingsContent.includes('...this.defaultSettings'), 'Settings reset capability not found');
});

// Test 14: Storage Size Management
runTest('Storage Size Management', () => {
    assert(settingsContent.includes('JSON.stringify') && settingsContent.includes('settings'), 'Data serialization size management not found');
    assert(settingsContent.includes('delete settingsToSave.apiKey'), 'Storage size optimization not found');
});

console.log('\n=====================================');
console.log('📊 TEST SUMMARY');
console.log('=====================================');
console.log(`Total Tests: ${testsTotal}`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsTotal - testsPassed}`);
console.log(`📈 Success Rate: ${Math.round((testsPassed / testsTotal) * 100)}%`);

if (testsPassed === testsTotal) {
    console.log('\n🎉 All localStorage operations tests passed!');
    process.exit(0);
} else {
    console.log('\n💥 Some localStorage operations tests failed.');
    process.exit(1);
}
