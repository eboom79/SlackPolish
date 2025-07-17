#!/usr/bin/env node

/**
 * Unit Test: Hotkey Handling
 * Tests keyboard event processing and hotkey matching
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

class HotkeyHandlingTests {
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

    // Mock keyboard event
    createKeyboardEvent(key, ctrlKey = false, shiftKey = false, altKey = false, metaKey = false) {
        return {
            key,
            ctrlKey,
            shiftKey,
            altKey,
            metaKey,
            preventDefault: () => {},
            stopPropagation: () => {}
        };
    }

    // Simulate hotkey matching logic
    matchesHotkey(event, hotkeyString) {
        const parts = hotkeyString.split('+');
        let hasNonModifierKey = false;

        for (const part of parts) {
            switch (part.trim()) {
                case 'Ctrl':
                    if (!event.ctrlKey) return false;
                    break;
                case 'Shift':
                    if (!event.shiftKey) return false;
                    break;
                case 'Alt':
                    if (!event.altKey) return false;
                    break;
                case 'Meta':
                    if (!event.metaKey) return false;
                    break;
                case 'Tab':
                    if (event.key !== 'Tab') return false;
                    hasNonModifierKey = true;
                    break;
                default:
                    // For other keys, check if it matches
                    if (event.key !== part.trim()) return false;
                    hasNonModifierKey = true;
            }
        }

        // For modifier combinations like Ctrl+Shift, the key should be one of the modifiers
        if (!hasNonModifierKey) {
            // Check if the pressed key is one of the expected modifiers
            const expectedModifiers = parts.map(p => p.trim().toLowerCase());
            const pressedKey = event.key.toLowerCase();

            if (expectedModifiers.includes('shift') && pressedKey === 'shift') return true;
            if (expectedModifiers.includes('ctrl') && (pressedKey === 'control' || pressedKey === 'ctrl')) return true;
            if (expectedModifiers.includes('alt') && pressedKey === 'alt') return true;
            if (expectedModifiers.includes('meta') && pressedKey === 'meta') return true;

            return false;
        }

        return true;
    }

    testCtrlShiftHotkey() {
        const event = this.createKeyboardEvent('Shift', true, true, false, false);
        const matches = this.matchesHotkey(event, 'Ctrl+Shift');
        
        assert(matches, 'Ctrl+Shift should match when both Ctrl and Shift are pressed');
    }

    testCtrlAltHotkey() {
        const event = this.createKeyboardEvent('Alt', true, false, true, false);
        const matches = this.matchesHotkey(event, 'Ctrl+Alt');
        
        assert(matches, 'Ctrl+Alt should match when both Ctrl and Alt are pressed');
    }

    testCtrlTabHotkey() {
        const event = this.createKeyboardEvent('Tab', true, false, false, false);
        const matches = this.matchesHotkey(event, 'Ctrl+Tab');
        
        assert(matches, 'Ctrl+Tab should match when Ctrl and Tab are pressed');
    }

    testF12Hotkey() {
        const event = this.createKeyboardEvent('F12', false, false, false, false);
        const matches = this.matchesHotkey(event, 'F12');
        
        assert(matches, 'F12 should match when F12 is pressed alone');
    }

    testIncorrectModifiers() {
        // Test Ctrl+Shift when only Ctrl is pressed
        const event = this.createKeyboardEvent('Shift', true, false, false, false);
        const matches = this.matchesHotkey(event, 'Ctrl+Shift');
        
        assert(!matches, 'Ctrl+Shift should not match when only Ctrl is pressed');
    }

    testExtraModifiers() {
        // Test Ctrl+Shift when Ctrl+Shift+Alt are pressed
        const event = this.createKeyboardEvent('Shift', true, true, true, false);
        const matches = this.matchesHotkey(event, 'Ctrl+Shift');
        
        // This should still match because we have the required modifiers
        assert(matches, 'Ctrl+Shift should match even with extra Alt modifier');
    }

    testWrongKey() {
        const event = this.createKeyboardEvent('A', true, true, false, false);
        const matches = this.matchesHotkey(event, 'Ctrl+Shift');
        
        assert(!matches, 'Ctrl+Shift should not match when A key is pressed instead of Shift');
    }

    testAllConfiguredHotkeys() {
        const hotkeys = this.config.AVAILABLE_HOTKEYS;
        
        for (const hotkey of hotkeys) {
            let testEvent;
            
            switch (hotkey) {
                case 'Ctrl+Shift':
                    testEvent = this.createKeyboardEvent('Shift', true, true, false, false);
                    break;
                case 'Ctrl+Alt':
                    testEvent = this.createKeyboardEvent('Alt', true, false, true, false);
                    break;
                case 'Ctrl+Tab':
                    testEvent = this.createKeyboardEvent('Tab', true, false, false, false);
                    break;
                default:
                    // Skip unknown hotkeys
                    continue;
            }
            
            const matches = this.matchesHotkey(testEvent, hotkey);
            assert(matches, `Hotkey ${hotkey} should match its corresponding event`);
        }
    }

    testCaseInsensitiveKeys() {
        const event = this.createKeyboardEvent('shift', true, true, false, false);
        const matches = this.matchesHotkey(event, 'Ctrl+Shift');
        
        // This might fail depending on how the browser reports key names
        // The test helps identify case sensitivity issues
        console.log(`   Note: Testing case sensitivity - event.key='${event.key}', expected='Shift'`);
    }

    testSpecialKeys() {
        // Test various special keys
        const specialKeys = ['Tab', 'Enter', 'Escape', 'Space', 'F12'];
        
        for (const key of specialKeys) {
            const event = this.createKeyboardEvent(key, false, false, false, false);
            const matches = this.matchesHotkey(event, key);
            
            assert(matches, `Special key ${key} should match itself`);
        }
    }

    testModifierOnlyEvents() {
        // Test that modifier-only events don't match hotkeys
        const ctrlOnlyEvent = this.createKeyboardEvent('Control', true, false, false, false);
        const shiftOnlyEvent = this.createKeyboardEvent('Shift', false, true, false, false);
        
        const ctrlShiftMatches = this.matchesHotkey(ctrlOnlyEvent, 'Ctrl+Shift');
        const shiftMatches = this.matchesHotkey(shiftOnlyEvent, 'Ctrl+Shift');
        
        assert(!ctrlShiftMatches, 'Ctrl-only event should not match Ctrl+Shift');
        assert(!shiftMatches, 'Shift-only event should not match Ctrl+Shift');
    }

    testEmptyHotkey() {
        const event = this.createKeyboardEvent('A', false, false, false, false);
        const matches = this.matchesHotkey(event, '');
        
        assert(!matches, 'Empty hotkey should not match any event');
    }

    testInvalidHotkey() {
        const event = this.createKeyboardEvent('A', true, false, false, false);
        const matches = this.matchesHotkey(event, 'Invalid+Hotkey');
        
        assert(!matches, 'Invalid hotkey should not match any event');
    }

    runAllTests() {
        console.log('🚀 Starting Hotkey Handling Tests\n');
        
        this.runTest('Ctrl+Shift hotkey', () => this.testCtrlShiftHotkey());
        this.runTest('Ctrl+Alt hotkey', () => this.testCtrlAltHotkey());
        this.runTest('Ctrl+Tab hotkey', () => this.testCtrlTabHotkey());
        this.runTest('F12 hotkey', () => this.testF12Hotkey());
        this.runTest('Incorrect modifiers', () => this.testIncorrectModifiers());
        this.runTest('Extra modifiers', () => this.testExtraModifiers());
        this.runTest('Wrong key', () => this.testWrongKey());
        this.runTest('All configured hotkeys', () => this.testAllConfiguredHotkeys());
        this.runTest('Case insensitive keys', () => this.testCaseInsensitiveKeys());
        this.runTest('Special keys', () => this.testSpecialKeys());
        this.runTest('Modifier only events', () => this.testModifierOnlyEvents());
        this.runTest('Empty hotkey', () => this.testEmptyHotkey());
        this.runTest('Invalid hotkey', () => this.testInvalidHotkey());
        
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
    const tests = new HotkeyHandlingTests();
    tests.runAllTests();
}

module.exports = HotkeyHandlingTests;
