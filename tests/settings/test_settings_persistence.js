#!/usr/bin/env node

/**
 * Settings Test: Settings Persistence
 * Tests the localStorage save/load functionality
 */

const fs = require('fs');
const path = require('path');

// Test framework - simple assertion functions
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

function assertExists(value, message) {
    if (value === undefined || value === null) {
        throw new Error(`Assertion failed: ${message}\nValue should exist but is ${value}`);
    }
}

function assertDeepEqual(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Assertion failed: ${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
    }
}

// Mock localStorage for testing
class MockLocalStorage {
    constructor() {
        this.data = {};
    }

    setItem(key, value) {
        // Synchronous for testing
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

    // Test helper methods
    getStoredData() {
        return { ...this.data };
    }
}

// Mock window object
global.localStorage = new MockLocalStorage();
global.window = {
    localStorage: global.localStorage
};

// Test suite
class SettingsPersistenceTests {
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
        // Load the actual config file
        const configPath = path.join(__dirname, '../../slack-config.js');
        const configContent = fs.readFileSync(configPath, 'utf8');
        
        // Extract the config object
        const configMatch = configContent.match(/window\.SLACKPOLISH_CONFIG\s*=\s*({[\s\S]*?});/);
        const configString = configMatch[1];
        const config = eval(`(${configString})`);
        return config;
    }

