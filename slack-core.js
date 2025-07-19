// SlackPolish Core - Text Improvement Functionality
// This handles the main Ctrl+Shift text improvement feature

(function() {
    'use strict';

    // Shared utilities namespace
    window.SlackPolishUtils = window.SlackPolishUtils || {
        log: function(message) {
            console.log(`[SlackPolish] ${message}`);
        },
        
        getConfig: function() {
            return window.SLACKPOLISH_CONFIG || {};
        },
        
        showNotification: function(message, type = 'info') {
            // Simple notification system
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
        }
    };

    class SlackTextImprover {
        constructor() {
            this.isProcessing = false;
            this.originalTexts = new Map();
            this.init();
        }

        init() {
            SlackPolishUtils.log('Core text improver initialized');
            this.setupEventListeners();
        }

        setupEventListeners() {
            document.addEventListener('keydown', (event) => {
                if (event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey) {
                    event.preventDefault();
                    this.handleTextImprovement();
                }
            });
        }

        async handleTextImprovement() {
            if (this.isProcessing) {
                SlackPolishUtils.showNotification('Already processing a request...', 'info');
                return;
            }

            const activeElement = document.activeElement;
            if (!this.isValidTextInput(activeElement)) {
                SlackPolishUtils.showNotification('Please focus on a text input field', 'error');
                return;
            }

            const originalText = this.getTextFromElement(activeElement);
            if (!originalText || originalText.trim().length === 0) {
                SlackPolishUtils.showNotification('No text to improve', 'error');
                return;
            }

            this.isProcessing = true;
            try {
                SlackPolishUtils.showNotification('Improving text...', 'info');
                const improvedText = await this.improveTextWithAI(originalText);
                
                if (improvedText && improvedText !== originalText) {
                    this.originalTexts.set(activeElement, originalText);
                    this.setTextInElement(activeElement, improvedText);
                    SlackPolishUtils.showNotification('Text improved! Press Ctrl+Z to undo', 'info');
                } else {
                    SlackPolishUtils.showNotification('No improvements suggested', 'info');
                }
            } catch (error) {
                SlackPolishUtils.log(`Error improving text: ${error.message}`);
                SlackPolishUtils.showNotification(`Error: ${error.message}`, 'error');
            } finally {
                this.isProcessing = false;
            }
        }

        isValidTextInput(element) {
            if (!element) return false;
            
            const tagName = element.tagName.toLowerCase();
            const isTextInput = tagName === 'textarea' || 
                              (tagName === 'input' && ['text', 'email', 'search'].includes(element.type)) ||
                              element.contentEditable === 'true';
            
            // Check for Slack-specific message input areas
            const isSlackInput = element.closest('[data-qa="message_input"]') ||
                               element.closest('.ql-editor') ||
                               element.classList.contains('ql-editor');
            
            return isTextInput || isSlackInput;
        }

        getTextFromElement(element) {
            if (element.tagName.toLowerCase() === 'textarea' || element.tagName.toLowerCase() === 'input') {
                return element.value;
            } else if (element.contentEditable === 'true') {
                return element.textContent || element.innerText;
            }
            return '';
        }

        setTextInElement(element, text) {
            if (element.tagName.toLowerCase() === 'textarea' || element.tagName.toLowerCase() === 'input') {
                element.value = text;
                element.dispatchEvent(new Event('input', { bubbles: true }));
            } else if (element.contentEditable === 'true') {
                element.textContent = text;
                element.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }

        async improveTextWithAI(text) {
            const config = SlackPolishUtils.getConfig();
            const apiKey = config.OPENAI_API_KEY;
            
            if (!apiKey) {
                throw new Error('OpenAI API key not configured. Please set your API key in settings (F12).');
            }

            const style = config.STYLE || 'professional';
            const language = config.LANGUAGE || 'English';
            const customInstructions = config.CUSTOM_INSTRUCTIONS || '';

            let prompt = `Please improve the following text to be more ${style} while maintaining its core meaning and intent. `;
            prompt += `Respond in ${language}. `;
            
            if (customInstructions) {
                prompt += `Additional instructions: ${customInstructions}. `;
            }
            
            prompt += `Only return the improved text, nothing else.\n\nText to improve: "${text}"`;

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: config.MODEL || 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: Math.min(Math.max(text.length * 2, 100), 1000),
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                if (response.status === 401) {
                    throw new Error('Invalid API key. Please check your OpenAI API key in settings.');
                } else if (response.status === 429) {
                    throw new Error('API rate limit exceeded. Please try again later.');
                } else {
                    throw new Error(errorData.error?.message || `API request failed (${response.status})`);
                }
            }

            const data = await response.json();
            const improvedText = data.choices?.[0]?.message?.content?.trim();
            
            if (!improvedText) {
                throw new Error('No response from AI service');
            }

            return improvedText;
        }
    }

    // Initialize the text improver
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new SlackTextImprover();
        });
    } else {
        new SlackTextImprover();
    }

})();
