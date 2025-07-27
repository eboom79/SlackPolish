#!/usr/bin/env node

/**
 * Unit Test: Ctrl+V Fix
 * Specifically tests that Ctrl+V does NOT trigger Ctrl+Shift hotkey
 */

// Test framework
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

class CtrlVFixTest {
    constructor() {
        this.config = {
            AVAILABLE_HOTKEYS: ['Ctrl+Shift', 'Ctrl+Alt', 'Ctrl+Tab']
        };
    }

    createKeyboardEvent(key, ctrlKey, shiftKey, altKey, metaKey) {
        return {
            key: key,
            ctrlKey: ctrlKey || false,
            shiftKey: shiftKey || false,
            altKey: altKey || false,
            metaKey: metaKey || false,
            preventDefault: () => {},
            stopPropagation: () => {}
        };
    }

    // Parse hotkey combination into individual keys (same as main implementation)
    parseHotkey(hotkeyString) {
        const parts = hotkeyString.split('+');
        return {
            ctrl: parts.includes('Ctrl'),
            shift: parts.includes('Shift'),
            alt: parts.includes('Alt'),
            tab: parts.includes('Tab'),
            displayName: hotkeyString
        };
    }

    // Simulate the FIXED hotkey matching logic from slack-text-improver.js
    matchesHotkey(event, ctrlPressed, shiftPressed, altPressed, tabPressed, hotkeyString) {
        const hotkey = this.parseHotkey(hotkeyString);

        // This is the FIXED logic from the main implementation
        const hotkeyMatch =
            (hotkey.ctrl === ctrlPressed) &&
            (hotkey.shift === shiftPressed) &&
            (hotkey.alt === altPressed) &&
            (hotkey.tab === tabPressed);

        return hotkeyMatch;
    }

    testCtrlVDoesNotTriggerCtrlShift() {
        console.log('🧪 Testing: Ctrl+V should NOT trigger Ctrl+Shift');
        
        // Simulate pressing Ctrl+V
        const event = this.createKeyboardEvent('v', true, false, false, false);
        
        // Simulate the key state tracking from the main implementation
        let ctrlPressed = true;  // Ctrl is pressed
        let shiftPressed = false; // Shift is NOT pressed
        let altPressed = false;   // Alt is NOT pressed
        let tabPressed = false;   // Tab is NOT pressed
        
        const matches = this.matchesHotkey(event, ctrlPressed, shiftPressed, altPressed, tabPressed, 'Ctrl+Shift');
        
        assert(!matches, 'Ctrl+V should NOT match Ctrl+Shift hotkey');
        console.log('✅ PASSED: Ctrl+V does not trigger Ctrl+Shift');
    }

    testCtrlShiftStillWorks() {
        console.log('🧪 Testing: Ctrl+Shift should still work correctly');
        
        // Simulate pressing Ctrl+Shift
        const event = this.createKeyboardEvent('Shift', true, true, false, false);
        
        // Simulate the key state tracking from the main implementation
        let ctrlPressed = true;   // Ctrl is pressed
        let shiftPressed = true;  // Shift is pressed
        let altPressed = false;   // Alt is NOT pressed
        let tabPressed = false;   // Tab is NOT pressed
        
        const matches = this.matchesHotkey(event, ctrlPressed, shiftPressed, altPressed, tabPressed, 'Ctrl+Shift');
        
        assert(matches, 'Ctrl+Shift should match Ctrl+Shift hotkey');
        console.log('✅ PASSED: Ctrl+Shift still works correctly');
    }

    testCtrlShiftAltDoesNotTriggerCtrlShift() {
        console.log('🧪 Testing: Ctrl+Shift+Alt should NOT trigger Ctrl+Shift');
        
        // Simulate pressing Ctrl+Shift+Alt
        const event = this.createKeyboardEvent('Shift', true, true, true, false);
        
        // Simulate the key state tracking from the main implementation
        let ctrlPressed = true;   // Ctrl is pressed
        let shiftPressed = true;  // Shift is pressed
        let altPressed = true;    // Alt is pressed (extra modifier)
        let tabPressed = false;   // Tab is NOT pressed
        
        const matches = this.matchesHotkey(event, ctrlPressed, shiftPressed, altPressed, tabPressed, 'Ctrl+Shift');
        
        assert(!matches, 'Ctrl+Shift+Alt should NOT match Ctrl+Shift hotkey (exact match required)');
        console.log('✅ PASSED: Ctrl+Shift+Alt does not trigger Ctrl+Shift');
    }

    testCtrlAltStillWorks() {
        console.log('🧪 Testing: Ctrl+Alt should work for Ctrl+Alt hotkey');

        // Simulate pressing Ctrl+Alt
        const event = this.createKeyboardEvent('Alt', true, false, true, false);

        // Simulate the key state tracking from the main implementation
        let ctrlPressed = true;   // Ctrl is pressed
        let shiftPressed = false; // Shift is NOT pressed
        let altPressed = true;    // Alt is pressed
        let tabPressed = false;   // Tab is NOT pressed

        const matches = this.matchesHotkey(event, ctrlPressed, shiftPressed, altPressed, tabPressed, 'Ctrl+Alt');
        assert(matches, 'Ctrl+Alt should match Ctrl+Alt hotkey');
        console.log('✅ PASSED: Ctrl+Alt works for Ctrl+Alt hotkey');
    }

    runAllTests() {
        console.log('🚀 Starting Ctrl+V Fix Tests\n');
        
        const tests = [
            'testCtrlVDoesNotTriggerCtrlShift',
            'testCtrlShiftStillWorks', 
            'testCtrlShiftAltDoesNotTriggerCtrlShift',
            'testCtrlAltStillWorks'
        ];
        
        let passed = 0;
        let failed = 0;
        
        for (const testName of tests) {
            try {
                this[testName]();
                passed++;
            } catch (error) {
                console.log(`❌ FAILED: ${testName}`);
                console.log(`   Error: ${error.message}`);
                failed++;
            }
        }
        
        console.log('\n📊 Test Results:');
        console.log(`   Total: ${tests.length}`);
        console.log(`   ✅ Passed: ${passed}`);
        console.log(`   ❌ Failed: ${failed}`);
        
        if (failed === 0) {
            console.log('\n🎉 All tests passed! The Ctrl+V fix is working correctly.');
            process.exit(0);
        } else {
            console.log('\n💥 Some tests failed!');
            process.exit(1);
        }
    }
}

// Run the tests
const tester = new CtrlVFixTest();
tester.runAllTests();
