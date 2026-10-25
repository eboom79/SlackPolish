/**
 * Minimal Chrome DevTools Protocol client for the live Slack E2E suite.
 * Uses Node's built-in WebSocket (Node >= 22). No dependencies.
 */

export class CDP {
    constructor(ws) {
        this.ws = ws;
        this.nextId = 1;
        this.pending = new Map();
        this.consoleLogs = [];
        this.ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.method === 'Runtime.consoleAPICalled') {
                const describe = (a) => {
                    if (a.value !== undefined) return String(a.value);
                    if (a.preview && Array.isArray(a.preview.properties)) return '{' + a.preview.properties.map(p => `${p.name}: ${p.value}`).join(', ') + '}';
                    return a.description || '';
                };
                const text = (msg.params.args || []).map(describe).join(' ');
                this.consoleLogs.push({ t: Date.now(), text: text.slice(0, 900) });
                if (this.consoleLogs.length > 500) this.consoleLogs.shift();
                return;
            }
            if (msg.id && this.pending.has(msg.id)) {
                const { resolve, reject } = this.pending.get(msg.id);
                this.pending.delete(msg.id);
                if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
                else resolve(msg.result);
            }
        };
    }

    /** Connect to the first page target whose URL matches `match`. */
    static async connect({ port = 9222, match = /app\.slack\.com/ } = {}) {
        let targets;
        try {
            targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
        } catch (error) {
            throw new Error(`Cannot reach Slack's DevTools endpoint on 127.0.0.1:${port}. Is Slack running via the SlackPolish launcher? (${error.message})`);
        }
        const page = targets.find(t => t.type === 'page' && match.test(t.url));
        if (!page) {
            throw new Error(`No Slack page target found on port ${port}. Targets: ${targets.map(t => t.url).join(', ') || 'none'}`);
        }
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error('WebSocket connection failed')); });
        const cdp = new CDP(ws);
        await cdp.send('Runtime.enable');
        return cdp;
    }

    send(method, params = {}) {
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    /** Evaluate `expression` in the page; returns the JSON value. Throws on exception. */
    async evaluate(expression, { awaitPromise = false } = {}) {
        const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
        if (result.exceptionDetails) {
            const text = result.exceptionDetails.exception?.description || result.exceptionDetails.text;
            throw new Error(`Page evaluation failed: ${text}`);
        }
        return result.result?.value;
    }

    close() {
        try { this.ws.close(); } catch { /* ignore */ }
    }
}

export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
