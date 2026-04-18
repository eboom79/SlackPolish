/**
 * Unit Tests for Tone Polish Human Voice Guardrails
 *
 * Tests that the TONE_POLISH prompt preserves the writer voice and avoids
 * polished AI-sounding language.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../../slack-config.js');
const configContent = fs.readFileSync(configPath, 'utf8');

const tonePolishMatch = configContent.match(/TONE_POLISH:\s*'([^']+)'/);

if (!tonePolishMatch) {
    console.error('❌ Could not find TONE_POLISH prompt in config file');
    process.exit(1);
}

const tonePolishPrompt = tonePolishMatch[1];

const tests = [
    {
        name: 'TONE_POLISH prompt exists',
        test: () => {
            assert.ok(tonePolishPrompt, 'TONE_POLISH prompt should exist');
            assert.ok(tonePolishPrompt.length > 0, 'TONE_POLISH prompt should not be empty');
        }
    },
    {
        name: 'Preserves tone and message length',
        test: () => {
            assert.ok(
                tonePolishPrompt.toLowerCase().includes('tone') &&
                tonePolishPrompt.toLowerCase().includes('message length'),
                'Prompt should preserve tone and message length'
            );
        }
    },
    {
        name: 'Requires minimal edits',
        test: () => {
            assert.ok(
                tonePolishPrompt.toLowerCase().includes('smallest edits') ||
                tonePolishPrompt.toLowerCase().includes('stay very close'),
                'Prompt should instruct the model to keep edits minimal'
            );
        }
    },
    {
        name: 'Keeps the writer voice',
        test: () => {
            assert.ok(
                tonePolishPrompt.toLowerCase().includes('specific to the writer') ||
                tonePolishPrompt.toLowerCase().includes('writer voice'),
                'Prompt should preserve the writer voice'
            );
        }
    },
    {
        name: 'Blocks polished AI phrasing',
        test: () => {
            assert.ok(
                tonePolishPrompt.toLowerCase().includes('polished ai phrasing'),
                'Prompt should explicitly block polished AI phrasing'
            );
        }
    },
    {
        name: 'Avoids corporate or overly polished language',
        test: () => {
            assert.ok(
                tonePolishPrompt.toLowerCase().includes('corporate speak') &&
                tonePolishPrompt.toLowerCase().includes('overly polished'),
                'Prompt should avoid corporate speak and overly polished language'
            );
        }
    },
    {
        name: 'Preserves line structure',
        test: () => {
            assert.ok(
                tonePolishPrompt.toLowerCase().includes('empty lines') ||
                tonePolishPrompt.toLowerCase().includes('line breaks'),
                'Prompt should mention preserving line structure'
            );
        }
    },
    {
        name: 'Includes strict output instruction',
        test: () => {
            assert.ok(
                tonePolishPrompt.includes('Return ONLY the improved text'),
                'Prompt should include strict output instructions'
            );
        }
    }
];

console.log('🧪 Running Tone Polish Human Voice Tests...\n');
console.log('📝 Current TONE_POLISH Prompt:');
console.log(`"${tonePolishPrompt}"\n`);

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
    try {
        test.test();
        console.log(`✅ Test ${index + 1}: ${test.name}`);
        passed++;
    } catch (error) {
        console.log(`❌ Test ${index + 1}: ${test.name}`);
        console.log(`   Error: ${error.message}\n`);
        failed++;
    }
});

console.log('\n' + '='.repeat(50));
console.log(`📊 Test Results: ${passed} passed, ${failed} failed out of ${tests.length} total`);
console.log('='.repeat(50));

if (failed === 0) {
    console.log('✅ All tests passed!');
    console.log('\n💡 The TONE_POLISH style now focuses on keeping the original');
    console.log('   human voice instead of making messages sound overly polished.');
    process.exit(0);
} else {
    console.log('❌ Some tests failed!');
    process.exit(1);
}
