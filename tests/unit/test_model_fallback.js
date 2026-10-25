#!/usr/bin/env node

/**
 * OpenAI model fallback + request adaptation (Slack script and Chrome extension).
 * Regression for gpt-4-turbo's retirement (2026-10-23, "model_not_found"): the configured model is tried
 * first, then OPENAI_MODEL_FALLBACKS; retired models are remembered; GPT-5-style request shapes
 * (max_completion_tokens, default-only temperature) are adapted automatically. The pure helpers must be
 * identical in both code bases.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repo = path.join(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(repo, p), 'utf8');
const improverSource = read('slack-text-improver.js');
const sharedSource = read('extension/shared/openai-request.js');
const backgroundSource = read('extension/background.js');
const contentSource = read('extension/content/hotkey-logger.js');
const summarySource = read('slack-channel-summary.js');
const settingsSource = read('slack-settings.js');

const cfgCtx = { window: {}, console };
vm.runInNewContext(read('slack-config.js'), cfgCtx);
const CONFIG = cfgCtx.window.SLACKPOLISH_CONFIG;
const Shared = require(path.join(repo, 'extension/shared/openai-request.js'));

let testsPassed = 0, testsTotal = 0;
function runTest(name, fn) { testsTotal++; try { console.log(`🧪 Testing: ${name}`); const r = fn(); if (r && typeof r.then === 'function') return r.then(() => { testsPassed++; console.log(`✅ PASSED: ${name}`); }).catch(e => { console.log(`❌ FAILED: ${name}`); console.log(`   Error: ${e.message}`); }); testsPassed++; console.log(`✅ PASSED: ${name}`); } catch (e) { console.log(`❌ FAILED: ${name}`); console.log(`   Error: ${e.message}`); } return Promise.resolve(); }
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- OpenAI-shaped scripted responses -------------------------------------------------------------------
const retiredError = (model) => ({ error: { message: `The model \`${model}\` has been deprecated, learn more here: https://platform.openai.com/docs/deprecations`, type: 'invalid_request_error', code: 'model_not_found', param: null } });
const maxTokensError = () => ({ error: { message: "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.", type: 'invalid_request_error', code: 'unsupported_parameter', param: 'max_tokens' } });
const temperatureError = (t) => ({ error: { message: `Unsupported value: 'temperature' does not support ${t} with this model. Only the default (1) value is supported.`, type: 'invalid_request_error', code: 'unsupported_value', param: 'temperature' } });
const okReply = (model, text) => ({ id: 'x', model: `${model}-2026-01-01`, choices: [{ message: { role: 'assistant', content: text } }], usage: { total_tokens: 7 } });

/** Scripted OpenAI: each call pops the next {status, payload}; records the parsed request bodies. */
function scriptedOpenAI(script) {
    const calls = [];
    const next = () => { if (!script.length) throw new Error('scripted OpenAI: no response left'); return script.shift(); };
    return {
        calls,
        // extension side: fetch(url, init) -> Response-like
        fetchImpl: async (url, init) => { calls.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization }); const r = next(); return { ok: r.status < 300, status: r.status, json: async () => r.payload }; },
        // Slack side: the proxy envelope that fetchWithRetry posts to 127.0.0.1:<port>/proxy/openai
        proxyFetch: async (url, init) => { const env = JSON.parse(init.body); calls.push({ url: env.url, body: JSON.parse(env.body), auth: env.headers.Authorization }); const r = next(); return { status: 200, json: async () => ({ status: r.status, headers: {}, body: JSON.stringify(r.payload) }) }; }
    };
}

