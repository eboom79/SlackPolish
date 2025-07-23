# SlackPolish Test Vector System

## 🎯 **Overview**

The Test Vector System is a new testing layer that validates **actual function behavior** using predefined input/output pairs. This complements the existing static code analysis tests by testing the **runtime behavior** of functions.

## 🏗️ **Architecture**

### **Test Framework** (`tests/framework/test-vector-runner.js`)
- **TestVectorRunner class** - Core framework for running input/output tests
- **Synchronous & Asynchronous support** - Handles both sync and async functions
- **Deep equality checking** - Compares complex objects and arrays
- **Detailed reporting** - Shows exactly what failed and why

### **Test Categories**

#### **1. Text Processing Tests** (`tests/vector/test_text_processing_vectors.js`)
Tests functions that transform, sanitize, or validate text:

- **`anonymizeText()`** - Removes sensitive information (emails, phones, names, URLs)
- **`sanitizeText()`** - Cleans text for API processing (normalizes whitespace, replaces mentions)
- **`formatContextForAI()`** - Formats conversation context for AI prompts
- **`validateApiKey()`** - Validates OpenAI API key format

#### **2. Configuration Processing Tests** (`tests/vector/test_config_processing_vectors.js`)
Tests functions that handle settings and configuration:

- **`parseSettings()`** - Parses JSON settings with error handling
- **`validateLanguage()`** - Validates supported languages
- **`validateStyle()`** - Validates text improvement styles
- **`validateHotkey()`** - Validates keyboard shortcuts
- **`mergeSettings()`** - Merges user settings with defaults
- **`buildPromptConfig()`** - Builds configuration for AI prompts

## 📊 **Test Vector Examples**

### **Text Anonymization**
```javascript
const anonymizeTestVectors = [
    {
        input: "Hey @john, email me at john.doe@company.com",
        expected: "Hey @User, email me at email@domain.com"
    },
    {
        input: "Call me at 555-123-4567",
        expected: "Call me at XXX-XXX-XXXX"
    }
];
```

### **Settings Validation**
```javascript
const validateLanguageTestVectors = [
    {
        input: "english",
        expected: { valid: true, normalized: "ENGLISH", error: null }
    },
    {
        input: "invalid",
        expected: { 
            valid: false, 
            error: "Invalid language. Must be one of: ENGLISH, SPANISH, FRENCH..." 
        }
    }
];
```

### **Configuration Parsing**
```javascript
const parseSettingsTestVectors = [
    {
        input: '{"language": "SPANISH", "style": "PROFESSIONAL"}',
        expected: {
            success: true,
            settings: { language: "SPANISH", style: "PROFESSIONAL", /* ...defaults */ },
            error: null
        }
    }
];
```

## 🚀 **Running Test Vectors**

### **Individual Test Files**
```bash
# Run text processing tests
node tests/vector/test_text_processing_vectors.js

# Run configuration tests
node tests/vector/test_config_processing_vectors.js
```

### **All Tests (Including Vectors)**
```bash
# Run complete test suite
node tests/run-all-tests.js
```

### **Sample Output**
```
🧪 Testing: Text Anonymization
   Vectors: 6
   ✅ Vector 1: PASSED
   ✅ Vector 2: PASSED
   ❌ Vector 3: FAILED
      Input: "test@example.com"
      Expected: "email@domain.com"
      Got: "test@example.com"

📊 TEST VECTOR SUMMARY
Total Test Vectors: 21
✅ Passed: 20
❌ Failed: 1
📈 Success Rate: 95%
```

## 🎯 **Benefits of Test Vectors**

### **1. Behavior Validation**
- Tests **actual function output** vs just code existence
- Catches **logic errors** that static analysis misses
- Validates **edge cases** and error handling

### **2. Regression Detection**
- Immediately detects when function behavior changes
- Prevents **silent failures** in text processing
- Ensures **consistent output** across code changes

### **3. Documentation**
- Test vectors serve as **living documentation**
- Show **expected behavior** for each function
- Provide **usage examples** for developers

### **4. CI/CD Integration**
- **Fast execution** - No external dependencies
- **Deterministic results** - Same input always produces same output
- **Clear failure reporting** - Shows exactly what broke

## 🔧 **Adding New Test Vectors**

### **1. Create Test Function**
```javascript
static myFunction(input) {
    // Your function logic
    return processedOutput;
}
```

### **2. Define Test Vectors**
```javascript
const myTestVectors = [
    {
        input: "test input",
        expected: "expected output"
    },
    {
        input: { complex: "object" },
        expected: { processed: "result" }
    }
];
```

### **3. Run Tests**
```javascript
runner.runTestVectors(
    'My Function Tests',
    MyClass.myFunction,
    myTestVectors
);
```

## 📈 **Current Coverage**

- **Text Processing**: 21 test vectors (100% pass rate)
- **Configuration Processing**: 24 test vectors (100% pass rate)
- **Total**: 45 test vectors across 10 functions
- **Integration**: Seamlessly integrated with existing 17 static tests

## 🎉 **Results**

The Test Vector System has already **caught real bugs**:
- Fixed text sanitization truncation logic
- Improved error message consistency
- Validated edge case handling

This creates a **robust two-layer testing approach**:
1. **Static Analysis** - Ensures code structure and patterns exist
2. **Behavior Testing** - Validates actual function behavior and output

Perfect for **CI/CD integration** and **continuous quality assurance**!
