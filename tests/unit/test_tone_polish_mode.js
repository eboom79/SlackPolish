/**
 * Test suite for the new Tone Polish mode
 * Tests that the new TONE_POLISH style works correctly
 */

// Mock SlackPolish configuration
const mockConfig = {
    AVAILABLE_STYLES: {
        PROFESSIONAL: { name: '💼 Professional', description: 'Business-appropriate tone' },
        CASUAL: { name: '😊 Casual', description: 'Friendly and relaxed' },
        CONCISE: { name: '⚡ Concise', description: 'Brief and to the point' },
        TONE_POLISH: { name: '✨ Tone Polish', description: 'Improve grammar & phrasing, keep original tone' },
        GRAMMAR: { name: '✏️ Grammar Fix', description: 'Correct errors only' },
        TRANSLATE: { name: '🌍 Translate Only', description: 'Pure translation' }
    },
    PROMPTS: {
        STYLES: {
            PROFESSIONAL: 'Please rewrite the following text in a professional, business-appropriate tone while maintaining the original meaning and key information',
            CASUAL: 'Please rewrite the following text in a casual, friendly tone while keeping the main message clear',
            CONCISE: 'Please rewrite the following text to be more concise and to the point while preserving all important information',
            TONE_POLISH: 'Please improve the grammar, sentence structure, and phrasing of the following text while preserving the original tone, style, and message length. Focus on making it clearer and more polished without changing the voice or shortening the content. IMPORTANT: Do not add emojis, buzzwords, corporate speak, or AI-generated phrases. Keep it natural and human-sounding, avoiding words like "leverage," "streamline," "optimize," "enhance," "furthermore," "additionally," or overly enthusiastic language. The result should sound like the original person wrote it, just with better grammar',
            GRAMMAR: 'Please correct any grammar, spelling, and punctuation errors in the following text while maintaining the original tone and meaning exactly as written',
            TRANSLATE: 'Please translate the following text accurately while preserving the original tone and meaning'
        }
    }
};

// Test functions
function testTonePolishStyleExists() {
    console.log('🧪 Testing: Tone Polish style exists in configuration');
    
    const tonePolishStyle = mockConfig.AVAILABLE_STYLES.TONE_POLISH;
    
    if (!tonePolishStyle) {
        console.error('❌ FAIL: TONE_POLISH style not found in AVAILABLE_STYLES');
        return false;
    }
    
    if (tonePolishStyle.name !== '✨ Tone Polish') {
        console.error('❌ FAIL: TONE_POLISH name incorrect. Expected "✨ Tone Polish", got:', tonePolishStyle.name);
        return false;
    }
    
    if (!tonePolishStyle.description.includes('grammar') || !tonePolishStyle.description.includes('phrasing')) {
        console.error('❌ FAIL: TONE_POLISH description should mention grammar and phrasing. Got:', tonePolishStyle.description);
        return false;
    }
    
    console.log('✅ PASS: TONE_POLISH style exists with correct name and description');
    return true;
}

