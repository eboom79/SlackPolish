#!/usr/bin/env node

/**
 * Text Processing Test Vectors
 * Tests text sanitization, anonymization, and formatting functions
 */

const path = require('path');
const TestVectorRunner = require('../framework/test-vector-runner');

// Mock functions extracted from the main codebase for testing
class TextProcessor {
    /**
     * Anonymize text by replacing sensitive information
     * Based on anonymizeText function from slack-text-improver.js
     */
    static anonymizeText(text) {
        if (!text || typeof text !== 'string') return '';
        
        try {
            let anonymized = text
                // Replace @mentions with @User
                .replace(/@\w+/g, '@User')
                // Replace email addresses
                .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, 'email@domain.com')
                // Replace phone numbers (basic pattern)
                .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, 'XXX-XXX-XXXX')
                // Replace URLs
                .replace(/https?:\/\/[^\s]+/g, 'https://example.com')
                // Replace common names (this is basic - could be enhanced)
                .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, 'Person Name');

            return anonymized;
        } catch (error) {
            return text; // Return original on error
        }
    }

    /**
     * Sanitize text for API processing
     * Based on sanitizeText function from releases/SlackPolish-Linux-v8.9.8/slack-text-improver.js
     */
    static sanitizeText(text) {
        if (!text || typeof text !== 'string') return '';
        
        return text
            .replace(/\n+/g, ' ') // Replace newlines with spaces
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/@channel|@here|@everyone/gi, '[mention]') // Replace mentions
            .replace(/https?:\/\/[^\s]+/g, '[link]') // Replace URLs
            .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, '[email]') // Replace emails
            .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[phone]') // Replace phone numbers
            .trim()
            .substring(0, 200); // Limit length
    }

    /**
     * Format context messages for AI processing
     * Based on formatContextForAI function
     */
    static formatContextForAI(messages, userMessage, isThread = false) {
        if (!messages || messages.length === 0) return '';
        
        const contextLines = messages.map(msg =>
            `[${msg.time}] ${msg.sender}: "${msg.text}"`
        );
        
        const contextType = isThread ? 'thread discussion' : 'channel conversation';
        
        return `CONVERSATION CONTEXT (recent messages from today's ${contextType}):
${contextLines.join('\n')}

---
USER MESSAGE TO IMPROVE: "${userMessage}"`;
    }

    /**
     * Validate API key format
     * Based on API key validation logic
     */
    static validateApiKey(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            return { valid: false, error: 'API key is required' };
        }
        
        const trimmed = apiKey.trim();
        
        if (trimmed.length === 0) {
            return { valid: false, error: 'API key is required' };
        }
        
        if (!trimmed.startsWith('sk-')) {
            return { valid: false, error: 'API key should start with "sk-"' };
        }
        
        if (trimmed.length < 10) {
            return { valid: false, error: 'API key appears to be too short' };
        }
        
        return { valid: true, error: null };
    }
}

// Test Vectors
const anonymizeTestVectors = [
    {
        input: "Hey @john, check out https://github.com/myrepo and email me at john.doe@company.com",
        expected: "Hey @User, check out https://example.com and email me at email@domain.com"
    },
    {
        input: "Call me at 555-123-4567 or 555.123.4567",
        expected: "Call me at XXX-XXX-XXXX or XXX-XXX-XXXX"
    },
    {
        input: "John Smith and Mary Johnson are working on this",
        expected: "Person Name and Person Name are working on this"
    },
    {
        input: "@alice please review https://docs.google.com/document/123 and call 123-456-7890",
        expected: "@User please review https://example.com and call XXX-XXX-XXXX"
    },
    {
        input: "",
        expected: ""
    },
    {
        input: "No sensitive data here",
        expected: "No sensitive data here"
    }
];

const sanitizeTestVectors = [
    {
        input: "Hello\n\nworld\n\n\nwith   multiple    spaces",
        expected: "Hello world with multiple spaces"
    },
    {
        input: "@channel please check https://example.com and email test@domain.com",
        expected: "[mention] please check [link] and email [email]"
    },
    {
        input: "@here urgent! Call 555-123-4567 now",
        expected: "[mention] urgent! Call [phone] now"
    },
    {
        input: "Very long text that exceeds the 200 character limit and should be truncated at exactly 200 characters to prevent API issues and ensure consistent processing across all text inputs in the system and more text to make it longer than 200 characters for sure",
        expected: "Very long text that exceeds the 200 character limit and should be truncated at exactly 200 characters to prevent API issues and ensure consistent processing across all text inputs in the system and mo"
    },
    {
        input: "",
        expected: ""
    },
    {
        input: "   \n\n   \n   ",
        expected: ""
    }
];

const contextTestVectors = [
    {
        input: {
            messages: [
                { time: "10:30", sender: "John", text: "Hello team" },
                { time: "10:31", sender: "Mary", text: "Hi John!" }
            ],
            userMessage: "thanks for the help",
            isThread: false
        },
        expected: `CONVERSATION CONTEXT (recent messages from today's channel conversation):
[10:30] John: "Hello team"
[10:31] Mary: "Hi John!"

---
USER MESSAGE TO IMPROVE: "thanks for the help"`
    },
    {
        input: {
            messages: [
                { time: "14:15", sender: "Alice", text: "Working on the bug fix" }
            ],
            userMessage: "great work",
            isThread: true
        },
        expected: `CONVERSATION CONTEXT (recent messages from today's thread discussion):
[14:15] Alice: "Working on the bug fix"

---
USER MESSAGE TO IMPROVE: "great work"`
    },
    {
        input: {
            messages: [],
            userMessage: "standalone message",
            isThread: false
        },
        expected: ""
    }
];

const apiKeyTestVectors = [
    {
        input: "sk-1234567890abcdef",
        expected: { valid: true, error: null }
    },
    {
        input: "invalid-key",
        expected: { valid: false, error: 'API key should start with "sk-"' }
    },
    {
        input: "",
        expected: { valid: false, error: "API key is required" }
    },
    {
        input: "sk-123",
        expected: { valid: false, error: "API key appears to be too short" }
    },
    {
        input: "  sk-validkeywithtrimming  ",
        expected: { valid: true, error: null }
    },
    {
        input: null,
        expected: { valid: false, error: "API key is required" }
    }
];

// Run Tests
async function runAllTests() {
    console.log('🚀 SlackPolish Text Processing Test Vectors');
    console.log('=============================================\n');

    const runner = new TestVectorRunner();

    // Test anonymizeText function
    runner.runTestVectors(
        'Text Anonymization',
        TextProcessor.anonymizeText,
        anonymizeTestVectors
    );

    // Test sanitizeText function
    runner.runTestVectors(
        'Text Sanitization',
        TextProcessor.sanitizeText,
        sanitizeTestVectors
    );

    // Test formatContextForAI function
    runner.runTestVectors(
        'Context Formatting',
        (input) => TextProcessor.formatContextForAI(input.messages, input.userMessage, input.isThread),
        contextTestVectors
    );

    // Test validateApiKey function
    runner.runTestVectors(
        'API Key Validation',
        TextProcessor.validateApiKey,
        apiKeyTestVectors
    );

    // Print summary and exit
    runner.printSummary();
    process.exit(runner.getExitCode());
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests().catch(error => {
        console.error('❌ Test runner error:', error);
        process.exit(1);
    });
}

module.exports = { TextProcessor, runAllTests };
