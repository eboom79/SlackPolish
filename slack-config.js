// SlackPolish Configuration - Complete Customizable Configuration
// All settings can be customized here without modifying the main script

try {
window.SLACKPOLISH_CONFIG = {
    // ========================================
    // VERSION INFORMATION
    // ========================================
    VERSION: "1.1.9",
    BUILD: 9,
    BUILD_DATE: "2025-07-21",
    DESCRIPTION: "Test settings reset while preserving API key",

    // ========================================
    // EMERGENCY RESET FLAGS (ONE-TIME OPERATION)
    // ========================================
    // Set to true to force reset all saved settings to defaults
    // Useful for fixing corrupted localStorage or deploying breaking changes
    // NOTE: Reset only happens ONCE per RESET_VERSION - increment version to force new reset
    RESET_SAVED_SETTINGS: true,
    RESET_SAVED_SETTINGS_VERSION: 'test-settings-reset-preserve-api-v1.1.8',

    // Set to true to force reset only the saved API key (keeps other settings)
    // Useful when API key is corrupted but other settings are fine
    // NOTE: Reset only happens ONCE per RESET_VERSION - increment version to force new reset
    RESET_API_KEY: false,
    RESET_API_KEY_VERSION: 'test-api-reset-v1.1.8',

    // ========================================
    // OpenAI API Configuration
    // ========================================
    // NOTE: API key is stored in localStorage, not here for security
    //
    // COST ESTIMATION (as of 2025, prices may change):
    // gpt-4-turbo: $10.00 per 1M input tokens, $30.00 per 1M output tokens
    //
    // Typical usage costs:
    // • Text improvement (500 tokens): ~$0.015 per improvement
    // • Executive summary (2000 tokens): ~$0.06 per summary
    // • Comprehensive summary (4000 tokens): ~$0.12 per summary
    //
    // Monthly estimates for moderate usage:
    // • 50 text improvements: ~$0.75
    // • 10 executive summaries: ~$0.60
    // • 5 comprehensive summaries: ~$0.60
    // Total: ~$2.00/month for moderate usage

    // Model Selection
    OPENAI_MODEL: 'gpt-4-turbo',     // High-quality model for better text improvement and summaries
                                     // Alternative: 'gpt-3.5-turbo' (cheaper but lower quality)

    // Text Improvement Settings
    OPENAI_MAX_TOKENS: 500,          // Maximum tokens for text improvement responses
                                     //
                                     // What are tokens? Roughly 4 characters or 0.75 words
                                     // Example: 500 tokens ≈ 375 words or ~2-3 paragraphs
                                     //
                                     // Trade-offs:
                                     // • Lower values (200-500): Cheaper cost, shorter responses, may cut off longer improvements
                                     // • Higher values (800-1500): Higher cost, longer responses, better for complex text
                                     //
                                     // Recommended: 500 for most text improvements (good balance of cost/quality)

    OPENAI_TEMPERATURE: 0.7,         // Creativity level (0.0 = deterministic, 1.0 = creative)
                                     //
                                     // Trade-offs:
                                     // • Lower (0.0-0.3): More consistent, predictable, formal responses
                                     // • Medium (0.4-0.7): Balanced creativity and consistency (recommended)
                                     // • Higher (0.8-1.0): More creative, varied, but potentially inconsistent

    // ========================================
    // CHANNEL SUMMARY TOKEN LIMITS
    // ========================================
    // Token limits for different summary types
    // Note: gpt-4-turbo supports up to 4096 completion tokens

    EXECUTIVE_SUMMARY_MAX_TOKENS: 2000,      // Executive Summary: structured bullet points
                                             //
                                             // What to expect: ~1500 words, 3-4 pages of summary
                                             // Cost impact: Medium cost, good for regular use
                                             // Quality: Concise but complete overview of key topics
                                             // Best for: Daily/weekly channel reviews

    COMPREHENSIVE_SUMMARY_MAX_TOKENS: 4000,  // Comprehensive Summary: detailed analysis
                                             //
                                             // What to expect: ~3000 words, 6-8 pages of detailed analysis
                                             // Cost impact: Higher cost, use sparingly for important channels
                                             // Quality: In-depth analysis with participants, context, and timeline
                                             // Best for: Important meetings, project reviews, incident analysis

    DEFAULT_SUMMARY_MAX_TOKENS: 3000,        // Default/fallback for summaries
                                             //
                                             // What to expect: ~2250 words, 4-5 pages of balanced summary
                                             // Cost impact: Moderate cost, good middle ground
                                             // Quality: Balanced detail level between executive and comprehensive
                                             // Used when: Summary level is not specified or for medium-length channels



    // ========================================
    // AVAILABLE HOTKEYS
    // ========================================
    AVAILABLE_HOTKEYS: [
        'Ctrl+Shift',  // Default option - most reliable
        'Ctrl+Alt',    // Alternative modifier combination
        'Ctrl+Tab'     // Tab key combination
    ],

    // ========================================
    // SUPPORTED LANGUAGES
    // ========================================
    SUPPORTED_LANGUAGES: {
        ENGLISH: { name: 'English', flag: '🇺🇸', displayName: 'English' },
        SPANISH: { name: 'Spanish', flag: '🇪🇸', displayName: 'Spanish' },
        FRENCH: { name: 'French', flag: '🇫🇷', displayName: 'French' },
        GERMAN: { name: 'German', flag: '🇩🇪', displayName: 'German' },
        HEBREW: { name: 'Hebrew', flag: '🇮🇱', displayName: 'Hebrew' },
        CHINESE: { name: 'Chinese', flag: '🇨🇳', displayName: 'Chinese' },
        HINDI: { name: 'Hindi', flag: '🇮🇳', displayName: 'Hindi' },
        BULGARIAN: { name: 'Bulgarian', flag: '🇧🇬', displayName: 'Bulgarian' }
    },

    // ========================================
    // AVAILABLE STYLES
    // ========================================
    AVAILABLE_STYLES: {
        PROFESSIONAL: { name: '💼 Professional', description: 'Business-appropriate tone' },
        CASUAL: { name: '😊 Casual', description: 'Friendly and relaxed' },
        CONCISE: { name: '⚡ Concise', description: 'Brief and to the point' },
        GRAMMAR: { name: '✏️ Grammar Fix', description: 'Correct errors only' },
        TRANSLATE: { name: '🌍 Translate Only', description: 'Pure translation' }
    },

    // ========================================
    // SLACK TEXT INPUT SELECTORS
    // ========================================
    TEXT_INPUT_SELECTORS: [
        // Main channel message input
        '[data-qa="message_input"] .ql-editor',
        '.ql-editor[contenteditable="true"]',
        '[contenteditable="true"].ql-editor',
        '.c-texty_input .ql-editor',

        // Thread-specific message inputs
        '[data-qa="thread_message_input"] .ql-editor',
        '[data-qa="thread-message-input"] .ql-editor',
        '.p-thread_view .ql-editor',
        '.p-threads_view .ql-editor',
        '.c-message_kit__thread .ql-editor',

        // Fallback selectors for threads
        '.p-thread_view [contenteditable="true"]',
        '.p-threads_view [contenteditable="true"]',
        '[data-qa="thread_view"] .ql-editor',
        '[data-qa="threads_view"] .ql-editor',

        // Generic fallbacks
        '.ql-editor',
        '[contenteditable="true"]'
    ],



    // ========================================
    // CHANNEL SUMMARY SETTINGS
    // ========================================
    CHANNEL_SUMMARY: {
        HOTKEY: 'F10',                    // Default hotkey for channel summary
        DEFAULT_DEPTH: 'last24hours',     // Default time range: last24hours, last7days, last30days, entirechannel
        DEFAULT_LEVEL: 'short',           // Default summary level: short, medium, comprehensive
        WINDOW_SIZE: { width: 800, height: 600 },
        REMEMBER_PREFERENCES: true,       // Remember user's last selections
        INCLUDE_PARTICIPANTS: true,       // Include participant analysis
        INCLUDE_MESSAGE_COUNT: true,      // Show message count in summary
        INCLUDE_FILES_LINKS: false,       // Include file/link references

        // Summary depth options
        DEPTH_OPTIONS: {
            'last24hours': { label: 'Last 24 hours', hours: 24 },
            'last7days': { label: 'Last 7 days', hours: 24 * 7 },
            'last30days': { label: 'Last 30 days', hours: 24 * 30 },
            'entirechannel': { label: 'Entire channel', hours: null }
        },

        // Summary level options
        LEVEL_OPTIONS: {
            'short': {
                label: 'Executive Summary',
                description: 'Structured bullet points with key topics and decisions',
                maxTokens: 3000  // Increased for complete executive summaries
            },
            'comprehensive': {
                label: 'Comprehensive Summary',
                description: 'Detailed analysis with participants, context, and timeline',
                maxTokens: 8000  // Significantly increased for thorough analysis
            }
        }
    }
};
} catch (error) {
    console.error('❌ SlackPolish config failed to load:', error);
}