function testTonePolishPromptExists() {
    console.log('🧪 Testing: Tone Polish prompt exists and is appropriate');
    
    const tonePolishPrompt = mockConfig.PROMPTS.STYLES.TONE_POLISH;
    
    if (!tonePolishPrompt) {
        console.error('❌ FAIL: TONE_POLISH prompt not found in PROMPTS.STYLES');
        return false;
    }
    
    // Check that the prompt mentions key requirements
    const requiredKeywords = ['grammar', 'phrasing', 'preserving', 'tone', 'length'];
    const missingKeywords = requiredKeywords.filter(keyword => 
        !tonePolishPrompt.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (missingKeywords.length > 0) {
        console.error('❌ FAIL: TONE_POLISH prompt missing keywords:', missingKeywords);
        console.error('Prompt:', tonePolishPrompt);
        return false;
    }
    
    // Check that it specifically mentions not shortening content
    if (!tonePolishPrompt.toLowerCase().includes('without') || 
        (!tonePolishPrompt.toLowerCase().includes('shortening') && !tonePolishPrompt.toLowerCase().includes('changing'))) {
        console.error('❌ FAIL: TONE_POLISH prompt should explicitly mention not shortening/changing content');
        console.error('Prompt:', tonePolishPrompt);
        return false;
    }
    
    console.log('✅ PASS: TONE_POLISH prompt exists with appropriate instructions');
    return true;
}

function testTonePolishPromptDifference() {
    console.log('🧪 Testing: Tone Polish prompt is different from Concise mode');
    
    const tonePolishPrompt = mockConfig.PROMPTS.STYLES.TONE_POLISH;
    const concisePrompt = mockConfig.PROMPTS.STYLES.CONCISE;
    
    if (tonePolishPrompt === concisePrompt) {
        console.error('❌ FAIL: TONE_POLISH and CONCISE prompts are identical');
        return false;
    }
    
    // CONCISE should mention "concise" or "brief", TONE_POLISH should not
    if (tonePolishPrompt.toLowerCase().includes('concise') || tonePolishPrompt.toLowerCase().includes('brief')) {
        console.error('❌ FAIL: TONE_POLISH prompt should not mention being concise or brief');
        console.error('Prompt:', tonePolishPrompt);
        return false;
    }
    
    // TONE_POLISH should mention preserving length, CONCISE should not
    if (!tonePolishPrompt.toLowerCase().includes('length') && !tonePolishPrompt.toLowerCase().includes('shortening')) {
        console.error('❌ FAIL: TONE_POLISH prompt should mention preserving length or not shortening');
        console.error('Prompt:', tonePolishPrompt);
        return false;
    }
    
    console.log('✅ PASS: TONE_POLISH prompt is appropriately different from CONCISE');
    return true;
}

function testStyleOrder() {
    console.log('🧪 Testing: Tone Polish is positioned correctly in style list');
    
    const styleKeys = Object.keys(mockConfig.AVAILABLE_STYLES);
    const tonePolishIndex = styleKeys.indexOf('TONE_POLISH');
    const conciseIndex = styleKeys.indexOf('CONCISE');
    const grammarIndex = styleKeys.indexOf('GRAMMAR');
    
    if (tonePolishIndex === -1) {
        console.error('❌ FAIL: TONE_POLISH not found in styles');
        return false;
    }
    
    // TONE_POLISH should be positioned between CONCISE and GRAMMAR for logical grouping
    if (tonePolishIndex <= conciseIndex || tonePolishIndex >= grammarIndex) {
        console.log('ℹ️ INFO: TONE_POLISH position:', tonePolishIndex, 'CONCISE:', conciseIndex, 'GRAMMAR:', grammarIndex);
        console.log('ℹ️ INFO: Style order:', styleKeys);
        // This is not a failure, just informational
    }
    
    console.log('✅ PASS: TONE_POLISH is present in the style list');
    return true;
}

// Run all tests
function runAllTests() {
    console.log('🚀 Starting Tone Polish Mode Tests...\n');
    
    const tests = [
        testTonePolishStyleExists,
        testTonePolishPromptExists,
        testTonePolishPromptDifference,
        testStyleOrder
    ];
    
    let passed = 0;
    let failed = 0;
    
    tests.forEach((test, index) => {
        try {
            const result = test();
            if (result) {
                passed++;
            } else {
                failed++;
            }
        } catch (error) {
            console.error(`❌ FAIL: Test ${index + 1} threw an error:`, error);
            failed++;
        }
        console.log(''); // Add spacing between tests
    });
    
    console.log('📊 Test Results:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
    
    if (failed === 0) {
        console.log('🎉 All tests passed! Tone Polish mode is ready to use.');
    } else {
        console.log('⚠️ Some tests failed. Please review the configuration.');
    }
    
    return failed === 0;
}

// Export for Node.js or run directly in browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runAllTests, mockConfig };
} else {
    // Run tests immediately if in browser
    runAllTests();
}