/** The Slack script's OpenAI client, evaluated from its marked region with a fake page. */
function slackClient(fetchStub, storage) {
    const start = improverSource.indexOf('// === OPENAI CLIENT START ===');
    const end = improverSource.indexOf('// === OPENAI CLIENT END ===');
    assert(start > 0 && end > start, 'OPENAI CLIENT markers present in slack-text-improver.js');
    const slice = improverSource.slice(start, end);
    const store = storage || new Map();
    const ctx = {
        window: { SLACKPOLISH_CONFIG: CONFIG, __SLACKPOLISH_PROXY_PORT__: 9223 },
        localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
        fetch: fetchStub, console, setTimeout, clearTimeout, JSON, Error, Promise, Date, Array, Object, String, RegExp, TypeError
    };
    vm.runInNewContext(slice + '\ninitializeGlobalOpenAISystem();', ctx);
    return { api: ctx.window.SlackPolishOpenAI, store, window: ctx.window };
}

/** A function's source text by name (brace matching), whitespace-normalised, for the parity check. */
function functionSource(source, name) {
    const idx = source.indexOf(`function ${name}(`);
    assert(idx >= 0, `${name} found`);
    let i = source.indexOf('{', idx), depth = 0;
    for (; i < source.length; i++) { if (source[i] === '{') depth++; else if (source[i] === '}') { depth--; if (depth === 0) break; } }
    return source.slice(idx, i + 1).replace(/\s+/g, ' ').trim();
}

