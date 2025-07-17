#!/usr/bin/env node

/**
 * Unit Test: Configuration Loading
 * Tests the loading and validation of slack-config.js
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

// Test suite
class ConfigLoadingTests {
    constructor() {
        this.testCount = 0;
        this.passedCount = 0;
        this.failedCount = 0;
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
        if (!fs.existsSync(configPath)) {
            throw new Error(`Config file not found at: ${configPath}`);
        }

        // Read and evaluate the config file
        const configContent = fs.readFileSync(configPath, 'utf8');
        
        // Extract the config object (simple parsing)
        const configMatch = configContent.match(/window\.SLACKPOLISH_CONFIG\s*=\s*({[\s\S]*?});/);
        if (!configMatch) {
            throw new Error('Could not find SLACKPOLISH_CONFIG in config file');
        }

        // Evaluate the config object
        const configString = configMatch[1];
        const config = eval(`(${configString})`);
        return config;
    }

    testConfigFileExists() {
        const configPath = path.join(__dirname, '../../slack-config.js');
        assert(fs.existsSync(configPath), 'Config file should exist');
    }

    testConfigStructure() {
        const config = this.loadConfig();

        // Test main structure
        assertExists(config.OPENAI_API_KEY, 'OPENAI_API_KEY should exist');
        assertExists(config.RESET_SAVED_SETTINGS, 'RESET_SAVED_SETTINGS should exist');
        assertExists(config.RESET_API_KEY, 'RESET_API_KEY should exist');
        assertExists(config.DEFAULT_SETTINGS, 'DEFAULT_SETTINGS should exist');
        assertExists(config.SUPPORTED_LANGUAGES, 'SUPPORTED_LANGUAGES should exist');
        assertExists(config.AVAILABLE_STYLES, 'AVAILABLE_STYLES should exist');
    }

    testDefaultSettings() {
        const config = this.loadConfig();
        const defaults = config.DEFAULT_SETTINGS;
        
        assertExists(defaults.language, 'Default language should exist');
        assertExists(defaults.style, 'Default style should exist');
        assertExists(defaults.improveHotkey, 'Default hotkey should exist');
        assertExists(defaults.personalPolish, 'Default personal polish should exist');
        
        assertType(defaults.personalPolish, 'string', 'Personal polish should be string');
        assertEqual(defaults.personalPolish, '', 'Personal polish should default to empty string');
    }

    testLanguageConfiguration() {
        const config = this.loadConfig();
        const languages = config.SUPPORTED_LANGUAGES;

        assertType(languages, 'object', 'Languages should be an object');

        // Check for required languages
        const languageKeys = Object.keys(languages);
        assert(languageKeys.length >= 8, 'Should have at least 8 languages');
        assert(languageKeys.includes('ENGLISH'), 'Should include English');
        assert(languageKeys.includes('SPANISH'), 'Should include Spanish');
        assert(languageKeys.includes('HEBREW'), 'Should include Hebrew');
        assert(languageKeys.includes('BULGARIAN'), 'Should include Bulgarian');

        // Test language structure
        const english = languages.ENGLISH;
        assertExists(english.name, 'Language should have name');
        assertExists(english.flag, 'Language should have flag');
        assertExists(english.displayName, 'Language should have displayName');
    }

    testStyleConfiguration() {
        const config = this.loadConfig();
        const styles = config.AVAILABLE_STYLES;

        assertType(styles, 'object', 'Styles should be an object');

        // Check for required styles
        const styleKeys = Object.keys(styles);
        assert(styleKeys.length >= 5, 'Should have at least 5 styles');
        assert(styleKeys.includes('PROFESSIONAL'), 'Should include Professional');
        assert(styleKeys.includes('CASUAL'), 'Should include Casual');
        assert(styleKeys.includes('TRANSLATE'), 'Should include Translate');

        // Test style structure
        const professional = styles.PROFESSIONAL;
        assertExists(professional.name, 'Style should have name');
        assertExists(professional.description, 'Style should have description');
    }

    testResetFlags() {
        const config = this.loadConfig();
        
        assertType(config.RESET_SAVED_SETTINGS, 'boolean', 'RESET_SAVED_SETTINGS should be boolean');
        assertType(config.RESET_API_KEY, 'boolean', 'RESET_API_KEY should be boolean');
        assertExists(config.RESET_SAVED_SETTINGS_VERSION, 'RESET_SAVED_SETTINGS_VERSION should exist');
        assertExists(config.RESET_API_KEY_VERSION, 'RESET_API_KEY_VERSION should exist');
    }

    testOpenAIConfiguration() {
        const config = this.loadConfig();
        
        assertExists(config.OPENAI_API_KEY, 'API key should exist');
        assertType(config.OPENAI_API_KEY, 'string', 'API key should be string');
        
        if (config.OPENAI_MODEL) {
            assertType(config.OPENAI_MODEL, 'string', 'OpenAI model should be string');
        }
        
        if (config.OPENAI_MAX_TOKENS) {
            assertType(config.OPENAI_MAX_TOKENS, 'number', 'Max tokens should be number');
        }
    }

    runAllTests() {
        console.log('🚀 Starting Configuration Loading Tests\n');
        
        this.runTest('Config file exists', () => this.testConfigFileExists());
        this.runTest('Config structure validation', () => this.testConfigStructure());
        this.runTest('Default settings validation', () => this.testDefaultSettings());
        this.runTest('Language configuration', () => this.testLanguageConfiguration());
        this.runTest('Style configuration', () => this.testStyleConfiguration());
        this.runTest('Reset flags validation', () => this.testResetFlags());
        this.runTest('OpenAI configuration', () => this.testOpenAIConfiguration());
        
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
    const tests = new ConfigLoadingTests();
    tests.runAllTests();
}

module.exports = ConfigLoadingTests;
