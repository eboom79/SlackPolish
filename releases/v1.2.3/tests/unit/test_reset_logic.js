#!/usr/bin/env node

/**
 * Unit Test: Reset Logic
 * Tests the reset flag behavior and version handling
 */

const fs = require('fs');
const path = require('path');

// Test framework
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`Assertion failed: ${message}\nExpected: ${expected}\nActual: ${actual}`);
    }
}

// Mock localStorage for testing
class MockLocalStorage {
    constructor() {
        this.data = {};
    }

    setItem(key, value) {
        this.data[key] = value;
    }

    getItem(key) {
        return this.data[key] || null;
    }

    removeItem(key) {
        delete this.data[key];
    }

    clear() {
        this.data = {};
    }
}

global.localStorage = new MockLocalStorage();

class ResetLogicTests {
    constructor() {
        this.testCount = 0;
        this.passedCount = 0;
        this.failedCount = 0;
        this.config = this.loadConfig();
    }

    runTest(testName, testFunction) {
        this.testCount++;
        try {
            console.log(`🧪 Running: ${testName}`);
            // Clear localStorage before each test
            localStorage.clear();
            testFunction();
            this.passedCount++;
            console.log(`✅ PASSED: ${testName}`);
        } catch (error) {
            this.failedCount++;
            console.log(`❌ FAILED: ${testName}`);
            console.log(`   Error: ${error.message}`);
        }
    }

    loadConfig() {
        const configPath = path.join(__dirname, '../../slack-config.js');
        const configContent = fs.readFileSync(configPath, 'utf8');
        const configMatch = configContent.match(/window\.SLACKPOLISH_CONFIG\s*=\s*({[\s\S]*?});/);
        const configString = configMatch[1];
        return eval(`(${configString})`);
    }

    // Simulate the reset logic from the main script
    shouldResetSettings(config) {
        if (!config.RESET_SAVED_SETTINGS) {
            return false;
        }

        const resetVersion = config.RESET_SAVED_SETTINGS_VERSION;
        const lastResetVersion = localStorage.getItem('slackpolish-last-settings-reset');
        
        return lastResetVersion !== resetVersion;
    }

    shouldResetApiKey(config) {
        if (!config.RESET_API_KEY) {
            return false;
        }

        const resetVersion = config.RESET_API_KEY_VERSION;
        const lastResetVersion = localStorage.getItem('slackpolish-last-api-key-reset');
        
        return lastResetVersion !== resetVersion;
    }

    performSettingsReset(config) {
        if (this.shouldResetSettings(config)) {
            localStorage.removeItem('slackpolish-settings');
            localStorage.setItem('slackpolish-last-settings-reset', config.RESET_SAVED_SETTINGS_VERSION);
            return true;
        }
        return false;
    }

    performApiKeyReset(config) {
        if (this.shouldResetApiKey(config)) {
            localStorage.removeItem('slackpolish-api-key');
            localStorage.setItem('slackpolish-last-api-key-reset', config.RESET_API_KEY_VERSION);
            return true;
        }
        return false;
    }

    testSettingsResetWhenFlagTrue() {
        const testConfig = {
            ...this.config,
            RESET_SAVED_SETTINGS: true,
            RESET_SAVED_SETTINGS_VERSION: 'test-version-1'
        };

        // Set up existing settings
        localStorage.setItem('slackpolish-settings', '{"language":"SPANISH"}');
        
        const shouldReset = this.shouldResetSettings(testConfig);
        assert(shouldReset, 'Should reset settings when flag is true and no previous reset');
        
        const wasReset = this.performSettingsReset(testConfig);
        assert(wasReset, 'Settings should be reset');
        
        const settings = localStorage.getItem('slackpolish-settings');
        assertEqual(settings, null, 'Settings should be removed after reset');
        
        const resetVersion = localStorage.getItem('slackpolish-last-settings-reset');
        assertEqual(resetVersion, 'test-version-1', 'Reset version should be stored');
    }

    testSettingsResetWhenFlagFalse() {
        const testConfig = {
            ...this.config,
            RESET_SAVED_SETTINGS: false,
            RESET_SAVED_SETTINGS_VERSION: 'test-version-1'
        };

        localStorage.setItem('slackpolish-settings', '{"language":"SPANISH"}');
        
        const shouldReset = this.shouldResetSettings(testConfig);
        assert(!shouldReset, 'Should not reset settings when flag is false');
        
        const wasReset = this.performSettingsReset(testConfig);
        assert(!wasReset, 'Settings should not be reset');
        
        const settings = localStorage.getItem('slackpolish-settings');
        assertEqual(settings, '{"language":"SPANISH"}', 'Settings should remain unchanged');
    }

    testSettingsResetOnlyOnce() {
        const testConfig = {
            ...this.config,
            RESET_SAVED_SETTINGS: true,
            RESET_SAVED_SETTINGS_VERSION: 'test-version-1'
        };

        // First reset
        localStorage.setItem('slackpolish-settings', '{"language":"SPANISH"}');
        const firstReset = this.performSettingsReset(testConfig);
        assert(firstReset, 'First reset should occur');

        // Second attempt with same version
        localStorage.setItem('slackpolish-settings', '{"language":"FRENCH"}');
        const secondReset = this.performSettingsReset(testConfig);
        assert(!secondReset, 'Second reset should not occur with same version');
        
        const settings = localStorage.getItem('slackpolish-settings');
        assertEqual(settings, '{"language":"FRENCH"}', 'Settings should remain after second attempt');
    }