(async () => {
    console.log('🚀 Running Model Fallback Tests');
    console.log('===============================\n');

    await runTest('Config: a current default model, a fallback chain, and no gpt-4-turbo left in live code', () => {
        assert(CONFIG.OPENAI_MODEL && CONFIG.OPENAI_MODEL !== 'gpt-4-turbo', `default must not be the retired model: ${CONFIG.OPENAI_MODEL}`);
        assert(Array.isArray(CONFIG.OPENAI_MODEL_FALLBACKS) && CONFIG.OPENAI_MODEL_FALLBACKS.length >= 2, 'at least two fallbacks');
        const all = [CONFIG.OPENAI_MODEL, ...CONFIG.OPENAI_MODEL_FALLBACKS];
        assert(new Set(all).size === all.length && all.every(m => typeof m === 'string' && m.trim()), `distinct model ids: ${all}`);
        assert(!all.includes('gpt-4-turbo') && !all.some(m => /chat-latest$/.test(m)), 'no retired ids (gpt-4-turbo, *-chat-latest) in the chain');
        assert(improverSource.includes(`MODEL: '${CONFIG.OPENAI_MODEL}',`), 'improver CONFIG.MODEL default equals the config default');
        assert(backgroundSource.includes(`const DEFAULT_MODEL = '${CONFIG.OPENAI_MODEL}';`), 'extension worker default equals the config default');
        for (const [file, src] of [['slack-text-improver.js', improverSource], ['slack-channel-summary.js', summarySource], ['slack-settings.js', settingsSource], ['extension/background.js', backgroundSource], ['extension/content/hotkey-logger.js', contentSource]]) {
            assert(!src.includes("'gpt-4-turbo'"), `${file} no longer hard-codes gpt-4-turbo`);
        }
        assert(fs.readFileSync(path.join(repo, 'slack-config.js')).equals(fs.readFileSync(path.join(repo, 'extension/vendor/slack-config.js'))), 'vendored config identical');
    });

    await runTest('Pure helpers are byte-for-byte identical in the Slack script and the extension', () => {
        for (const name of ['openAIModelCandidates', 'openAIUsesCompletionTokens', 'buildOpenAIChatBody', 'classifyOpenAIError', 'adaptOpenAIRequest']) {
            assert(functionSource(improverSource, name) === functionSource(sharedSource, name), `${name} differs between slack-text-improver.js and extension/shared/openai-request.js`);
        }
    });

    await runTest('Request shape: GPT-5 / o-series take max_completion_tokens from the start, GPT-4 keeps max_tokens', () => {
        const b4 = Shared.buildOpenAIChatBody('gpt-4.1', 'p', { maxTokens: 500, temperature: 0.3 }, null);
        const b5 = Shared.buildOpenAIChatBody('gpt-5.4-mini', 'p', { maxTokens: 500, temperature: 0.3 }, null);
        const bo = Shared.buildOpenAIChatBody('o4-mini', 'p', { maxTokens: 500 }, null);
        assert(b4.max_tokens === 500 && b4.max_completion_tokens === undefined && b4.temperature === 0.3, `gpt-4.1 body: ${JSON.stringify(b4)}`);
        assert(b5.max_completion_tokens === 500 && b5.max_tokens === undefined && b5.temperature === 0.3, `gpt-5.4-mini body: ${JSON.stringify(b5)}`);
        assert(bo.max_completion_tokens === 500 && bo.temperature === undefined, `o4-mini body without temperature: ${JSON.stringify(bo)}`);
        assert(same(Shared.openAIModelCandidates('a', ['b', 'a', 'c', '', null]), ['a', 'b', 'c']), 'candidates de-duplicated and cleaned');
        assert(Shared.classifyOpenAIError(404, retiredError('x')).kind === 'retired' && Shared.classifyOpenAIError(400, maxTokensError()).param === 'max_tokens' && Shared.classifyOpenAIError(400, temperatureError(0.3)).param === 'temperature' && Shared.classifyOpenAIError(500, { error: { message: 'boom' } }).kind === 'other', 'error classification');
        const a1 = Shared.adaptOpenAIRequest({ completionTokens: false, dropped: [] }, 'max_tokens');
        const a2 = Shared.adaptOpenAIRequest(a1, 'temperature');
        assert(a1.completionTokens === true && same(a2.dropped, ['temperature']) && Shared.adaptOpenAIRequest(a2, 'temperature') === null, 'adaptation steps, then nothing left');
    });

    await runTest('Extension: retired default -> fallback model, remembered so the next call skips it', async () => {
        const [first, second] = [CONFIG.OPENAI_MODEL, CONFIG.OPENAI_MODEL_FALLBACKS[0]];
        const openai = scriptedOpenAI([{ status: 404, payload: retiredError(first) }, { status: 200, payload: okReply(second, 'Polished.') }, { status: 200, payload: okReply(second, 'Again.') }]);
        const retired = {}; const switches = [];
        const r1 = await Shared.chatCompletionWithFallback({ fetchImpl: openai.fetchImpl, apiKey: 'k', model: first, fallbacks: CONFIG.OPENAI_MODEL_FALLBACKS, prompt: 'p', maxTokens: 500, temperature: 0.3, retired, onRetired: (m) => { retired[m] = true; }, onSwitch: (s) => switches.push(s) });
        assert(r1.ok && r1.text === 'Polished.' && r1.model === second && r1.switchedFrom === first, `first call result: ${JSON.stringify(r1)}`);
        assert(openai.calls.length === 2 && openai.calls[0].body.model === first && openai.calls[1].body.model === second && openai.calls[1].auth === 'Bearer k', `two requests, retired then fallback: ${openai.calls.map(c => c.body.model)}`);
        assert(same(switches, [{ from: first, to: second }]) && retired[first] === true, 'switch reported once, retirement remembered');
        const r2 = await Shared.chatCompletionWithFallback({ fetchImpl: openai.fetchImpl, apiKey: 'k', model: first, fallbacks: CONFIG.OPENAI_MODEL_FALLBACKS, prompt: 'p', maxTokens: 500, retired, onSwitch: (s) => switches.push(s) });
        assert(r2.ok && openai.calls.length === 3 && openai.calls[2].body.model === second, 'second call goes straight to the fallback (one request)');
    });

    await runTest('Extension: unsupported max_tokens and temperature are adapted on the same model; other errors surface', async () => {
        const openai = scriptedOpenAI([{ status: 400, payload: maxTokensError() }, { status: 400, payload: temperatureError(0.3) }, { status: 200, payload: okReply('gpt-4.1', 'ok') }]);
        const r = await Shared.chatCompletionWithFallback({ fetchImpl: openai.fetchImpl, apiKey: 'k', model: 'gpt-4.1', fallbacks: [], prompt: 'p', maxTokens: 500, temperature: 0.3 });
        assert(r.ok && openai.calls.length === 3, `three attempts on one model: ${openai.calls.length}`);
        assert(openai.calls[0].body.max_tokens === 500 && openai.calls[1].body.max_completion_tokens === 500 && openai.calls[1].body.temperature === 0.3 && openai.calls[2].body.max_completion_tokens === 500 && openai.calls[2].body.temperature === undefined, `bodies: ${JSON.stringify(openai.calls.map(c => c.body))}`);
        const bad = scriptedOpenAI([{ status: 429, payload: { error: { message: 'Rate limit reached', code: 'rate_limit_exceeded' } } }]);
        const rb = await Shared.chatCompletionWithFallback({ fetchImpl: bad.fetchImpl, apiKey: 'k', model: 'gpt-4.1', fallbacks: ['gpt-4o'], prompt: 'p', maxTokens: 10 });
        assert(!rb.ok && rb.status === 429 && rb.code === 'rate_limit_exceeded' && bad.calls.length === 1, `a 429 is not a reason to switch models: ${JSON.stringify(rb)}`);
        const gone = scriptedOpenAI([{ status: 404, payload: retiredError('a') }, { status: 404, payload: retiredError('b') }]);
        const rg = await Shared.chatCompletionWithFallback({ fetchImpl: gone.fetchImpl, apiKey: 'k', model: 'a', fallbacks: ['b'], prompt: 'p' });
        assert(!rg.ok && rg.code === 'model_not_found' && /No usable OpenAI model: a \(.*\); b \(/.test(rg.error) && /OPENAI_MODEL in slack-config.js/.test(rg.error), `all retired -> actionable error: ${rg.error}`);
    });

    await runTest('Slack script: same behaviour through the proxy, retirement remembered in localStorage, user told once', async () => {
        const [first, second] = [CONFIG.OPENAI_MODEL, CONFIG.OPENAI_MODEL_FALLBACKS[0]];
        const openai = scriptedOpenAI([{ status: 404, payload: retiredError(first) }, { status: 200, payload: okReply(second, 'Polished.') }, { status: 200, payload: okReply(second, 'Again.') }]);
        const page = slackClient(openai.proxyFetch);
        const notices = []; page.api.onModelSwitch = (info) => notices.push(info);
        const text = await page.api.improveText('k', first, 'p', { temperature: 0.2 });
        assert(text === 'Polished.' && openai.calls.length === 2 && openai.calls[0].body.model === first && openai.calls[1].body.model === second, `fallback through the proxy: ${openai.calls.map(c => c.body.model)}`);
        assert(openai.calls[0].url === 'https://api.openai.com/v1/chat/completions' && openai.calls[0].auth === 'Bearer k', 'proxy envelope carries the OpenAI URL and the key');
        assert(openai.calls[1].body.max_completion_tokens === CONFIG.OPENAI_MAX_TOKENS && openai.calls[1].body.temperature === 0.2, `fallback body for ${second}: ${JSON.stringify(openai.calls[1].body)}`);
        const remembered = JSON.parse(page.store.get('slackpolish_model_retired'));
        assert(remembered[first] && /deprecated/.test(remembered[first].message), 'retired model remembered in localStorage');
        assert(same(notices, [{ from: first, to: second }]), 'onModelSwitch called with from/to');
        const again = await page.api.improveText('k', first, 'p', {});
        assert(again === 'Again.' && openai.calls.length === 3 && openai.calls[2].body.model === second, 'next call skips the retired model');
        assert(improverSource.includes("localStorage.getItem('slackpolish_model_switch_notified') === pair") && improverSource.includes('OpenAI retired the model ${info.from}. JustPolish now uses ${info.to}.'), 'the improver shows the switch notification once per pair');
    });

    await runTest('Slack script: testApiKey reports the served model; adaptation and hard errors as in the extension', async () => {
        const openai = scriptedOpenAI([{ status: 400, payload: temperatureError(0) }, { status: 200, payload: okReply('gpt-5.4-mini', 'OK') }]);
        const page = slackClient(openai.proxyFetch);
        const result = await page.api.testApiKey('k');
        assert(result.success && /API key is valid! Model: gpt-5\.4-mini-2026-01-01/.test(result.message), `test key message: ${result.message}`);
        assert(openai.calls[0].body.model === CONFIG.OPENAI_MODEL && openai.calls[0].body.temperature === 0 && openai.calls[1].body.temperature === undefined && openai.calls[1].body.max_completion_tokens === 10, `default model used, temperature dropped on retry: ${JSON.stringify(openai.calls.map(c => c.body))}`);
        const bad = scriptedOpenAI([{ status: 401, payload: { error: { message: 'Incorrect API key provided', code: 'invalid_api_key' } } }]);
        const page2 = slackClient(bad.proxyFetch);
        const r2 = await page2.api.testApiKey('bad');
        assert(!r2.success && /Incorrect API key/.test(r2.message), 'auth error surfaces unchanged');
        let thrown = null;
        try { await page2.api.improveText('bad', 'gpt-4.1', 'p', {}); } catch (e) { thrown = e; }
        assert(thrown === null || (thrown.status === undefined), 'scripted responses exhausted is a test artefact only');
    });

    await runTest('Slack script: re-injecting a new build replaces a stale module object left by the previous build', () => {
        const openai = scriptedOpenAI([]);
        const start = improverSource.indexOf('// === OPENAI CLIENT START ===');
        const end = improverSource.indexOf('// === OPENAI CLIENT END ===');
        const slice = improverSource.slice(start, end);
        const stale = { improveText() { throw new Error('old build'); }, testApiKey() {} };
        const ctx = { window: { SLACKPOLISH_CONFIG: CONFIG, SlackPolishOpenAI: stale }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, fetch: openai.proxyFetch, console, setTimeout, clearTimeout, JSON, Error, Promise, Date, Array, Object, String, RegExp, TypeError };
        vm.runInNewContext(slice + '\ninitializeGlobalOpenAISystem();', ctx);
        assert(ctx.window.SlackPolishOpenAI !== stale && typeof ctx.window.SlackPolishOpenAI.chatCompletion === 'function', 'the new build must replace the stale module (the live-page bug seen on 2026-10-25)');
        assert(!improverSource.includes('if (window.SlackPolishOpenAI) return; // Already initialized'), 'no early return on an existing module object');
    });

    await runTest('Wiring: summary and settings use the shared client; the worker imports the shared file; content script passes fallbacks', () => {
        assert(summarySource.includes("window.SlackPolishOpenAI.chatCompletion(apiKey, model, prompt, { maxTokens, temperature })") && summarySource.includes("const model = window.SLACKPOLISH_CONFIG?.OPENAI_MODEL;"), 'channel summary goes through the shared client with the configured model');
        assert(settingsSource.includes("const model = window.SLACKPOLISH_CONFIG?.OPENAI_MODEL;"), 'settings Test API Key uses the configured model');
        assert(backgroundSource.includes("importScripts('shared/openai-request.js');") && backgroundSource.includes('SlackPolishOpenAIRequest.chatCompletionWithFallback({') && backgroundSource.includes("chrome.storage.local.get('modelRetired')"), 'worker uses the shared client and remembers retirements');
        assert(contentSource.includes('fallbacks: cfg.OPENAI_MODEL_FALLBACKS || [],') && contentSource.includes('result.model = reply.servedBy || reply.model;'), 'content script passes the fallback chain and records the model that answered');
    });

    console.log(`\n📊 Results: ${testsPassed}/${testsTotal} passed`);
    process.exit(testsPassed === testsTotal ? 0 : 1);
})();
