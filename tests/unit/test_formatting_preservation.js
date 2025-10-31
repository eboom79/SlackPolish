#!/usr/bin/env node

/**
 * Test suite for formatting preservation features
 * Tests numbered lists, bullet points, and clean line break handling
 */

// Mock DOM elements and functions for testing
class MockElement {
    constructor(tagName = 'div', className = '') {
        this.tagName = tagName;
        this.className = className;
        this.classList = {
            contains: (cls) => this.className.includes(cls)
        };
        this.innerHTML = '';
        this.innerText = '';
        this.textContent = '';
        this.children = [];
        this.childNodes = [];
    }
    
    appendChild(child) {
        this.children.push(child);
        this.childNodes.push(child);
    }
    
    querySelectorAll(selector) {
        // Simple mock implementation
        if (selector === 'p') {
            return this.children.filter(child => child.tagName === 'p');
        }
        if (selector === 'ol, ul') {
            return this.children.filter(child => child.tagName === 'ol' || child.tagName === 'ul');
        }
        return [];
    }
}

// Mock text processing functions based on our implementation
class TextProcessor {
    static getTextFromElement(element) {
        if (!element) return '';
        
        // Special handling for Slack's rich text editor to preserve numbering
        if (element.classList.contains('ql-editor')) {
            return this.extractTextWithNumbering(element);
        }
        
        // Use standard text extraction but clean up extra line breaks
        let text = element.innerText || element.textContent || '';
        
        // Replace multiple consecutive newlines with single newlines
        text = text.replace(/\n\s*\n+/g, '\n');
        
        // Trim whitespace from start and end
        text = text.trim();
        
        return text;
    }
    
    static extractTextWithNumbering(element) {
        // Mock implementation for testing - simulate the real extraction logic
        let result = '';
        let listCounter = 1;

        // Simulate processing ordered lists
        if (element.innerHTML.includes('<ol>')) {
            // Extract list items and format them as numbered text
            const listItems = element.innerHTML.match(/<li>([^<]+)<\/li>/g) || [];
            listItems.forEach(item => {
                const content = item.replace(/<[^>]*>/g, '').trim();
                if (content) {
                    result += `${listCounter}. ${content}\n`;
                    listCounter++;
                }
            });
        } else {
            // Regular text processing
            result = element.textContent || element.innerText || '';
        }

        return result.replace(/\n\s*\n+/g, '\n').trim();
    }
    
    static setTextWithFormatting(element, text) {
        // Clear the element
        element.innerHTML = '';
        element.children = [];
        element.childNodes = [];
        
        const lines = text.split('\n');
        let currentList = null;
        let currentListType = null;
        
        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return; // Skip empty lines
            
            // Check if this is a numbered list item
            const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
            if (numberedMatch) {
                const [, number, content] = numberedMatch;
                
                // Create or continue ordered list
                if (!currentList || currentListType !== 'ol') {
                    currentList = new MockElement('ol');
                    currentListType = 'ol';
                    element.appendChild(currentList);
                }
                
                const li = new MockElement('li');
                li.textContent = content;
                currentList.appendChild(li);
                return;
            }
            
            // Check if this is a bullet list item
            const bulletMatch = trimmedLine.match(/^[•·*-]\s+(.+)$/);
            if (bulletMatch) {
                const [, content] = bulletMatch;
                
                // Create or continue unordered list
                if (!currentList || currentListType !== 'ul') {
                    currentList = new MockElement('ul');
                    currentListType = 'ul';
                    element.appendChild(currentList);
                }
                
                const li = new MockElement('li');
                li.textContent = content;
                currentList.appendChild(li);
                return;
            }
            
            // Regular paragraph - reset list context
            currentList = null;
            currentListType = null;
            
            const p = new MockElement('p');
            p.textContent = trimmedLine;
            element.appendChild(p);
        });
        
        // Update innerHTML representation
        element.innerHTML = element.children.map(child => {
            if (child.tagName === 'p') {
                return `<p>${child.textContent}</p>`;
            } else if (child.tagName === 'ol') {
                const items = child.children.map(li => `<li>${li.textContent}</li>`).join('');
                return `<ol>${items}</ol>`;
            } else if (child.tagName === 'ul') {
                const items = child.children.map(li => `<li>${li.textContent}</li>`).join('');
                return `<ul>${items}</ul>`;
            }
            return '';
        }).join('');
    }
}

