# 🤝 Contributing to SlackPolish (Internal Redis Enterprise Tool)

Thank you for your interest in contributing to SlackPolish! This document provides guidelines for Redis Enterprise team members contributing to this internal productivity tool.

## 📋 Table of Contents
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Testing](#testing)
- [Code Style](#code-style)
- [Submitting Changes](#submitting-changes)
- [Reporting Issues](#reporting-issues)

## 🚀 Getting Started

SlackPolish is an internal Redis Enterprise tool for AI-powered text enhancement in Slack Desktop. Before contributing, please:

1. **Read the README.md** to understand the project
2. **Check existing issues** to see if your idea/bug is already being discussed
3. **Test the current version** to understand how it works
4. **Review the code structure** to understand the architecture

## 🛠️ Development Setup

### **Prerequisites:**
- Python 3.6+ (for installers)
- Node.js and npm (for asar tool)
- Slack Desktop App (for testing)
- OpenAI API key (for functionality testing)

### **Setup Steps:**
```bash
# Clone the repository (requires Redis Enterprise GitHub access)
git clone https://github.com/redis-enterprise/SlackPolish.git
cd SlackPolish

# Install dependencies
npm install

# Copy and configure settings
cp slack-config.js slack-config-personal.js
# Edit slack-config-personal.js with your API key
```

### **Project Structure:**
```
SlackPolish/
├── slack-text-improver.js       # Main script
├── slack-config.js              # Configuration template
├── logo-data.js                 # Logo data
├── installers/                  # Platform installers
├── tests/                       # Test suite
├── docs/                        # Documentation
└── assets/                      # Visual assets
```

## 🧪 Testing

### **Running Tests:**
```bash
# Run all tests
cd tests
node run-all-tests.js

# Run specific test category
node unit/test_branding_integration.js
node api/test_api_key_validation.js
```

### **Test Categories:**
- **Unit Tests:** Core functionality testing
- **API Tests:** OpenAI integration testing
- **Installer Tests:** Platform installer validation
- **Settings Tests:** Configuration and persistence testing

### **Adding New Tests:**
1. Create test file in appropriate directory (`tests/unit/`, `tests/api/`, etc.)
2. Follow existing test patterns and naming conventions
3. Ensure tests are comprehensive and cover edge cases
4. Update `run-all-tests.js` to include new test file

## 📝 Code Style

### **JavaScript Guidelines:**
- Use consistent indentation (4 spaces)
- Use meaningful variable and function names
- Add comments for complex logic
- Follow existing code patterns
- Use modern JavaScript features appropriately

### **Python Guidelines (Installers):**
- Follow PEP 8 style guidelines
- Use descriptive function and variable names
- Add docstrings for functions
- Handle errors gracefully with user-friendly messages

### **Documentation:**
- Update README.md for user-facing changes
- Update VERSION-HISTORY.md for releases
- Add inline comments for complex code
- Update test documentation when adding tests

## 🔄 Submitting Changes

### **Pull Request Process:**
1. **Fork the repository** and create a feature branch
2. **Make your changes** following the code style guidelines
3. **Add/update tests** for your changes
4. **Run the test suite** and ensure all tests pass
5. **Update documentation** as needed
6. **Submit a pull request** with a clear description

### **Pull Request Guidelines:**
- **Clear title:** Describe what the PR does
- **Detailed description:** Explain the changes and why they're needed
- **Test results:** Include test output showing all tests pass
- **Breaking changes:** Clearly document any breaking changes
- **Screenshots:** Include screenshots for UI changes

### **Commit Message Format:**
```
type(scope): brief description

Detailed explanation of changes if needed

- List specific changes
- Include any breaking changes
- Reference issue numbers if applicable
```

**Types:** feat, fix, docs, style, refactor, test, chore

## 🐛 Reporting Issues

### **Bug Reports:**
Please include:
- **Operating System:** Linux/macOS/Windows version
- **Slack Version:** Desktop app version
- **SlackPolish Version:** Which version you're using
- **Steps to Reproduce:** Clear steps to reproduce the issue
- **Expected Behavior:** What should happen
- **Actual Behavior:** What actually happens
- **Error Messages:** Any error messages or logs
- **Screenshots:** If applicable

### **Feature Requests:**
Please include:
- **Clear description:** What feature you'd like to see
- **Use case:** Why this feature would be useful
- **Proposed implementation:** Ideas for how it could work
- **Alternatives considered:** Other approaches you've thought about

## 🔒 Security

### **Security Issues:**
- **Do not** open public issues for security vulnerabilities
- **Contact maintainers** directly for security concerns
- **Provide details** about the vulnerability and potential impact

### **API Key Security:**
- **Never commit** API keys or sensitive configuration
- **Use** `slack-config-personal.js` for local development
- **Ensure** `.gitignore` excludes sensitive files

## 📚 Resources

### **Helpful Links:**
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Slack Desktop App](https://slack.com/downloads)
- [Electron Documentation](https://www.electronjs.org/docs)
- [Node.js ASAR Documentation](https://github.com/electron/asar)

### **Development Tools:**
- **Code Editor:** VS Code with JavaScript/Python extensions
- **Testing:** Node.js for test runner
- **Debugging:** Browser developer tools (F12 in Slack)

## 🎯 Contribution Areas

We welcome contributions in these areas:
- **🐛 Bug fixes** and stability improvements
- **✨ New features** and enhancements
- **📚 Documentation** improvements
- **🧪 Test coverage** expansion
- **🌍 Internationalization** and localization
- **🎨 UI/UX** improvements
- **⚡ Performance** optimizations

## 📞 Getting Help

- **GitHub Issues:** For bugs and feature requests
- **Discussions:** For questions and general discussion
- **Documentation:** Check README.md and docs/ directory

Thank you for contributing to SlackPolish! 🚀
