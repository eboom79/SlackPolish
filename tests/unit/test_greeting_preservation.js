const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.join(__dirname, '../../slack-text-improver.js');
const source = fs.readFileSync(sourcePath, 'utf8');

const extractStandaloneGreetingMatch = source.match(/extractStandaloneGreeting\(text\)\s*\{([\s\S]*?)\n        \},\n\n        preserveLeadingGreeting/);
const preserveLeadingGreetingMatch = source.match(/preserveLeadingGreeting\(originalText, improvedText\)\s*\{([\s\S]*?)\n        \},\n\n        async improveText/);

if (!extractStandaloneGreetingMatch || !preserveLeadingGreetingMatch) {
    console.error('❌ Could not extract greeting preservation helpers from slack-text-improver.js');
    process.exit(1);
}

const context = {
    utils: {
        debug: () => {}
    }
};

const extractStandaloneGreeting = vm.runInNewContext(
    `(function(text) {${extractStandaloneGreetingMatch[1]}\n})`,
    context
);

context.extractStandaloneGreeting = extractStandaloneGreeting;

const preserveLeadingGreeting = vm.runInNewContext(
    `(function(originalText, improvedText) {${preserveLeadingGreetingMatch[1].replace(/this\.extractStandaloneGreeting/g, 'extractStandaloneGreeting')}\n})`,
    context
);

function runTest(name, testFn) {
    try {
        testFn();
        console.log(`✅ ${name}`);
    } catch (error) {
        console.error(`❌ ${name}`);
        console.error(`   ${error.message}`);
        process.exitCode = 1;
    }
}

runTest('Does not treat a full first sentence as a greeting', () => {
    const originalText = `Hi Vladimir, thanks for creating the initiative.
We don't accomodate several phases in 1 initiative as we want it to have a clear start and end.`;
    const improvedText = `Thanks for setting up the initiative, Vladimir. Just a heads up, we usually don't mix multiple phases in one initiative.`;

    assert.strictEqual(
        preserveLeadingGreeting(originalText, improvedText),
        improvedText,
        'A rewritten opening sentence should not have the original sentence prefixed back in'
    );
});

runTest('Restores a dropped standalone greeting line', () => {
    const originalText = `Hi Vladimir,
We should split this into separate epics.`;
    const improvedText = `We should split this into separate epics.`;

    assert.strictEqual(
        preserveLeadingGreeting(originalText, improvedText),
        `Hi Vladimir,\nWe should split this into separate epics.`
    );
});

runTest('Replaces a rewritten standalone greeting instead of duplicating it', () => {
    const originalText = `Hi Vladimir,
We should split this into separate epics.`;
    const improvedText = `Hello Vladimir,
We should split this into separate epics.`;

    assert.strictEqual(
        preserveLeadingGreeting(originalText, improvedText),
        `Hi Vladimir,\nWe should split this into separate epics.`
    );
});

if (process.exitCode) {
    process.exit(process.exitCode);
}