    // Simulate the settings save/load logic from the main script
    saveSettings(settings) {
        try {
            const settingsJson = JSON.stringify(settings);
            localStorage.setItem('slackpolish-settings', settingsJson);
            return true;
        } catch (error) {
            return false;
        }
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('slackpolish-settings');
            if (saved) {
                const parsedSettings = JSON.parse(saved);
                return { ...this.config.DEFAULT_SETTINGS, ...parsedSettings };
            } else {
                return { ...this.config.DEFAULT_SETTINGS };
            }
        } catch (error) {
            // Return defaults on error
            return { ...this.config.DEFAULT_SETTINGS };
        }
    }

    testBasicSaveAndLoad() {
        const testSettings = {
            language: 'SPANISH',
            style: 'PROFESSIONAL',
            improveHotkey: 'Ctrl+Alt',
            personalPolish: 'Use formal tone',
            smartContext: {
                enabled: true,
                maxMessages: 5,
                privacyMode: false,
                minMessageLength: 3,
                maxContextAge: 86400000,
                includeThreadContext: true
            },
            debugMode: false
        };

        // Save settings
        const saveResult = this.saveSettings(testSettings);
        assert(saveResult, 'Settings should save successfully');

        // Load settings
        const loadedSettings = this.loadSettings();
        assertDeepEqual(loadedSettings, testSettings, 'Loaded settings should match saved settings');
    }

    testDefaultSettingsWhenEmpty() {
        // Don't save anything, just load
        const loadedSettings = this.loadSettings();
        assertDeepEqual(loadedSettings, this.config.DEFAULT_SETTINGS, 'Should return default settings when nothing saved');
    }

    testPersonalPolishPersistence() {
        const testSettings = {
            language: 'ENGLISH',
            style: 'CASUAL',
            improveHotkey: 'Ctrl+Shift',
            personalPolish: 'I prefer "Hi" instead of "Hey". Don\'t use dashes (-) in sentences.'
        };

        this.saveSettings(testSettings);
        const loadedSettings = this.loadSettings();
        
        assertEqual(loadedSettings.personalPolish, testSettings.personalPolish, 'Personal polish should persist correctly');
    }

    testEmptyPersonalPolishPersistence() {
        const testSettings = {
            language: 'ENGLISH',
            style: 'CASUAL',
            improveHotkey: 'Ctrl+Shift',
            personalPolish: ''
        };

        this.saveSettings(testSettings);
        const loadedSettings = this.loadSettings();
        
        assertEqual(loadedSettings.personalPolish, '', 'Empty personal polish should persist correctly');
    }

    testSpecialCharactersPersistence() {
        const testSettings = {
            language: 'HEBREW',
            style: 'PROFESSIONAL',
            improveHotkey: 'Ctrl+Tab',
            personalPolish: 'שלום! Use Hebrew greetings. 🇮🇱 Emojis: 😊 💼 ⚡'
        };

        this.saveSettings(testSettings);
        const loadedSettings = this.loadSettings();
        
        assertEqual(loadedSettings.personalPolish, testSettings.personalPolish, 'Special characters and emojis should persist correctly');
    }

    testCorruptedDataRecovery() {
        // Manually set corrupted data
        localStorage.setItem('slackpolish-settings', 'invalid json data {');
        
        const loadedSettings = this.loadSettings();
        assertDeepEqual(loadedSettings, this.config.DEFAULT_SETTINGS, 'Should return defaults when data is corrupted');
    }

    testPartialSettingsLoad() {
        // Save only partial settings
        const partialSettings = {
            language: 'FRENCH',
            style: 'CONCISE'
            // Missing improveHotkey and personalPolish
        };

        localStorage.setItem('slackpolish-settings', JSON.stringify(partialSettings));
        
        const loadedSettings = this.loadSettings();
        
        assertEqual(loadedSettings.language, 'FRENCH', 'Saved language should be preserved');
        assertEqual(loadedSettings.style, 'CONCISE', 'Saved style should be preserved');
        assertEqual(loadedSettings.improveHotkey, this.config.DEFAULT_SETTINGS.improveHotkey, 'Missing hotkey should use default');
        assertEqual(loadedSettings.personalPolish, this.config.DEFAULT_SETTINGS.personalPolish, 'Missing personal polish should use default');
    }

    testOverwriteSettings() {
        // Save initial settings
        const initialSettings = {
            language: 'ENGLISH',
            style: 'CASUAL',
            improveHotkey: 'Ctrl+Shift',
            personalPolish: 'Initial text'
        };

        this.saveSettings(initialSettings);
        
        // Save new settings
        const newSettings = {
            language: 'GERMAN',
            style: 'PROFESSIONAL',
            improveHotkey: 'Ctrl+Alt',
            personalPolish: 'Updated text',
            smartContext: {
                enabled: true,
                maxMessages: 5,
                privacyMode: false,
                minMessageLength: 3,
                maxContextAge: 86400000,
                includeThreadContext: true
            },
            debugMode: false
        };

        this.saveSettings(newSettings);
        
        const loadedSettings = this.loadSettings();
        assertDeepEqual(loadedSettings, newSettings, 'New settings should overwrite old settings');
    }

    testLargePersonalPolishData() {
        const largeText = 'A'.repeat(5000); // 5KB of text
        const testSettings = {
            language: 'ENGLISH',
            style: 'CASUAL',
            improveHotkey: 'Ctrl+Shift',
            personalPolish: largeText
        };

        this.saveSettings(testSettings);
        const loadedSettings = this.loadSettings();
        
        assertEqual(loadedSettings.personalPolish, largeText, 'Large personal polish text should persist correctly');
    }

    testMultipleLanguageSettings() {
        const languages = Object.keys(this.config.SUPPORTED_LANGUAGES);
        
        for (const language of languages) {
            const testSettings = {
                language: language,
                style: 'PROFESSIONAL',
                improveHotkey: 'Ctrl+Shift',
                personalPolish: `Settings for ${language}`
            };

            this.saveSettings(testSettings);
            const loadedSettings = this.loadSettings();
            
            assertEqual(loadedSettings.language, language, `Language ${language} should persist correctly`);
            assertEqual(loadedSettings.personalPolish, `Settings for ${language}`, `Personal polish for ${language} should persist correctly`);
        }
    }

    runAllTests() {
        console.log('🚀 Starting Settings Persistence Tests\n');
        
        this.runTest('Basic save and load', () => this.testBasicSaveAndLoad());
        this.runTest('Default settings when empty', () => this.testDefaultSettingsWhenEmpty());
        this.runTest('Personal polish persistence', () => this.testPersonalPolishPersistence());
        this.runTest('Empty personal polish persistence', () => this.testEmptyPersonalPolishPersistence());
        this.runTest('Special characters persistence', () => this.testSpecialCharactersPersistence());
        this.runTest('Corrupted data recovery', () => this.testCorruptedDataRecovery());
        this.runTest('Partial settings load', () => this.testPartialSettingsLoad());
        this.runTest('Overwrite settings', () => this.testOverwriteSettings());
        this.runTest('Large personal polish data', () => this.testLargePersonalPolishData());
        this.runTest('Multiple language settings', () => this.testMultipleLanguageSettings());
        
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

// Run the tests
if (require.main === module) {
    const tests = new SettingsPersistenceTests();
    tests.runAllTests();
}

module.exports = SettingsPersistenceTests;
