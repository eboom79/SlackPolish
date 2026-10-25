/**
 * OpenAI chat-completion client for the extension worker: model fallback + request-shape adaptation.
 *
 * OpenAI retires models on a schedule (gpt-4-turbo stopped on 2026-10-23 with "model_not_found"). The
 * configured model is tried first, then the fallbacks in order; the caller remembers a model seen retired so
 * the next call goes straight to a working one. Newer models reject `max_tokens` (they take
 * `max_completion_tokens`) or a non-default `temperature`: such 400s are answered by adapting the request
 * and retrying the same model.
 *
 * The pure helpers (openAIModelCandidates, openAIUsesCompletionTokens, buildOpenAIChatBody,
 * classifyOpenAIError, adaptOpenAIRequest) are byte-for-byte the same as in slack-text-improver.js;
 * tests/unit/test_model_fallback.js asserts that.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.SlackPolishOpenAIRequest = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function openAIModelCandidates(model, fallbacks) {
        const list = [model].concat(Array.isArray(fallbacks) ? fallbacks : []);
        return list.filter((m, i) => typeof m === 'string' && m.trim() && list.indexOf(m) === i);
    }

    function openAIUsesCompletionTokens(model) {
        return /^(gpt-5|o\d)/i.test(String(model || ''));
    }

    function buildOpenAIChatBody(model, prompt, options, adaptations) {
        const body = { model, messages: [{ role: 'user', content: prompt }] };
        const limit = options && options.maxTokens;
        if (limit) {
            const useCompletionTokens = (adaptations && adaptations.completionTokens) || openAIUsesCompletionTokens(model);
            const key = useCompletionTokens ? 'max_completion_tokens' : 'max_tokens';
            if (!(adaptations && adaptations.dropped && adaptations.dropped.includes(key))) body[key] = limit;
        }
        if (options && typeof options.temperature === 'number' && !(adaptations && adaptations.dropped && adaptations.dropped.includes('temperature'))) {
            body.temperature = options.temperature;
        }
        return body;
    }

    function classifyOpenAIError(status, errorData) {
        const error = (errorData && errorData.error) || {};
        const message = error.message || ('HTTP ' + status);
        const code = error.code || error.type || null;
        if (code === 'model_not_found' || /has been deprecated|no longer supported|has been retired|does not exist/i.test(message)) {
            return { kind: 'retired', message, code: 'model_not_found' };
        }
        if (code === 'unsupported_parameter' || code === 'unsupported_value') {
            const match = /'([A-Za-z_]+)'/.exec(message);
            return { kind: 'unsupported', param: error.param || (match ? match[1] : null), message, code };
        }
        return { kind: 'other', message, code };
    }

    function adaptOpenAIRequest(adaptations, param) {
        const next = { completionTokens: !!(adaptations && adaptations.completionTokens), dropped: ((adaptations && adaptations.dropped) || []).slice() };
        if (param === 'max_tokens' && !next.completionTokens) next.completionTokens = true;
        else if (param && !next.dropped.includes(param)) next.dropped.push(param);
        else return null; // nothing left to adapt for this model
        return next;
    }

    /**
     * One chat completion with fallback and adaptation.
     * @param {object} p { fetchImpl?, apiBase?, apiKey, model, fallbacks?, prompt, maxTokens?, temperature?, timeoutMs?,
     *                     retired? (map model -> truthy), onRetired?(model, message), onSwitch?({from, to}) }
     * @returns {Promise<{ok: true, text, model, servedBy, usage, switchedFrom?} | {ok: false, error, status?, code?, model?, network?}>}
     */
    async function chatCompletionWithFallback(p) {
        const fetchImpl = p.fetchImpl || fetch;
        const apiBase = String(p.apiBase || 'https://api.openai.com/v1').replace(/\/$/, '');
        const apiKey = p.apiKey;
        const all = openAIModelCandidates(p.model, p.fallbacks);
        const retired = p.retired || {};
        let candidates = all.filter(m => !retired[m]);
        if (!candidates.length) candidates = all; // everything we know is retired: try anyway
        const tried = [];
        for (const candidate of candidates) {
            let adaptations = { completionTokens: false, dropped: [] };
            for (let attempt = 0; attempt < 4; attempt++) {
                const body = buildOpenAIChatBody(candidate, p.prompt, { maxTokens: p.maxTokens, temperature: p.temperature }, adaptations);
                const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
                const timer = controller ? setTimeout(() => controller.abort(), p.timeoutMs || 45000) : null;
                let response;
                try {
                    response = await fetchImpl(`${apiBase}/chat/completions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                        body: JSON.stringify(body),
                        signal: controller ? controller.signal : undefined
                    });
                } catch (error) {
                    return { ok: false, network: true, model: candidate, error: error && error.name === 'AbortError' ? 'The model request timed out' : String((error && error.message) || error) };
                } finally {
                    if (timer) clearTimeout(timer);
                }
                if (response.ok) {
                    const data = await response.json();
                    const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
                    if (!text || !text.trim()) return { ok: false, model: candidate, error: 'Empty response from the model' };
                    const result = { ok: true, text, model: candidate, servedBy: data.model || candidate, usage: data.usage || null };
                    if (candidate !== all[0]) {
                        result.switchedFrom = all[0];
                        if (p.onSwitch) await p.onSwitch({ from: all[0], to: candidate });
                    }
                    return result;
                }
                let errorData = {};
                try { errorData = await response.json(); } catch (error) { errorData = {}; }
                const problem = classifyOpenAIError(response.status, errorData);
                if (problem.kind === 'retired') {
                    tried.push(`${candidate} (${problem.message})`);
                    if (p.onRetired) await p.onRetired(candidate, problem.message);
                    break;
                }
                if (problem.kind === 'unsupported') {
                    const next = adaptOpenAIRequest(adaptations, problem.param);
                    if (next) { adaptations = next; continue; }
                }
                return { ok: false, error: problem.message, status: response.status, code: problem.code, model: candidate };
            }
        }
        return { ok: false, status: 404, code: 'model_not_found', error: `No usable OpenAI model: ${tried.join('; ') || all.join(', ')}. Set OPENAI_MODEL in slack-config.js to a current model.` };
    }

    return { openAIModelCandidates, openAIUsesCompletionTokens, buildOpenAIChatBody, classifyOpenAIError, adaptOpenAIRequest, chatCompletionWithFallback };
});
