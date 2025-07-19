// === SLACK TEXT IMPROVER INJECTION START ===
// SlackPolish Channel Summary - Independent Channel Summary Management
// This script handles the channel summary interface separately from the main text improver

(function() {
    'use strict';

    // Utility functions
    const utils = {
        log: function(message) {
            console.log(`🔧 SLACKPOLISH: ${message}`);
        },

        debug: function(message, data = null) {
            // Check if debug mode is enabled and global debug system exists
            try {
                const settings = SlackChannelSummary.loadSettings();
                if (settings.debugMode && window.SlackPolishDebug) {
                    console.log(`🐛 SLACKPOLISH DEBUG: ${message}`, data || '');
                    window.SlackPolishDebug.addLog('channel-summary', message, data);
                }
            } catch (e) {
                // Fallback to console if settings not available yet
                console.log(`🐛 SLACKPOLISH DEBUG: ${message}`, data || '');
            }
        }
    };

    // Channel Summary management
    const SlackChannelSummary = {
        // Default settings (only what's needed for channel summary)
        defaultSettings: {
            debugMode: false,
            apiKey: ''
        },

        // Load settings from localStorage (only what's needed for channel summary)
        loadSettings: function() {
            try {
                const savedSettings = localStorage.getItem('slackpolish_settings');
                const savedApiKey = localStorage.getItem('slackpolish_openai_api_key');

                let settings = { ...this.defaultSettings };

                if (savedSettings) {
                    const parsed = JSON.parse(savedSettings);
                    // Only extract debugMode from saved settings
                    if (parsed.debugMode !== undefined) {
                        settings.debugMode = parsed.debugMode;
                    }
                }

                if (savedApiKey) {
                    settings.apiKey = savedApiKey;
                }

                return settings;
            } catch (error) {
                utils.log('Error loading settings: ' + error.message);
                utils.debug('Settings loading error', { error: error.message, stack: error.stack });
                return { ...this.defaultSettings };
            }
        },



        // Create SlackPolish logo
        createLogo: function(size = 24) {
            const logoImg = document.createElement('img');
            logoImg.title = 'SlackPolish';
            logoImg.alt = 'SlackPolish Logo';
            logoImg.width = size;
            logoImg.height = size;
            logoImg.style.cssText = `display: block; border: none; width: ${size}px !important; height: ${size}px !important; max-width: ${size}px; max-height: ${size}px;`;

            // Use the global logo data if available
            logoImg.src = window.SLACKPOLISH_LOGO_BASE64 || "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIj48Y2lyY2xlIGN4PSIyNTYiIGN5PSIyNTYiIHI9IjIwMCIgZmlsbD0iIzEyNjRhMyIvPjx0ZXh0IHg9IjI1NiIgeT0iMjgwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+U1A8L3RleHQ+PC9zdmc+";

            // Fallback to text if image fails
            logoImg.onerror = function() {
                const textSpan = document.createElement('span');
                textSpan.textContent = 'SP';
                textSpan.title = 'SlackPolish';
                textSpan.style.cssText = `
                    font-size: ${size}px;
                    font-weight: bold;
                    color: #1264a3;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                `;
                this.parentNode.replaceChild(textSpan, this);
            };

            return logoImg;
        },

        // Show channel summary window
        showChannelSummary: function() {
            // Remove existing window if present
            const existingWindow = document.getElementById('slackpolish-channel-summary-window');
            if (existingWindow) {
                existingWindow.remove();
                return;
            }

            const summaryWindow = document.createElement('div');
            summaryWindow.id = 'slackpolish-channel-summary-window';

            summaryWindow.innerHTML = this.createChannelSummaryHTML();
            document.body.appendChild(summaryWindow);

            // Add logo to summary window
            const logoContainer = summaryWindow.querySelector('#channel-summary-logo');
            if (logoContainer) {
                logoContainer.appendChild(this.createLogo(48));
            }

            // Add event listeners
            this.setupSummaryEventListeners(summaryWindow);
        },

        // Create the channel summary HTML
        createChannelSummaryHTML: function() {
            return `
                <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10001; display: flex; align-items: center; justify-content: center;">
                    <div style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); font-family: Arial, sans-serif; width: 700px; max-height: 90vh; overflow-y: auto;">

                        <!-- Header -->
                        <div style="display: flex; align-items: center; margin-bottom: 20px; padding: 12px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 8px; border: 1px solid #dee2e6;">
                            <div style="background: white; border-radius: 8px; padding: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-right: 16px; display: flex; align-items: center; justify-content: center;" id="channel-summary-logo">
                            </div>
                            <div style="flex: 1;">
                                <div style="font-weight: bold; font-size: 18px; color: #2c3e50; margin-bottom: 4px;">SlackPolish Channel Summary</div>
                                <div style="font-size: 13px; color: #6c757d;">AI-powered channel summarization</div>
                            </div>
                        </div>

                        <!-- Time Range and Summary Level Selection (Side by Side) -->
                        <div style="display: flex; gap: 12px; margin-bottom: 12px;">
                            <div style="flex: 1;">
                                <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px;">📅 Time Range:</label>
                                <select id="time-range-select" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box; background: white;">
                                    <option value="1">24 hours</option>
                                    <option value="7" selected>7 days</option>
                                    <option value="30">30 days</option>
                                    <option value="all">Entire channel</option>
                                </select>
                            </div>
                            <div style="flex: 1;">
                                <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px;">📊 Summary Level:</label>
                                <select id="summary-level-select" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box; background: white;">
                                    <option value="executive" selected>📋 Executive Summary</option>
                                    <option value="comprehensive">📚 Comprehensive</option>
                                </select>
                            </div>
                        </div>

                        <!-- Summary Text Area -->
                        <div style="margin-bottom: 12px;">
                            <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px;">📝 Channel Summary:</label>
                            <textarea id="summary-textbox" placeholder="Channel summary will appear here..." style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box; height: 250px; resize: vertical; font-family: inherit;"></textarea>
                        </div>

                        <!-- Action Buttons -->
                        <div style="text-align: right; margin-top: 15px;">
                            <button id="generate-summary-btn" style="padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; margin-left: 8px; border: none; background: #007a5a; color: white;">🔍 Generate Summary</button>
                            <button id="copy-summary-btn" style="padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; margin-left: 8px; border: 1px solid #ddd; background: #f8f8f8; color: #333;">📋 Copy</button>
                            <button id="close-summary-btn" style="padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; margin-left: 8px; border: 1px solid #ddd; background: #f8f8f8; color: #333;">✕ Close</button>
                        </div>
                    </div>
                </div>
            `;
        },

        // Setup event listeners for the summary window
        setupSummaryEventListeners: function(summaryWindow) {
            const generateBtn = summaryWindow.querySelector('#generate-summary-btn');
            const copyBtn = summaryWindow.querySelector('#copy-summary-btn');
            const closeBtn = summaryWindow.querySelector('#close-summary-btn');

            // Generate button
            generateBtn.addEventListener('click', () => {
                this.generateChannelSummary(summaryWindow);
            });

            // Copy button
            copyBtn.addEventListener('click', () => {
                const textbox = summaryWindow.querySelector('#summary-textbox');
                navigator.clipboard.writeText(textbox.value).then(() => {
                    this.showNotification('Summary copied to clipboard!', 'success');
                });
            });

            // Close button
            closeBtn.addEventListener('click', () => {
                summaryWindow.remove();
            });

            // Escape key to close
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    summaryWindow.remove();
                    document.removeEventListener('keydown', escapeHandler);
                }
            };
            document.addEventListener('keydown', escapeHandler);

            // Click outside to close
            summaryWindow.addEventListener('click', (e) => {
                if (e.target === summaryWindow) {
                    summaryWindow.remove();
                }
            });
        },

        // Generate channel summary
        generateChannelSummary: function(summaryWindow) {
            const textbox = summaryWindow.querySelector('#summary-textbox');
            const timeRange = summaryWindow.querySelector('#time-range-select').value;
            const summaryLevel = summaryWindow.querySelector('#summary-level-select').value;

            utils.log('Generate Channel Summary clicked');
            utils.debug('Channel summary generation started', { timeRange, summaryLevel });

            textbox.value = `Channel Summary Generation Started...\n\nTime Range: ${timeRange}\nSummary Level: ${summaryLevel}\n\n[Summary functionality to be implemented]`;
        },

        // Show notification
        showNotification: function(message, type = 'info') {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'error' ? '#d93025' : '#1264a3'};
                color: white;
                padding: 12px 20px;
                border-radius: 6px;
                z-index: 10002;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
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

    // Initialize channel summary functionality
    function initializeChannelSummary() {
        utils.log('Channel Summary module initialized');
        utils.debug('Channel Summary module initialization', {
            hasGlobalDebug: !!window.SlackPolishDebug,
            currentSettings: SlackChannelSummary.loadSettings()
        });

        // Add keyboard shortcut for channel summary (F10)
        document.addEventListener('keydown', function(event) {
            if (event.key === 'F10') {
                event.preventDefault();
                SlackChannelSummary.showChannelSummary();
            }
        });
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeChannelSummary);
    } else {
        initializeChannelSummary();
    }

})();
// === SLACK TEXT IMPROVER INJECTION END ===