// Test functions
function testNumberedListExtraction() {
    console.log('🧪 Testing: Numbered list extraction from Slack rich editor');
    
    const element = new MockElement('div', 'ql-editor');
    element.innerHTML = '<ol><li>First item</li><li>Second item</li><li>Third item</li></ol>';
    element.textContent = '1. First item\n2. Second item\n3. Third item';
    
    const result = TextProcessor.getTextFromElement(element);
    const expected = '1. First item\n2. Second item\n3. Third item';
    
    if (result !== expected) {
        console.error('❌ FAIL: Numbered list extraction failed');
        console.error('Expected:', expected);
        console.error('Got:', result);
        return false;
    }
    
    console.log('✅ PASS: Numbered list extraction works correctly');
    return true;
}

function testBulletListInsertion() {
    console.log('🧪 Testing: Bullet list insertion into Slack rich editor');
    
    const element = new MockElement('div', 'ql-editor');
    const text = '• First bullet\n• Second bullet\n• Third bullet';
    
    TextProcessor.setTextWithFormatting(element, text);
    
    const ulElements = element.querySelectorAll('ol, ul');
    if (ulElements.length !== 1) {
        console.error('❌ FAIL: Expected 1 list element, got:', ulElements.length);
        return false;
    }
    
    if (!element.innerHTML.includes('<ul>') || !element.innerHTML.includes('<li>')) {
        console.error('❌ FAIL: HTML structure incorrect for bullet list');
        console.error('HTML:', element.innerHTML);
        return false;
    }
    
    console.log('✅ PASS: Bullet list insertion works correctly');
    return true;
}

function testNumberedListInsertion() {
    console.log('🧪 Testing: Numbered list insertion into Slack rich editor');
    
    const element = new MockElement('div', 'ql-editor');
    const text = '1. First item\n2. Second item\n3. Third item';
    
    TextProcessor.setTextWithFormatting(element, text);
    
    const olElements = element.querySelectorAll('ol, ul');
    if (olElements.length !== 1) {
        console.error('❌ FAIL: Expected 1 list element, got:', olElements.length);
        return false;
    }
    
    if (!element.innerHTML.includes('<ol>') || !element.innerHTML.includes('<li>')) {
        console.error('❌ FAIL: HTML structure incorrect for numbered list');
        console.error('HTML:', element.innerHTML);
        return false;
    }
    
    console.log('✅ PASS: Numbered list insertion works correctly');
    return true;
}

function testMixedContentInsertion() {
    console.log('🧪 Testing: Mixed content (paragraphs + lists) insertion');
    
    const element = new MockElement('div', 'ql-editor');
    const text = 'Introduction paragraph\n1. First item\n2. Second item\nConclusion paragraph';
    
    TextProcessor.setTextWithFormatting(element, text);
    
    const paragraphs = element.querySelectorAll('p');
    const lists = element.querySelectorAll('ol, ul');
    
    if (paragraphs.length !== 2) {
        console.error('❌ FAIL: Expected 2 paragraphs, got:', paragraphs.length);
        return false;
    }
    
    if (lists.length !== 1) {
        console.error('❌ FAIL: Expected 1 list, got:', lists.length);
        return false;
    }
    
    console.log('✅ PASS: Mixed content insertion works correctly');
    return true;
}

function testLineBreakCleaning() {
    console.log('🧪 Testing: Extra line break cleaning');
    
    const element = new MockElement('div', 'ql-editor');
    element.innerText = 'Line 1\n\n\nLine 2\n\n\n\nLine 3';
    
    const result = TextProcessor.getTextFromElement(element);
    const expected = 'Line 1\nLine 2\nLine 3';
    
    if (result !== expected) {
        console.error('❌ FAIL: Line break cleaning failed');
        console.error('Expected:', expected);
        console.error('Got:', result);
        return false;
    }
    
    console.log('✅ PASS: Line break cleaning works correctly');
    return true;
}

// Run all tests
function runAllTests() {
    console.log('🚀 Starting Formatting Preservation Tests...\n');
    
    const tests = [
        testNumberedListExtraction,
        testBulletListInsertion,
        testNumberedListInsertion,
        testMixedContentInsertion,
        testLineBreakCleaning
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
        console.log('🎉 All formatting preservation tests passed!');
    } else {
        console.log('⚠️ Some formatting tests failed. Please review the implementation.');
    }
    
    return failed === 0;
}

// Export for Node.js or run directly
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runAllTests };
    // Also run tests when executed directly with node
    if (require.main === module) {
        runAllTests();
    }
} else {
    runAllTests();
}
