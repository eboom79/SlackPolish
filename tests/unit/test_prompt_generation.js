#!/usr/bin/env node

/**
 * Unit Test: Prompt Generation
 * Tests the AI prompt construction for different styles and languages
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

function assertContains(text, substring, message) {
    if (!text.includes(substring)) {
        throw new Error(`Assertion failed: ${message}\nText should contain: ${substring}\nActual text: ${text}`);
    }
}

class PromptGenerationTests {
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
        const configPath = path.join(__dirname, '../../slack-config.js');
        const configContent = fs.readFileSync(configPath, 'utf8');
        const configMatch = configContent.match(/window\.SLACKPOLISH_CONFIG\s*=\s*({[\s\S]*?});/);
        const configString = configMatch[1];
        return eval(`(${configString})`);
    }

    // Simulate prompt generation logic
    generatePrompt(style, language, personalPolish = '') {
        const stylePrompts = this.config.PROMPTS.STYLES;
        const languagePrompts = this.config.PROMPTS.LANGUAGES;
        
        const styleInstruction = stylePrompts[style] || stylePrompts.CASUAL;
        const languageInstruction = languagePrompts[language] || languagePrompts.ENGLISH;
        
        const personalInstruction = personalPolish ? 
            ` Additionally, follow these personal style preferences: ${personalPolish}` : '';
        
        return `${styleInstruction}. ${languageInstruction}.${personalInstruction} Only return the improved text, nothing else.`;
    }

    testBasicPromptGeneration() {
        const prompt = this.generatePrompt('PROFESSIONAL', 'ENGLISH');
        
        assertContains(prompt, 'professional', 'Should contain professional instruction');
        assertContains(prompt, 'English', 'Should contain English instruction');
        assertContains(prompt, 'Only return the improved text', 'Should contain return instruction');
    }

    testPersonalPolishIntegration() {
        const personalPolish = 'Use friendly tone and avoid formal language';
        const prompt = this.generatePrompt('PROFESSIONAL', 'ENGLISH', personalPolish);
        
        assertContains(prompt, personalPolish, 'Should contain personal polish instructions');
        assertContains(prompt, 'Additionally, follow these personal style preferences', 'Should have personal polish prefix');
    }

    testEmptyPersonalPolish() {
        const prompt = this.generatePrompt('CASUAL', 'SPANISH', '');
        
        assert(!prompt.includes('Additionally, follow'), 'Should not include personal polish section when empty');
        assertContains(prompt, 'casual', 'Should contain casual instruction');
        assertContains(prompt, 'Spanish', 'Should contain Spanish instruction');
    }

    testAllStylePrompts() {
        const styles = Object.keys(this.config.AVAILABLE_STYLES);
        
        for (const style of styles) {
            const prompt = this.generatePrompt(style, 'ENGLISH');
            
            assert(prompt.length > 0, `Prompt for style ${style} should not be empty`);
            assertContains(prompt, 'Only return the improved text', `Prompt for ${style} should contain return instruction`);
        }
    }

    testAllLanguagePrompts() {
        const languages = Object.keys(this.config.SUPPORTED_LANGUAGES);
        
        for (const language of languages) {
            const prompt = this.generatePrompt('PROFESSIONAL', language);
            
            assert(prompt.length > 0, `Prompt for language ${language} should not be empty`);
            assertContains(prompt, 'Only return the improved text', `Prompt for ${language} should contain return instruction`);
        }
    }

    testInvalidStyleFallback() {
        const prompt = this.generatePrompt('INVALID_STYLE', 'ENGLISH');
        
        // Should fallback to CASUAL (default in our logic)
        assertContains(prompt, 'casual', 'Invalid style should fallback to casual');
    }

    testInvalidLanguageFallback() {
        const prompt = this.generatePrompt('PROFESSIONAL', 'INVALID_LANGUAGE');
        
        // Should fallback to ENGLISH (default in our logic)
        assertContains(prompt, 'English', 'Invalid language should fallback to English');
    }

    testSpecialCharactersInPersonalPolish() {
        const personalPolish = 'Use emojis 😊 and special chars: @#$%^&*()';
        const prompt = this.generatePrompt('CASUAL', 'ENGLISH', personalPolish);
        
        assertContains(prompt, personalPolish, 'Should handle special characters in personal polish');
    }

    testLongPersonalPolish() {
        const longPersonalPolish = 'A'.repeat(500) + ' Use this very long instruction';
        const prompt = this.generatePrompt('PROFESSIONAL', 'ENGLISH', longPersonalPolish);
        
        assertContains(prompt, longPersonalPolish, 'Should handle long personal polish instructions');
    }

    testMultilinePersonalPolish() {
        const multilinePersonalPolish = 'Line 1: Use formal tone\nLine 2: Avoid contractions\nLine 3: Be concise';
        const prompt = this.generatePrompt('PROFESSIONAL', 'ENGLISH', multilinePersonalPolish);
        
        assertContains(prompt, multilinePersonalPolish, 'Should handle multiline personal polish');
    }

    testPromptStructure() {
        const prompt = this.generatePrompt('PROFESSIONAL', 'SPANISH', 'Be friendly');

        // Check that prompt contains the expected components
        assertContains(prompt, 'professional', 'Should contain style instruction');
        assertContains(prompt, 'Spanish', 'Should contain language instruction');
        assertContains(prompt, 'Be friendly', 'Should contain personal polish');
        assertContains(prompt, 'Only return the improved text', 'Should contain return instruction');

        // Check that it ends with the return instruction
        assert(prompt.endsWith('Only return the improved text, nothing else.'), 'Should end with return instruction');
    }

    testTranslateOnlyStyle() {
        // Test if TRANSLATE style exists and works
        const styles = Object.keys(this.config.AVAILABLE_STYLES);
        if (styles.includes('TRANSLATE')) {
            const prompt = this.generatePrompt('TRANSLATE', 'FRENCH');
            assertContains(prompt, 'French', 'Translate style should include target language');
        }
    }

    runAllTests() {
        console.log('🚀 Starting Prompt Generation Tests\n');
        
        this.runTest('Basic prompt generation', () => this.testBasicPromptGeneration());
        this.runTest('Personal polish integration', () => this.testPersonalPolishIntegration());
        this.runTest('Empty personal polish', () => this.testEmptyPersonalPolish());
        this.runTest('All style prompts', () => this.testAllStylePrompts());
        this.runTest('All language prompts', () => this.testAllLanguagePrompts());
        this.runTest('Invalid style fallback', () => this.testInvalidStyleFallback());
        this.runTest('Invalid language fallback', () => this.testInvalidLanguageFallback());
        this.runTest('Special characters in personal polish', () => this.testSpecialCharactersInPersonalPolish());
        this.runTest('Long personal polish', () => this.testLongPersonalPolish());
        this.runTest('Multiline personal polish', () => this.testMultilinePersonalPolish());
        this.runTest('Prompt structure', () => this.testPromptStructure());
        this.runTest('Translate only style', () => this.testTranslateOnlyStyle());
        
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
    const tests = new PromptGenerationTests();
    tests.runAllTests();
}

module.exports = PromptGenerationTests;
