#!/usr/bin/env node

/**
 * Unit Test: Settings Validation
 * Tests the validation and sanitization of user settings
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

function assertType(value, expectedType, message) {
    if (typeof value !== expectedType) {
        throw new Error(`Assertion failed: ${message}\nExpected type: ${expectedType}\nActual type: ${typeof value}`);
    }
}

// Mock localStorage for testing
global.localStorage = {
    data: {},
    setItem: function(key, value) {
        this.data[key] = value;
    },
    getItem: function(key) {
        return this.data[key] || null;
    },
    removeItem: function(key) {
        delete this.data[key];
    },
    clear: function() {
        this.data = {};
    }
};

// Mock window object
global.window = {
    localStorage: global.localStorage
};

// Test suite
class SettingsValidationTests {
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

    // Simulate the settings validation logic from the main script
    validateSettings(settings) {
        const validLanguages = Object.keys(this.config.SUPPORTED_LANGUAGES);
        const validStyles = Object.keys(this.config.AVAILABLE_STYLES);
        const validHotkeys = this.config.AVAILABLE_HOTKEYS;

        const validated = {
            language: validLanguages.includes(settings.language) ? settings.language : this.config.DEFAULT_SETTINGS.language,
            style: validStyles.includes(settings.style) ? settings.style : this.config.DEFAULT_SETTINGS.style,
            improveHotkey: validHotkeys.includes(settings.improveHotkey) ? settings.improveHotkey : this.config.DEFAULT_SETTINGS.improveHotkey,
            personalPolish: typeof settings.personalPolish === 'string' ? settings.personalPolish : this.config.DEFAULT_SETTINGS.personalPolish
        };

        return validated;
    }

    testValidSettingsPassThrough() {
        const validSettings = {
            language: 'ENGLISH',
            style: 'PROFESSIONAL',
            improveHotkey: 'Ctrl+Shift',
            personalPolish: 'Use friendly tone'
        };

        const result = this.validateSettings(validSettings);
        
        assertEqual(result.language, 'ENGLISH', 'Valid language should pass through');
        assertEqual(result.style, 'PROFESSIONAL', 'Valid style should pass through');
        assertEqual(result.improveHotkey, 'Ctrl+Shift', 'Valid hotkey should pass through');
        assertEqual(result.personalPolish, 'Use friendly tone', 'Valid personal polish should pass through');
    }

    testInvalidLanguageFallback() {
        const invalidSettings = {
            language: 'INVALID_LANGUAGE',
            style: 'PROFESSIONAL',
            improveHotkey: 'Ctrl+Shift',
            personalPolish: ''
        };

        const result = this.validateSettings(invalidSettings);
        
        assertEqual(result.language, this.config.DEFAULT_SETTINGS.language, 'Invalid language should fallback to default');
        assertEqual(result.style, 'PROFESSIONAL', 'Valid style should remain unchanged');
    }

    testInvalidStyleFallback() {
        const invalidSettings = {
            language: 'ENGLISH',
            style: 'INVALID_STYLE',
            improveHotkey: 'Ctrl+Shift',
            personalPolish: ''
        };

        const result = this.validateSettings(invalidSettings);
        
        assertEqual(result.language, 'ENGLISH', 'Valid language should remain unchanged');
        assertEqual(result.style, this.config.DEFAULT_SETTINGS.style, 'Invalid style should fallback to default');
    }

    testInvalidHotkeyFallback() {
        const invalidSettings = {
            language: 'ENGLISH',
            style: 'PROFESSIONAL',
            improveHotkey: 'Invalid+Key',
            personalPolish: ''
        };

        const result = this.validateSettings(invalidSettings);
        
        assertEqual(result.improveHotkey, this.config.DEFAULT_SETTINGS.improveHotkey, 'Invalid hotkey should fallback to default');
    }

    testPersonalPolishTypeSafety() {
        const invalidSettings = {
            language: 'ENGLISH',
            style: 'PROFESSIONAL',
            improveHotkey: 'Ctrl+Shift',
            personalPolish: 123 // Invalid type
        };

        const result = this.validateSettings(invalidSettings);
        
        assertEqual(result.personalPolish, this.config.DEFAULT_SETTINGS.personalPolish, 'Non-string personal polish should fallback to default');
    }

    testEmptyPersonalPolish() {
        const settings = {
            language: 'ENGLISH',
            style: 'PROFESSIONAL',
            improveHotkey: 'Ctrl+Shift',
            personalPolish: ''
        };

        const result = this.validateSettings(settings);
        
        assertEqual(result.personalPolish, '', 'Empty personal polish should be allowed');
    }

    testLongPersonalPolish() {
        const longText = 'A'.repeat(1000);
        const settings = {
            language: 'ENGLISH',
            style: 'PROFESSIONAL',
            improveHotkey: 'Ctrl+Shift',
            personalPolish: longText
        };

        const result = this.validateSettings(settings);
        
        assertEqual(result.personalPolish, longText, 'Long personal polish should be allowed');
    }

    testAllLanguagesValid() {
        const languages = Object.keys(this.config.SUPPORTED_LANGUAGES);
        
        for (const language of languages) {
            const settings = {
                language: language,
                style: 'PROFESSIONAL',
                improveHotkey: 'Ctrl+Shift',
                personalPolish: ''
            };

            const result = this.validateSettings(settings);
            assertEqual(result.language, language, `Language ${language} should be valid`);
        }
    }

    testAllStylesValid() {
        const styles = Object.keys(this.config.AVAILABLE_STYLES);
        
        for (const style of styles) {
            const settings = {
                language: 'ENGLISH',
                style: style,
                improveHotkey: 'Ctrl+Shift',
                personalPolish: ''
            };

            const result = this.validateSettings(settings);
            assertEqual(result.style, style, `Style ${style} should be valid`);
        }
    }

    testAllHotkeysValid() {
        const hotkeys = this.config.AVAILABLE_HOTKEYS;
        
        for (const hotkey of hotkeys) {
            const settings = {
                language: 'ENGLISH',
                style: 'PROFESSIONAL',
                improveHotkey: hotkey,
                personalPolish: ''
            };

            const result = this.validateSettings(settings);
            assertEqual(result.improveHotkey, hotkey, `Hotkey ${hotkey} should be valid`);
        }
    }

    runAllTests() {
        console.log('🚀 Starting Settings Validation Tests\n');
        
        this.runTest('Valid settings pass through', () => this.testValidSettingsPassThrough());
        this.runTest('Invalid language fallback', () => this.testInvalidLanguageFallback());
        this.runTest('Invalid style fallback', () => this.testInvalidStyleFallback());
        this.runTest('Invalid hotkey fallback', () => this.testInvalidHotkeyFallback());
        this.runTest('Personal polish type safety', () => this.testPersonalPolishTypeSafety());
        this.runTest('Empty personal polish allowed', () => this.testEmptyPersonalPolish());
        this.runTest('Long personal polish allowed', () => this.testLongPersonalPolish());
        this.runTest('All languages valid', () => this.testAllLanguagesValid());
        this.runTest('All styles valid', () => this.testAllStylesValid());
        this.runTest('All hotkeys valid', () => this.testAllHotkeysValid());
        
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
    const tests = new SettingsValidationTests();
    tests.runAllTests();
}

module.exports = SettingsValidationTests;
