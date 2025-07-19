// SlackPolish - Text Improvement for Slack
// Simple, focused text polishing with Ctrl+Shift hotkey

(function() {
    'use strict';

    // Configuration - will be overridden by slack-config.js and localStorage
    let CONFIG = {
        OPENAI_API_KEY: '',
        MODEL: 'gpt-4-turbo',
        STYLE: 'professional',
        LANGUAGE: 'English',
        CUSTOM_INSTRUCTIONS: ''
    };

    // Update config if SLACKPOLISH_CONFIG is available
    if (typeof window.SLACKPOLISH_CONFIG !== 'undefined') {
        CONFIG = { ...CONFIG, ...window.SLACKPOLISH_CONFIG };
        // Use the model from config
        CONFIG.MODEL = window.SLACKPOLISH_CONFIG.OPENAI_MODEL || CONFIG.MODEL;
    }

    // Load API key and settings from localStorage
    function loadSettings() {
        try {
            const savedApiKey = localStorage.getItem('slackpolish_openai_api_key');
            if (savedApiKey) {
                CONFIG.OPENAI_API_KEY = savedApiKey;
                utils.log('API key loaded from localStorage');
            }

            const savedSettings = localStorage.getItem('slackpolish_settings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                CONFIG.MODEL = settings.model || CONFIG.MODEL;
                CONFIG.STYLE = settings.style || CONFIG.STYLE;
                CONFIG.LANGUAGE = settings.language || CONFIG.LANGUAGE;
                CONFIG.CUSTOM_INSTRUCTIONS = settings.customInstructions || CONFIG.CUSTOM_INSTRUCTIONS;
                utils.log('Settings loaded from localStorage');
            }
        } catch (error) {
            utils.log(`Error loading settings: ${error.message}`);
        }
    }

    // Utility functions
    const utils = {
        log: function(message) {
            console.log(`🔧 SLACKPOLISH: ${message}`);
        },

        showNotification: function(message, type = 'info') {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'error' ? '#ff4444' : '#4CAF50'};
                color: white;
                padding: 12px 20px;
                border-radius: 4px;
                z-index: 10000;
                font-family: Arial, sans-serif;
                font-size: 14px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);
        },

        findMessageInput: function() {
            // Try multiple selectors for Slack message input
            const selectors = [
                '[data-qa="message_input"]',
                '.ql-editor[data-qa="message_input"]',
                '[contenteditable="true"][data-qa="message_input"]',
                '.c-texty_input__container .ql-editor',
                '[role="textbox"][contenteditable="true"]'
            ];

            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element && element.isContentEditable) {
                    return element;
                }
            }
            return null;
        },

        getTextFromElement: function(element) {
            if (!element) return '';
            return element.innerText || element.textContent || '';
        },

        setTextInElement: function(element, text) {
            if (!element) return;
            
            // Clear existing content
            element.innerHTML = '';
            
            // Set new text
            element.innerText = text;
            
            // Trigger input events to notify Slack
            const events = ['input', 'change', 'keyup'];
            events.forEach(eventType => {
                const event = new Event(eventType, { bubbles: true });
                element.dispatchEvent(event);
            });
        }
    };

    // Text improvement functionality
    const textImprover = {
        isProcessing: false,

        async improveText(originalText) {
            if (!CONFIG.OPENAI_API_KEY) {
                showApiKeyUpdatePopup('OpenAI API key not configured. Please enter your API key to use text improvement.');
                return null;
            }

            if (!originalText.trim()) {
                utils.showNotification('No text to improve', 'error');
                return null;
            }

            this.isProcessing = true;
            utils.log('Starting text improvement...');

            try {
                const prompt = this.buildPrompt(originalText);
                const response = await this.callOpenAI(prompt);

                if (response && response.trim()) {
                    utils.log('Text improvement completed successfully');
                    return response.trim();
                } else {
                    utils.showNotification('Received empty response from OpenAI', 'error');
                    return null;
                }
            } catch (error) {
                utils.log(`Error improving text: ${error.message}`);
                handleApiError(error);
                return null;
            } finally {
                this.isProcessing = false;
            }
        },

        buildPrompt(text) {
            let prompt = `Please improve the following text to be more ${CONFIG.STYLE} in ${CONFIG.LANGUAGE}:

"${text}"

Requirements:
- Keep the same meaning and intent
- Make it sound more ${CONFIG.STYLE}
- Use ${CONFIG.LANGUAGE} language
- Return only the improved text, no explanations`;

            if (CONFIG.CUSTOM_INSTRUCTIONS) {
                prompt += `\n- Additional instructions: ${CONFIG.CUSTOM_INSTRUCTIONS}`;
            }

            return prompt;
        },

        async callOpenAI(prompt) {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: CONFIG.MODEL,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 500,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        }
    };

    // Event handlers
    function setupEventListeners() {
        utils.log('Setting up Ctrl+Shift event listener');

        let ctrlPressed = false;
        let shiftPressed = false;
        let triggerTimeout = null;

        document.addEventListener('keydown', function(event) {
            if (event.key === 'Control') {
                ctrlPressed = true;
                utils.log('Ctrl pressed');
            }
            if (event.key === 'Shift') {
                shiftPressed = true;
                utils.log('Shift pressed');
            }

            // Check if both keys are now pressed
            if (ctrlPressed && shiftPressed && !event.altKey && !event.metaKey) {
                utils.log('Both Ctrl+Shift are pressed - setting trigger timeout');

                // Clear any existing timeout
                if (triggerTimeout) {
                    clearTimeout(triggerTimeout);
                }

                // Set a short timeout to trigger the action
                triggerTimeout = setTimeout(async () => {
                    if (ctrlPressed && shiftPressed) {
                        utils.log('Ctrl+Shift held - triggering text improvement');
                        await triggerTextImprovement();
                    }
                }, 100); // 100ms delay to ensure both keys are held
            }
        });

        document.addEventListener('keyup', function(event) {
            if (event.key === 'Control') {
                ctrlPressed = false;
                utils.log('Ctrl released');
            }
            if (event.key === 'Shift') {
                shiftPressed = false;
                utils.log('Shift released');
            }

            // Clear timeout if either key is released
            if (triggerTimeout && (!ctrlPressed || !shiftPressed)) {
                clearTimeout(triggerTimeout);
                triggerTimeout = null;
                utils.log('Trigger timeout cleared');
            }
        });

        async function triggerTextImprovement() {
            if (textImprover.isProcessing) {
                utils.showNotification('Already processing text...', 'error');
                return;
            }

            const messageInput = utils.findMessageInput();
            if (!messageInput) {
                utils.showNotification('No message input found', 'error');
                utils.log('Message input not found');
                return;
            }

            utils.log(`Found message input: ${messageInput.tagName}`);
            const originalText = utils.getTextFromElement(messageInput);
            utils.log(`Original text: "${originalText}"`);

            if (!originalText.trim()) {
                utils.showNotification('No text to improve', 'error');
                return;
            }

            utils.showNotification('Improving text...');
            const improvedText = await textImprover.improveText(originalText);

            if (improvedText) {
                utils.setTextInElement(messageInput, improvedText);
                utils.showNotification('Text improved successfully!');
            }
        }
    }

    // Handle API errors and show appropriate popups
    function handleApiError(error) {
        // Check if it's a fetch error (network/API issues)
        if (error.message && (
            error.message.includes('401') ||
            error.message.includes('Unauthorized') ||
            error.message.includes('Invalid API key') ||
            error.message.includes('API key')
        )) {
            showApiKeyUpdatePopup('Invalid or missing API key. Please update your OpenAI API key.');
        } else if (error.message && (
            error.message.includes('429') ||
            error.message.includes('quota') ||
            error.message.includes('credits') ||
            error.message.includes('billing')
        )) {
            showApiKeyUpdatePopup('OpenAI API quota exceeded or billing issue. Please check your OpenAI account or update your API key.');
        } else if (error.message && error.message.includes('403')) {
            showApiKeyUpdatePopup('OpenAI API access forbidden. Please check your API key permissions.');
        } else {
            // Generic error - show simple error message
            utils.showNotification(`Error: ${error.message || 'Unknown error occurred'}`, 'error');
        }
    }

    // Show API key update popup
    function showApiKeyUpdatePopup(message) {
        // Remove any existing popup
        const existingPopup = document.getElementById('slackpolish-api-popup');
        if (existingPopup) {
            existingPopup.remove();
        }

        // Create popup container
        const popup = document.createElement('div');
        popup.id = 'slackpolish-api-popup';
        popup.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Arial, sans-serif;
        `;

        // Create popup content
        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 90%;
        `;

        // Title
        const title = document.createElement('h3');
        title.textContent = 'SlackPolish - API Key Required';
        title.style.cssText = `
            margin: 0 0 15px 0;
            color: #333;
            font-size: 18px;
        `;

        // Message
        const messageDiv = document.createElement('p');
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            margin: 0 0 20px 0;
            color: #666;
            line-height: 1.4;
        `;

        // API key input
        const apiKeyInput = document.createElement('input');
        apiKeyInput.type = 'password';
        apiKeyInput.placeholder = 'Enter your OpenAI API key (sk-...)';
        apiKeyInput.style.cssText = `
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
            margin-bottom: 20px;
            box-sizing: border-box;
        `;

        // Buttons container
        const buttonsDiv = document.createElement('div');
        buttonsDiv.style.cssText = `
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        `;

        // Cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
            padding: 10px 20px;
            border: 1px solid #ddd;
            background: white;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        `;

        // Save button
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save API Key';
        saveBtn.style.cssText = `
            padding: 10px 20px;
            border: none;
            background: #4CAF50;
            color: white;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        `;

        // Assemble popup
        buttonsDiv.appendChild(cancelBtn);
        buttonsDiv.appendChild(saveBtn);
        content.appendChild(title);
        content.appendChild(messageDiv);
        content.appendChild(apiKeyInput);
        content.appendChild(buttonsDiv);
        popup.appendChild(content);
        document.body.appendChild(popup);

        // Focus input
        apiKeyInput.focus();

        // Cancel button
        cancelBtn.addEventListener('click', () => {
            popup.remove();
        });

        // Save button
        saveBtn.addEventListener('click', () => {
            const newApiKey = apiKeyInput.value.trim();
            if (!newApiKey) {
                apiKeyInput.style.borderColor = '#d93025';
                apiKeyInput.focus();
                return;
            }

            if (!newApiKey.startsWith('sk-')) {
                apiKeyInput.style.borderColor = '#d93025';
                apiKeyInput.focus();
                alert('API key should start with "sk-"');
                return;
            }

            // Update the API key
            updateApiKey(newApiKey);
            popup.remove();

            // Show success message
            utils.showNotification('✅ API key updated successfully! You can now try improving text again.');
        });

        // Enter key to save
        apiKeyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveBtn.click();
            }
        });

        // Escape key to cancel
        document.addEventListener('keydown', function escapeHandler(e) {
            if (e.key === 'Escape') {
                popup.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        });
    }

    // Update API key in configuration and localStorage
    function updateApiKey(newApiKey) {
        try {
            // Update the current config for immediate use
            CONFIG.OPENAI_API_KEY = newApiKey;

            // Save to localStorage for persistence
            localStorage.setItem('slackpolish_openai_api_key', newApiKey);

            utils.log('🔑 API key updated and saved for future use');
        } catch (error) {
            utils.log(`❌ Error updating API key: ${error.message}`);
        }
    }

    // Initialize
    function init() {
        utils.log('SlackPolish Text Improver initializing...');

        // Load settings from localStorage
        loadSettings();

        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupEventListeners);
        } else {
            setupEventListeners();
        }

        utils.log('SlackPolish Text Improver initialized successfully');
    }

    // Start the application
    init();

})();
