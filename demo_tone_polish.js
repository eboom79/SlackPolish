/**
 * Demo script to show the difference between Concise and Tone Polish modes
 * This demonstrates how the new Tone Polish mode works
 */

// Sample text that needs improvement but shouldn't be shortened
const sampleTexts = [
    "hey there, i was thinking that maybe we could try to setup a meeting sometime next week if thats ok with you and see if we can figure out whats going on with the project",
    
    "i think the new feature is pretty good but there might be some issues with how its working right now and we should probably look into it more",
    
    "just wanted to let you know that i finished the task you gave me yesterday and its ready for review whenever you have time to check it out",
    
    "the client called earlier and they was asking about the timeline for the project and when we think it will be done so i told them i would get back to them",
    
    "can you please send me the files that we discussed in the meeting yesterday because i need them to finish my part of the work"
];

// Mock the different style prompts
const stylePrompts = {
    CONCISE: 'Please rewrite the following text to be more concise and to the point while preserving all important information',
    TONE_POLISH: 'Please improve the grammar, sentence structure, and phrasing of the following text while preserving the original tone, style, and message length. Focus on making it clearer and more polished without changing the voice or shortening the content'
};

function demonstrateStyleDifferences() {
    console.log('🎯 SlackPolish Tone Polish Mode Demonstration');
    console.log('='.repeat(60));
    console.log('');
    
    console.log('📝 This demo shows the difference between:');
    console.log('   ⚡ CONCISE mode: Makes text shorter and more direct');
    console.log('   ✨ TONE POLISH mode: Improves grammar/phrasing, keeps original length');
    console.log('');
    
    sampleTexts.forEach((text, index) => {
        console.log(`📄 Sample Text ${index + 1}:`);
        console.log(`Original: "${text}"`);
        console.log(`Length: ${text.length} characters`);
        console.log('');
        
        console.log('⚡ CONCISE Mode would use this prompt:');
        console.log(`"${stylePrompts.CONCISE}"`);
        console.log('Expected result: Shorter, more direct version');
        console.log('');
        
        console.log('✨ TONE POLISH Mode uses this prompt:');
        console.log(`"${stylePrompts.TONE_POLISH}"`);
        console.log('Expected result: Same length, better grammar and flow');
        console.log('');
        
        console.log('-'.repeat(50));
        console.log('');
    });
    
    console.log('🎉 Key Benefits of Tone Polish Mode:');
    console.log('   ✅ Fixes grammar and punctuation errors');
    console.log('   ✅ Improves sentence structure and flow');
    console.log('   ✅ Maintains your original tone and voice');
    console.log('   ✅ Preserves message length and detail');
    console.log('   ✅ Makes text clearer without changing meaning');
    console.log('');
    
    console.log('🚀 How to Use:');
    console.log('   1. Open Slack with SlackPolish installed');
    console.log('   2. Press F12 to open settings');
    console.log('   3. Select "✨ Tone Polish" from the Style dropdown');
    console.log('   4. Type your message in any Slack text field');
    console.log('   5. Press Ctrl+Shift to improve the text');
    console.log('');
    
    console.log('💡 Perfect for when you want to:');
    console.log('   • Keep your casual/friendly tone');
    console.log('   • Fix grammar without sounding formal');
    console.log('   • Maintain detailed explanations');
    console.log('   • Polish text without losing personality');
}

// Run the demonstration
demonstrateStyleDifferences();
