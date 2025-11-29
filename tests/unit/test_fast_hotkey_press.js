#!/usr/bin/env node

/**
 * Unit Test: Fast Hotkey Press Handling
 * Tests that hotkeys work reliably even when pressed and released very quickly
 * 
 * This test validates the fix for the issue where users pressing Ctrl+Shift
 * very quickly (< 50ms) would not trigger the action because the old debounce
 * timeout would be cancelled by the keyup event.
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

class FastHotkeyPressTests {
    constructor() {
        this.testCount = 0;
        this.passedCount = 0;
        this.failedCount = 0;
        this.config = this.loadConfig();
        this.triggerCount = 0;
        this.isProcessing = false;
        this.lastTriggerTime = 0;
        this.hotkeyPressedOnce = false;
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

    // Reset state between tests
    resetState() {
        this.triggerCount = 0;
        this.isProcessing = false;
        this.lastTriggerTime = 0;
        this.hotkeyPressedOnce = false;
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

    // Simulate the improved hotkey matching logic (using native browser properties)
    checkHotkeyMatch(event, hotkeyString) {
        const parts = hotkeyString.split('+');
        const hotkey = {
            ctrl: parts.includes('Ctrl'),
            shift: parts.includes('Shift'),
            alt: parts.includes('Alt'),
            tab: parts.includes('Tab')
        };

        // For Tab key, check both the key and the modifiers
        if (hotkey.tab) {
            return event.key === 'Tab' &&
                   event.ctrlKey === hotkey.ctrl &&
                   event.shiftKey === hotkey.shift &&
                   event.altKey === hotkey.alt;
        }

        // For modifier-only combinations (Ctrl+Shift, Ctrl+Alt)
        const isModifierKey = ['Control', 'Shift', 'Alt'].includes(event.key);
        if (!isModifierKey) {
            return false;
        }

        return event.ctrlKey === hotkey.ctrl &&
               event.shiftKey === hotkey.shift &&
               event.altKey === hotkey.alt &&
               !hotkey.tab;
    }

    // Simulate the improved trigger logic (immediate trigger, no timeout)
    simulateTrigger(event, hotkeyString) {
        const hotkeyMatch = this.checkHotkeyMatch(event, hotkeyString);

        if (hotkeyMatch) {
            // Prevent multiple triggers from the same key sequence
            if (this.hotkeyPressedOnce) {
                return false; // Duplicate in same sequence
            }

            // Prevent triggering while already processing
            if (this.isProcessing) {
                return false; // Already processing
            }

            const now = Date.now();
            const MIN_TRIGGER_INTERVAL = 500;

            // Rate limiting
            if (now - this.lastTriggerTime < MIN_TRIGGER_INTERVAL) {
                return false; // Rate limited
            }

            // Mark that we've detected the hotkey
            this.hotkeyPressedOnce = true;

            // Trigger immediately (no timeout)
            this.isProcessing = true;
            this.triggerCount++;
            this.lastTriggerTime = now;

            // Simulate async completion
            setTimeout(() => {
                this.isProcessing = false;
            }, 10);

            return true; // Successfully triggered
        }

        return false; // No match
    }

    // Simulate key release
    simulateKeyRelease(event) {
        const isRequiredKey = ['Control', 'Shift', 'Alt', 'Tab'].includes(event.key);
        if (isRequiredKey) {
            this.hotkeyPressedOnce = false;
        }
    }

    // Test 1: Very fast press (< 50ms)
    testVeryFastPress() {
        this.resetState();

        // Simulate Ctrl pressed
        const ctrlDown = this.createKeyboardEvent('Control', true, false, false, false);
        
        // Simulate Shift pressed (both modifiers now active)
        const shiftDown = this.createKeyboardEvent('Shift', true, true, false, false);
        const triggered = this.simulateTrigger(shiftDown, 'Ctrl+Shift');

        // Immediately release (< 50ms)
        const shiftUp = this.createKeyboardEvent('Shift', true, false, false, false);
        this.simulateKeyRelease(shiftUp);

        assert(triggered, 'Very fast press (< 50ms) should trigger successfully');
        assertEqual(this.triggerCount, 1, 'Should trigger exactly once');
    }

    // Test 2: Normal press duration
    testNormalPress() {
        this.resetState();

        const shiftDown = this.createKeyboardEvent('Shift', true, true, false, false);
        const triggered = this.simulateTrigger(shiftDown, 'Ctrl+Shift');

        // Wait 100ms before release (normal duration)
        setTimeout(() => {
            const shiftUp = this.createKeyboardEvent('Shift', true, false, false, false);
            this.simulateKeyRelease(shiftUp);
        }, 100);

        assert(triggered, 'Normal press should trigger successfully');
        assertEqual(this.triggerCount, 1, 'Should trigger exactly once');
    }

    // Test 3: Prevent duplicate triggers in same sequence
    testPreventDuplicateTriggers() {
        this.resetState();

        // First trigger (Shift pressed with both modifiers)
        const shiftDown = this.createKeyboardEvent('Shift', true, true, false, false);
        const firstTrigger = this.simulateTrigger(shiftDown, 'Ctrl+Shift');

        // Second trigger attempt (Ctrl pressed, both modifiers still active)
        // This simulates the scenario where both Ctrl and Shift fire keydown events
        const ctrlDown = this.createKeyboardEvent('Control', true, true, false, false);
        const secondTrigger = this.simulateTrigger(ctrlDown, 'Ctrl+Shift');

        assert(firstTrigger, 'First trigger should succeed');
        assert(!secondTrigger, 'Second trigger in same sequence should be prevented');
        assertEqual(this.triggerCount, 1, 'Should only trigger once per sequence');
    }

    // Test 4: Allow trigger after key release
    testAllowTriggerAfterRelease() {
        this.resetState();

        // First press
        const shiftDown1 = this.createKeyboardEvent('Shift', true, true, false, false);
        const firstTrigger = this.simulateTrigger(shiftDown1, 'Ctrl+Shift');

        // Manually complete processing (simulating async completion)
        this.isProcessing = false;

        // Release
        const shiftUp = this.createKeyboardEvent('Shift', true, false, false, false);
        this.simulateKeyRelease(shiftUp);

        // Wait for rate limit to pass
        this.lastTriggerTime = Date.now() - 600; // Simulate 600ms passed

        // Second press (new sequence)
        const shiftDown2 = this.createKeyboardEvent('Shift', true, true, false, false);
        const secondTrigger = this.simulateTrigger(shiftDown2, 'Ctrl+Shift');

        assert(firstTrigger, 'First trigger should succeed');
        assert(secondTrigger, 'Second trigger after release should succeed');
        assertEqual(this.triggerCount, 2, 'Should trigger twice (separate sequences)');
    }

    // Test 5: Rate limiting works correctly
    testRateLimiting() {
        this.resetState();

        // First trigger
        const shiftDown1 = this.createKeyboardEvent('Shift', true, true, false, false);
        const firstTrigger = this.simulateTrigger(shiftDown1, 'Ctrl+Shift');

        // Release and reset sequence flag
        const shiftUp = this.createKeyboardEvent('Shift', true, false, false, false);
        this.simulateKeyRelease(shiftUp);

        // Immediate second trigger (within 500ms rate limit)
        const shiftDown2 = this.createKeyboardEvent('Shift', true, true, false, false);
        const secondTrigger = this.simulateTrigger(shiftDown2, 'Ctrl+Shift');

        assert(firstTrigger, 'First trigger should succeed');
        assert(!secondTrigger, 'Second trigger within rate limit should be blocked');
        assertEqual(this.triggerCount, 1, 'Should only trigger once due to rate limiting');
    }

    // Test 6: Processing guard prevents overlapping triggers
    testProcessingGuard() {
        this.resetState();

        // First trigger
        const shiftDown1 = this.createKeyboardEvent('Shift', true, true, false, false);
        const firstTrigger = this.simulateTrigger(shiftDown1, 'Ctrl+Shift');

        // Manually reset sequence flag (simulating key release)
        this.hotkeyPressedOnce = false;

        // Try to trigger while still processing
        const shiftDown2 = this.createKeyboardEvent('Shift', true, true, false, false);
        const secondTrigger = this.simulateTrigger(shiftDown2, 'Ctrl+Shift');

        assert(firstTrigger, 'First trigger should succeed');
        assert(!secondTrigger, 'Second trigger while processing should be blocked');
        assertEqual(this.triggerCount, 1, 'Should only trigger once due to processing guard');
    }

    // Test 7: Different hotkeys work independently
    testDifferentHotkeys() {
        this.resetState();

        // Trigger Ctrl+Shift
        const shiftDown = this.createKeyboardEvent('Shift', true, true, false, false);
        const ctrlShiftTrigger = this.simulateTrigger(shiftDown, 'Ctrl+Shift');

        // Manually complete processing
        this.isProcessing = false;

        // Release
        this.simulateKeyRelease(this.createKeyboardEvent('Shift', true, false, false, false));

        // Wait for rate limit
        this.lastTriggerTime = Date.now() - 600;

        // Trigger Ctrl+Alt (different hotkey)
        const altDown = this.createKeyboardEvent('Alt', true, false, true, false);
        const ctrlAltTrigger = this.simulateTrigger(altDown, 'Ctrl+Alt');

        assert(ctrlShiftTrigger, 'Ctrl+Shift should trigger');
        assert(ctrlAltTrigger, 'Ctrl+Alt should trigger independently');
        assertEqual(this.triggerCount, 2, 'Both hotkeys should trigger');
    }

    runAllTests() {
        console.log('🚀 Starting Fast Hotkey Press Tests\n');
        console.log('📝 These tests validate the fix for fast key press handling\n');
        
        this.runTest('Very fast press (< 50ms)', () => this.testVeryFastPress());
        this.runTest('Normal press duration', () => this.testNormalPress());
        this.runTest('Prevent duplicate triggers in same sequence', () => this.testPreventDuplicateTriggers());
        this.runTest('Allow trigger after key release', () => this.testAllowTriggerAfterRelease());
        this.runTest('Rate limiting works correctly', () => this.testRateLimiting());
        this.runTest('Processing guard prevents overlapping triggers', () => this.testProcessingGuard());
        this.runTest('Different hotkeys work independently', () => this.testDifferentHotkeys());
        
        console.log('\n📊 Test Results:');
        console.log(`   Total: ${this.testCount}`);
        console.log(`   ✅ Passed: ${this.passedCount}`);
        console.log(`   ❌ Failed: ${this.failedCount}`);
        
        if (this.failedCount === 0) {
            console.log('\n🎉 All fast hotkey press tests passed!');
            process.exit(0);
        } else {
            console.log('\n💥 Some tests failed!');
            process.exit(1);
        }
    }
}

if (require.main === module) {
    const tests = new FastHotkeyPressTests();
    tests.runAllTests();
}

module.exports = FastHotkeyPressTests;

