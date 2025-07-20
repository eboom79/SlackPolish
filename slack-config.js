// SlackPolish Configuration - Complete Customizable Configuration
// All settings can be customized here without modifying the main script

try {
window.SLACKPOLISH_CONFIG = {
    // ========================================
    // VERSION INFORMATION
    // ========================================
    VERSION: "1.0.103",
    BUILD: 103,
    BUILD_DATE: "2025-07-20",
    DESCRIPTION: "Code changes",

    // ========================================
    // EMERGENCY RESET FLAGS (ONE-TIME OPERATION)
    // ========================================
    // Set to true to force reset all saved settings to defaults
    // Useful for fixing corrupted localStorage or deploying breaking changes
    // NOTE: Reset only happens ONCE per RESET_VERSION - increment version to force new reset
    RESET_SAVED_SETTINGS: false,
    RESET_SAVED_SETTINGS_VERSION: 'install-1752747170',

    // Set to true to force reset only the saved API key (keeps other settings)
    // Useful when API key is corrupted but other settings are fine
    // NOTE: Reset only happens ONCE per RESET_VERSION - increment version to force new reset
    RESET_API_KEY: false,
    RESET_API_KEY_VERSION: 'install-1752747170',

    // ========================================
    // OpenAI API Configuration
    // ========================================
    // NOTE: API key is stored in localStorage, not here for security
    OPENAI_MODEL: 'gpt-4-turbo',     // High-quality model for better summaries (was: gpt-3.5-turbo)
    OPENAI_MAX_TOKENS: 500,         // Maximum tokens for text improvement responses
    OPENAI_TEMPERATURE: 0.7,        // Creativity level (0.0 = deterministic, 1.0 = creative)

    // ========================================
    // CHANNEL SUMMARY TOKEN LIMITS
    // ========================================
    // Token limits respecting model constraints (max 4096 completion tokens)
    EXECUTIVE_SUMMARY_MAX_TOKENS: 2000,      // Executive Summary: concise but complete
    COMPREHENSIVE_SUMMARY_MAX_TOKENS: 4000,  // Comprehensive Summary: detailed analysis
    DEFAULT_SUMMARY_MAX_TOKENS: 3000,        // Default/fallback for summaries

    // ========================================
    // DEFAULT SETTINGS
    // ========================================
    DEFAULT_SETTINGS: {
        language: 'ENGLISH',        // Default language
        style: 'CASUAL',           // Default style
        improveHotkey: 'Ctrl+Shift', // Default hotkey
        personalPolish: '',         // Default personal polish (empty)
        smartContext: {
            enabled: true,          // Enable smart context by default
            maxMessages: 5,         // Maximum messages to include in context
            privacyMode: false,     // Anonymize sender names if true
            minMessageLength: 3,    // Minimum message length to include
            maxContextAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
            includeThreadContext: true // Include thread parent messages
        },
        debugMode: false            // Show debug logs and visual indicators
    },

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
    // DETAILED PROMPTS
    // ========================================
    PROMPTS: {
        // Style prompts - provide specific instructions for each improvement type
        STYLES: {
            PROFESSIONAL: 'Please rewrite the following text in a professional, business-appropriate tone while maintaining the original meaning and key information',
            CASUAL: 'Please rewrite the following text in a casual, friendly tone while keeping the main message clear',
            CONCISE: 'Please rewrite the following text to be more concise and to the point while preserving all important information',
            GRAMMAR: 'Please correct any grammar, spelling, and punctuation errors in the following text while maintaining the original tone and meaning'
        },

        // Language prompts - specify target language for responses
        LANGUAGES: {
            ENGLISH: 'Respond in English',
            SPANISH: 'Respond in Spanish',
            FRENCH: 'Respond in French',
            GERMAN: 'Respond in German',
            HEBREW: 'Respond in Hebrew',
            CHINESE: 'Respond in Chinese (Simplified)',
            HINDI: 'Respond in Hindi',
            BULGARIAN: 'Respond in Bulgarian'
        }
    },

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