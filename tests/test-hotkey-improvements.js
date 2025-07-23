// Test script for hotkey system improvements
// This script tests the new debouncing, rate limiting, and enhanced logging features

console.log('🧪 Starting Hotkey System Improvements Test...');

// Test 1: Verify debounced settings updates
function testDebouncedSettingsUpdates() {
    console.log('\n📋 Test 1: Debounced Settings Updates');
    
    // Simulate rapid settings changes
    const originalHotkey = window.SLACKPOLISH_CONFIG?.HOTKEY || 'Ctrl+Shift';
    
    // Fire multiple storage events rapidly
    console.log('🔥 Firing multiple rapid storage events...');
    
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            const event = new StorageEvent('storage', {
                key: 'slackpolish_settings',
                newValue: JSON.stringify({
                    improveHotkey: i % 2 === 0 ? 'Ctrl+Shift' : 'Ctrl+Alt',
                    language: 'English',
                    style: 'professional'
                })
            });
            window.dispatchEvent(event);
            console.log(`📤 Storage event ${i + 1} fired`);
        }, i * 10); // Fire every 10ms
    }
    
    // Also fire custom event
    setTimeout(() => {
        const customEvent = new CustomEvent('slackpolish-settings-updated');
        window.dispatchEvent(customEvent);
        console.log('📤 Custom settings event fired');
    }, 25);
    
    console.log('✅ Multiple events fired - check logs for debouncing behavior');
}

// Test 2: Verify rate limiting
function testRateLimiting() {
    console.log('\n⏱️ Test 2: Rate Limiting');
    
    // Simulate rapid hotkey presses
    console.log('🔥 Simulating rapid Ctrl+Shift presses...');
    
    const keydownEvents = [
        { key: 'Control', ctrlKey: true },
        { key: 'Shift', ctrlKey: true, shiftKey: true }
    ];
    
    const keyupEvents = [
        { key: 'Control', ctrlKey: false, shiftKey: true },
        { key: 'Shift', ctrlKey: false, shiftKey: false }
    ];
    
    // Fire multiple rapid keydown sequences
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            console.log(`🎹 Hotkey sequence ${i + 1} starting...`);
            
            // Press Ctrl
            document.dispatchEvent(new KeyboardEvent('keydown', keydownEvents[0]));
            
            // Press Shift (should trigger hotkey)
            setTimeout(() => {
                document.dispatchEvent(new KeyboardEvent('keydown', keydownEvents[1]));
            }, 10);
            
            // Release keys
            setTimeout(() => {
                document.dispatchEvent(new KeyboardEvent('keyup', keyupEvents[0]));
                document.dispatchEvent(new KeyboardEvent('keyup', keyupEvents[1]));
            }, 50);
            
        }, i * 100); // Fire every 100ms (faster than 500ms rate limit)
    }
    
    console.log('✅ Rapid hotkey sequences fired - check logs for rate limiting');
}

// Test 3: Verify enhanced logging
function testEnhancedLogging() {
    console.log('\n📝 Test 3: Enhanced Logging');
    
    // Enable debug mode to see all logs
    if (window.SlackPolishDebug) {
        window.SlackPolishDebug.setEnabled(true);
        console.log('🐛 Debug mode enabled');
    }
    
    // Trigger a settings change to see enhanced logging
    console.log('🔧 Triggering settings change with enhanced logging...');
    
    const settingsEvent = new StorageEvent('storage', {
        key: 'slackpolish_settings',
        newValue: JSON.stringify({
            improveHotkey: 'Ctrl+Alt',
            language: 'Spanish',
            style: 'casual',
            debugMode: true
        })
    });
    
    window.dispatchEvent(settingsEvent);
    console.log('✅ Settings change fired - check debug logs for detailed information');
}

