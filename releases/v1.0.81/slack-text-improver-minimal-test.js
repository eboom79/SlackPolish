// SlackPolish - Minimal Test Version
// This is a simplified version to test if injection is working

(function() {
    'use strict';
    
    console.log('🔧 SlackPolish Minimal Test - Starting...');
    
    // Test if we can access the DOM
    if (typeof document === 'undefined') {
        console.error('❌ SlackPolish Test: Document not available');
        return;
    }
    
    console.log('✅ SlackPolish Test: Document available');
    
    // Test basic functionality
    function testBasicFeatures() {
        console.log('🧪 Testing basic SlackPolish features...');
        
        // Test 1: Can we create elements?
        try {
            const testDiv = document.createElement('div');
            testDiv.textContent = 'SlackPolish Test';
            console.log('✅ Test 1: Can create DOM elements');
        } catch (error) {
            console.error('❌ Test 1 Failed:', error);
        }
        
        // Test 2: Can we add event listeners?
        try {
            document.addEventListener('keydown', function testHandler(e) {
                if (e.key === 'F10') {
                    console.log('✅ Test 2: F10 key detected!');
                    alert('SlackPolish Test: F10 key works!');
                }
            });
            console.log('✅ Test 2: Event listener added');
        } catch (error) {
            console.error('❌ Test 2 Failed:', error);
        }
        
        // Test 3: Can we access window properties?
        try {
            window.SLACKPOLISH_TEST = 'Working';
            console.log('✅ Test 3: Window properties accessible');
        } catch (error) {
            console.error('❌ Test 3 Failed:', error);
        }
        
        console.log('🎉 SlackPolish Minimal Test Complete!');
        console.log('💡 Press F10 to test hotkey functionality');
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', testBasicFeatures);
    } else {
        testBasicFeatures();
    }
    
})();