    testSettingsResetWithNewVersion() {
        const testConfig1 = {
            ...this.config,
            RESET_SAVED_SETTINGS: true,
            RESET_SAVED_SETTINGS_VERSION: 'test-version-1'
        };

        const testConfig2 = {
            ...this.config,
            RESET_SAVED_SETTINGS: true,
            RESET_SAVED_SETTINGS_VERSION: 'test-version-2'
        };

        // First reset
        localStorage.setItem('slackpolish-settings', '{"language":"SPANISH"}');
        this.performSettingsReset(testConfig1);

        // Second reset with new version
        localStorage.setItem('slackpolish-settings', '{"language":"FRENCH"}');
        const secondReset = this.performSettingsReset(testConfig2);
        assert(secondReset, 'Reset should occur with new version');
        
        const settings = localStorage.getItem('slackpolish-settings');
        assertEqual(settings, null, 'Settings should be reset with new version');
        
        const resetVersion = localStorage.getItem('slackpolish-last-settings-reset');
        assertEqual(resetVersion, 'test-version-2', 'New reset version should be stored');
    }

    testApiKeyResetWhenFlagTrue() {
        const testConfig = {
            ...this.config,
            RESET_API_KEY: true,
            RESET_API_KEY_VERSION: 'test-api-version-1'
        };

        localStorage.setItem('slackpolish-api-key', 'sk-test-key');
        
        const shouldReset = this.shouldResetApiKey(testConfig);
        assert(shouldReset, 'Should reset API key when flag is true');
        
        const wasReset = this.performApiKeyReset(testConfig);
        assert(wasReset, 'API key should be reset');
        
        const apiKey = localStorage.getItem('slackpolish-api-key');
        assertEqual(apiKey, null, 'API key should be removed after reset');
        
        const resetVersion = localStorage.getItem('slackpolish-last-api-key-reset');
        assertEqual(resetVersion, 'test-api-version-1', 'API key reset version should be stored');
    }

    testApiKeyResetWhenFlagFalse() {
        const testConfig = {
            ...this.config,
            RESET_API_KEY: false,
            RESET_API_KEY_VERSION: 'test-api-version-1'
        };

        localStorage.setItem('slackpolish-api-key', 'sk-test-key');
        
        const shouldReset = this.shouldResetApiKey(testConfig);
        assert(!shouldReset, 'Should not reset API key when flag is false');
        
        const wasReset = this.performApiKeyReset(testConfig);
        assert(!wasReset, 'API key should not be reset');
        
        const apiKey = localStorage.getItem('slackpolish-api-key');
        assertEqual(apiKey, 'sk-test-key', 'API key should remain unchanged');
    }

    testBothResetsIndependent() {
        const testConfig = {
            ...this.config,
            RESET_SAVED_SETTINGS: true,
            RESET_SAVED_SETTINGS_VERSION: 'settings-v1',
            RESET_API_KEY: false,
            RESET_API_KEY_VERSION: 'api-v1'
        };

        localStorage.setItem('slackpolish-settings', '{"language":"SPANISH"}');
        localStorage.setItem('slackpolish-api-key', 'sk-test-key');
        
        const settingsReset = this.performSettingsReset(testConfig);
        const apiKeyReset = this.performApiKeyReset(testConfig);
        
        assert(settingsReset, 'Settings should be reset');
        assert(!apiKeyReset, 'API key should not be reset');
        
        const settings = localStorage.getItem('slackpolish-settings');
        const apiKey = localStorage.getItem('slackpolish-api-key');
        
        assertEqual(settings, null, 'Settings should be removed');
        assertEqual(apiKey, 'sk-test-key', 'API key should remain');
    }

    testVersionStringHandling() {
        const testConfig = {
            ...this.config,
            RESET_SAVED_SETTINGS: true,
            RESET_SAVED_SETTINGS_VERSION: 'install-1234567890'
        };

        // Test with timestamp-like version
        const shouldReset = this.shouldResetSettings(testConfig);
        assert(shouldReset, 'Should handle timestamp-like version strings');
        
        this.performSettingsReset(testConfig);
        
        const resetVersion = localStorage.getItem('slackpolish-last-settings-reset');
        assertEqual(resetVersion, 'install-1234567890', 'Should store complex version string');
    }

    runAllTests() {
        console.log('🚀 Starting Reset Logic Tests\n');
        
        this.runTest('Settings reset when flag true', () => this.testSettingsResetWhenFlagTrue());
        this.runTest('Settings reset when flag false', () => this.testSettingsResetWhenFlagFalse());
        this.runTest('Settings reset only once', () => this.testSettingsResetOnlyOnce());
        this.runTest('Settings reset with new version', () => this.testSettingsResetWithNewVersion());
        this.runTest('API key reset when flag true', () => this.testApiKeyResetWhenFlagTrue());
        this.runTest('API key reset when flag false', () => this.testApiKeyResetWhenFlagFalse());
        this.runTest('Both resets independent', () => this.testBothResetsIndependent());
        this.runTest('Version string handling', () => this.testVersionStringHandling());
        
        console.log('\n📊 Test Results:');
        console.log(`   Total: ${this.testCount}`);
        console.log(`   ✅ Passed: ${this.passedCount}`);
        console.log(`   ❌ Failed: ${this.failedCount}`);
        
        if (this.failedCount === 0) {
            console.log('\n🎉 All tests passed!');
            process.exit(0);
        } else {
            console.log('\n💥 Some tests failed!');
            process.exit(1);
        }
    }
}

if (require.main === module) {
    const tests = new ResetLogicTests();
    tests.runAllTests();
}

module.exports = ResetLogicTests;
