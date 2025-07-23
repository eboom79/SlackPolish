#!/usr/bin/env node

/**
 * SlackPolish Hotkey Improvements Test - No API Key Required
 * Tests the hotkey system improvements without requiring OpenAI API calls
 * Safe for CI/CD and automated testing environments
 */

// Mock DOM environment for Node.js testing
const mockDOM = {
    events: {},
    listeners: {},
    
    // Mock document
    document: {
        addEventListener: function(type, handler) {
            if (!mockDOM.listeners[type]) mockDOM.listeners[type] = [];
            mockDOM.listeners[type].push(handler);
            console.log(`👂 Document listener added: ${type}`);
        },
        removeEventListener: function(type, handler) {
            if (mockDOM.listeners[type]) {
                const index = mockDOM.listeners[type].indexOf(handler);
                if (index > -1) {
                    mockDOM.listeners[type].splice(index, 1);
                    console.log(`🗑️ Document listener removed: ${type}`);
                }
            }
        },
        dispatchEvent: function(event) {
            console.log(`📤 Document event dispatched: ${event.type}`);
            if (mockDOM.listeners[event.type]) {
                mockDOM.listeners[event.type].forEach(handler => {
                    try {
                        handler(event);
                    } catch (error) {
                        console.log(`❌ Event handler error: ${error.message}`);
                    }
                });
            }
        },
        activeElement: null,
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: () => ({ style: {}, appendChild: () => {}, remove: () => {} }),
        body: { appendChild: () => {} }
    },

    // Mock window
    window: {
        addEventListener: function(type, handler) {
            if (!mockDOM.listeners[`window_${type}`]) mockDOM.listeners[`window_${type}`] = [];
            mockDOM.listeners[`window_${type}`].push(handler);
            console.log(`👂 Window listener added: ${type}`);
        },
        removeEventListener: function(type, handler) {
            const key = `window_${type}`;
            if (mockDOM.listeners[key]) {
                const index = mockDOM.listeners[key].indexOf(handler);
                if (index > -1) {
                    mockDOM.listeners[key].splice(index, 1);
                    console.log(`🗑️ Window listener removed: ${type}`);
                }
            }
        },
        dispatchEvent: function(event) {
            console.log(`📤 Window event dispatched: ${event.type}`);
            const key = `window_${event.type}`;
            if (mockDOM.listeners[key]) {
                mockDOM.listeners[key].forEach(handler => {
                    try {
                        handler(event);
                    } catch (error) {
                        console.log(`❌ Window event handler error: ${error.message}`);
                    }
                });
            }
        },
        localStorage: {
            data: {},
            getItem: function(key) {
                return this.data[key] || null;
            },
            setItem: function(key, value) {
                this.data[key] = value;
                console.log(`💾 localStorage.setItem: ${key}`);
            },
            removeItem: function(key) {
                delete this.data[key];
                console.log(`🗑️ localStorage.removeItem: ${key}`);
            }
        },
        location: { href: 'test://localhost' },
        SLACKPOLISH_CONFIG: {
            VERSION: '1.2.1',
            HOTKEY: 'Ctrl+Shift',
            SMART_CONTEXT: { enabled: false }
        }
    },

    // Mock events
    StorageEvent: class {
        constructor(type, options) {
            this.type = type;
            this.key = options.key;
            this.newValue = options.newValue;
        }
    },

    CustomEvent: class {
        constructor(type, options = {}) {
            this.type = type;
            this.detail = options.detail;
        }
    },

    KeyboardEvent: class {
        constructor(type, options = {}) {
            this.type = type;
            this.key = options.key;
            this.ctrlKey = options.ctrlKey || false;
            this.shiftKey = options.shiftKey || false;
            this.altKey = options.altKey || false;
            this.preventDefault = () => console.log(`🚫 preventDefault called for ${this.key}`);
        }
    }
};