// Test 4: Verify setup ID tracking
function testSetupIdTracking() {
    console.log('\n🆔 Test 4: Setup ID Tracking');
    
    // Force multiple setupEventListeners calls
    console.log('🔄 Forcing multiple event listener setups...');
    
    // Change hotkey multiple times
    const hotkeys = ['Ctrl+Shift', 'Ctrl+Alt', 'Ctrl+Tab'];
    
    hotkeys.forEach((hotkey, index) => {
        setTimeout(() => {
            console.log(`🎯 Setting hotkey to: ${hotkey}`);
            
            const event = new StorageEvent('storage', {
                key: 'slackpolish_settings',
                newValue: JSON.stringify({
                    improveHotkey: hotkey,
                    language: 'English',
                    style: 'professional'
                })
            });
            
            window.dispatchEvent(event);
        }, index * 200);
    });
    
    console.log('✅ Multiple hotkey changes fired - check logs for unique setup IDs');
}

// Test 5: Verify error handling
function testErrorHandling() {
    console.log('\n🚨 Test 5: Error Handling');
    
    // Test with invalid settings
    console.log('💥 Testing with invalid settings...');
    
    const invalidEvent = new StorageEvent('storage', {
        key: 'slackpolish_settings',
        newValue: 'invalid json{'
    });
    
    window.dispatchEvent(invalidEvent);
    
    // Test with null values
    setTimeout(() => {
        const nullEvent = new StorageEvent('storage', {
            key: 'slackpolish_settings',
            newValue: null
        });
        
        window.dispatchEvent(nullEvent);
    }, 100);
    
    console.log('✅ Invalid settings fired - check logs for error handling');
}

// Test 6: Memory leak prevention
function testMemoryLeakPrevention() {
    console.log('\n🧠 Test 6: Memory Leak Prevention');
    
    console.log('🔄 Testing event listener cleanup...');
    
    // Force multiple rapid re-registrations
    for (let i = 0; i < 10; i++) {
        setTimeout(() => {
            const event = new StorageEvent('storage', {
                key: 'slackpolish_settings',
                newValue: JSON.stringify({
                    improveHotkey: i % 2 === 0 ? 'Ctrl+Shift' : 'Ctrl+Alt',
                    language: 'English',
                    style: 'professional'
                })
            });
            
            window.dispatchEvent(event);
        }, i * 50);
    }
    
    console.log('✅ Rapid re-registrations fired - check logs for cleanup behavior');
}

// Run all tests
function runAllTests() {
    console.log('🚀 Running all hotkey improvement tests...\n');
    
    testDebouncedSettingsUpdates();
    
    setTimeout(() => testRateLimiting(), 1000);
    setTimeout(() => testEnhancedLogging(), 2000);
    setTimeout(() => testSetupIdTracking(), 3000);
    setTimeout(() => testErrorHandling(), 4000);
    setTimeout(() => testMemoryLeakPrevention(), 5000);
    
    setTimeout(() => {
        console.log('\n🎉 All tests completed!');
        console.log('📊 Check the browser console and debug window for detailed results');
        console.log('🔍 Look for:');
        console.log('  - Debouncing messages (should see cancelled updates)');
        console.log('  - Rate limiting messages (should see blocked triggers)');
        console.log('  - Setup IDs (should be unique for each setup)');
        console.log('  - Enhanced error handling (should handle invalid data gracefully)');
        console.log('  - Memory cleanup (should see listener removal messages)');
    }, 6000);
}

// Export test functions for manual use
window.testHotkeyImprovements = {
    runAll: runAllTests,
    testDebouncing: testDebouncedSettingsUpdates,
    testRateLimit: testRateLimiting,
    testLogging: testEnhancedLogging,
    testSetupIds: testSetupIdTracking,
    testErrorHandling: testErrorHandling,
    testMemoryLeaks: testMemoryLeakPrevention
};

// Auto-run tests if this script is loaded directly
if (typeof window !== 'undefined' && window.location) {
    console.log('🎯 Test functions available at: window.testHotkeyImprovements');
    console.log('📝 Run window.testHotkeyImprovements.runAll() to start all tests');
    console.log('🔧 Or run individual tests like window.testHotkeyImprovements.testDebouncing()');
}