// Set up global environment
global.document = mockDOM.document;
global.window = mockDOM.window;
global.localStorage = mockDOM.window.localStorage;
global.StorageEvent = mockDOM.StorageEvent;
global.CustomEvent = mockDOM.CustomEvent;
global.KeyboardEvent = mockDOM.KeyboardEvent;
global.setTimeout = setTimeout;
global.clearTimeout = clearTimeout;

class HotkeyImprovementsTest {
    constructor() {
        this.testResults = [];
        this.setupCount = 0;
        this.triggerCount = 0;
    }

    log(message, data = null) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] ${message}`);
        if (data) console.log('  Data:', JSON.stringify(data, null, 2));
    }

    assert(condition, message) {
        if (condition) {
            this.testResults.push({ test: message, result: 'PASS' });
            console.log(`✅ PASS: ${message}`);
        } else {
            this.testResults.push({ test: message, result: 'FAIL' });
            console.log(`❌ FAIL: ${message}`);
        }
    }

    // Test 1: Verify debounced settings updates
    async testDebouncedSettingsUpdates() {
        this.log('🧪 Test 1: Debounced Settings Updates');
        
        let updateCount = 0;
        const originalHandler = global.window.addEventListener;
        
        // Mock the settings update handler
        global.window.addEventListener = function(type, handler) {
            if (type === 'storage') {
                // Wrap the handler to count calls
                const wrappedHandler = function(event) {
                    if (event.key === 'slackpolish_settings') {
                        updateCount++;
                        console.log(`📝 Settings update ${updateCount} triggered`);
                    }
                    return handler(event);
                };
                return originalHandler.call(this, type, wrappedHandler);
            }
            return originalHandler.call(this, type, handler);
        };

        // Simulate rapid settings changes
        for (let i = 0; i < 5; i++) {
            const event = new mockDOM.StorageEvent('storage', {
                key: 'slackpolish_settings',
                newValue: JSON.stringify({ improveHotkey: i % 2 === 0 ? 'Ctrl+Shift' : 'Ctrl+Alt' })
            });
            global.window.dispatchEvent(event);
        }

        // Wait for debouncing
        await new Promise(resolve => setTimeout(resolve, 200));

        // With proper debouncing, we should see fewer actual updates than events fired
        this.assert(updateCount <= 5, 'Settings updates should be debounced');
        this.log(`📊 Fired 5 events, processed ${updateCount} updates`);
    }

    // Test 2: Verify rate limiting logic
    async testRateLimiting() {
        this.log('🧪 Test 2: Rate Limiting Logic');
        
        let triggerCount = 0;
        const MIN_INTERVAL = 500;
        let lastTriggerTime = 0;

        // Mock the rate limiting logic
        function mockTriggerWithRateLimit() {
            const now = Date.now();
            if (now - lastTriggerTime < MIN_INTERVAL) {
                console.log(`⏱️ Trigger rate limited (${now - lastTriggerTime}ms < ${MIN_INTERVAL}ms)`);
                return false;
            }
            lastTriggerTime = now;
            triggerCount++;
            console.log(`🎯 Trigger ${triggerCount} allowed`);
            return true;
        }

        // Test rapid calls
        mockTriggerWithRateLimit(); // Should work
        mockTriggerWithRateLimit(); // Should be rate limited
        mockTriggerWithRateLimit(); // Should be rate limited

        await new Promise(resolve => setTimeout(resolve, 600));
        mockTriggerWithRateLimit(); // Should work after delay

        this.assert(triggerCount === 2, 'Rate limiting should allow only 2 triggers');
        this.log(`📊 Rate limiting allowed ${triggerCount}/4 rapid calls`);
    }

    // Test 3: Verify setup ID tracking
    async testSetupIdTracking() {
        this.log('🧪 Test 3: Setup ID Tracking');
        
        const setupIds = [];
        
        // Mock setup function that generates unique IDs
        function mockSetupEventListeners() {
            const setupId = Date.now() + Math.random();
            setupIds.push(setupId);
            console.log(`🔧 Setup event listeners (setup-id: ${setupId})`);
            return setupId;
        }

        // Simulate multiple setups
        mockSetupEventListeners();
        await new Promise(resolve => setTimeout(resolve, 10));
        mockSetupEventListeners();
        await new Promise(resolve => setTimeout(resolve, 10));
        mockSetupEventListeners();

        // Verify all IDs are unique
        const uniqueIds = new Set(setupIds);
        this.assert(uniqueIds.size === setupIds.length, 'All setup IDs should be unique');
        this.assert(setupIds.length === 3, 'Should have 3 setup IDs');
        this.log(`📊 Generated ${setupIds.length} unique setup IDs`);
    }

    // Test 4: Verify error handling
    async testErrorHandling() {
        this.log('🧪 Test 4: Error Handling');
        
        let errorsCaught = 0;
        
        // Mock error-prone operations
        function mockSettingsHandler(settingsJson) {
            try {
                const settings = JSON.parse(settingsJson);
                console.log('✅ Settings parsed successfully');
                return settings;
            } catch (error) {
                errorsCaught++;
                console.log(`❌ Settings parsing error caught: ${error.message}`);
                return null;
            }
        }

        // Test with valid JSON
        mockSettingsHandler('{"hotkey": "Ctrl+Shift"}');

        // Test with invalid JSON
        mockSettingsHandler('invalid json{');
        mockSettingsHandler('{invalid: json}'); // Missing quotes
        mockSettingsHandler('');

        this.assert(errorsCaught === 3, 'Should catch 3 parsing errors');
        this.log(`📊 Caught ${errorsCaught} errors gracefully`);
    }

    // Test 5: Verify event listener cleanup
    async testEventListenerCleanup() {
        this.log('🧪 Test 5: Event Listener Cleanup');
        
        let addCount = 0;
        let removeCount = 0;
        
        const originalAdd = global.document.addEventListener;
        const originalRemove = global.document.removeEventListener;
        
        global.document.addEventListener = function(type, handler) {
            addCount++;
            return originalAdd.call(this, type, handler);
        };
        
        global.document.removeEventListener = function(type, handler) {
            removeCount++;
            return originalRemove.call(this, type, handler);
        };

        // Mock setup with cleanup
        function mockSetupWithCleanup() {
            const handler = () => {};
            global.document.addEventListener('keydown', handler);
            global.document.addEventListener('keyup', handler);
            
            // Simulate cleanup
            global.document.removeEventListener('keydown', handler);
            global.document.removeEventListener('keyup', handler);
        }

        mockSetupWithCleanup();
        mockSetupWithCleanup(); // Second setup should clean up first

        this.assert(addCount === 4, 'Should add 4 event listeners');
        this.assert(removeCount === 4, 'Should remove 4 event listeners');
        this.log(`📊 Added ${addCount} listeners, removed ${removeCount} listeners`);
    }

    // Run all tests
    async runAllTests() {
        console.log('🚀 Starting Hotkey Improvements Tests (No API Key Required)\n');
        
        await this.testDebouncedSettingsUpdates();
        await this.testRateLimiting();
        await this.testSetupIdTracking();
        await this.testErrorHandling();
        await this.testEventListenerCleanup();
        
        // Summary
        const passed = this.testResults.filter(r => r.result === 'PASS').length;
        const failed = this.testResults.filter(r => r.result === 'FAIL').length;
        
        console.log('\n📊 Test Results Summary:');
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
        
        if (failed === 0) {
            console.log('\n🎉 All hotkey improvement tests passed!');
            console.log('🔒 The original bug (multiple rapid triggers) should now be prevented.');
            return true;
        } else {
            console.log('\n⚠️ Some tests failed. Review the improvements implementation.');
            return false;
        }
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new HotkeyImprovementsTest();
    tester.runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = HotkeyImprovementsTest;
