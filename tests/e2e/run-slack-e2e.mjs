#!/usr/bin/env node
/**
 * SlackPolish live end-to-end suite.
 *
 * Drives the REAL Slack desktop app (via the DevTools port opened by the
 * SlackPolish launcher), types each scenario into the composer of the
 * configured conversation, fires the real SlackPolish hotkey (a real OpenAI
 * call), and checks invariants on the resulting composer DOM.
 *
 *   node tests/e2e/run-slack-e2e.mjs                 # run everything
 *   node tests/e2e/run-slack-e2e.mjs --dry-run       # compose + read + clear, no polish (no API cost)
 *   node tests/e2e/run-slack-e2e.mjs --only jira-slug-pill,quote-and-reply
 *   node tests/e2e/run-slack-e2e.mjs --list
 *
 * Safety: never sends a message (no bare Enter), refuses to run unless the
 * visible composer's aria-label matches the configured conversation, refuses
 * to destroy an existing draft unless --clear-first, and verifies after every
 * scenario that the conversation's message count did not change.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CDP, sleep } from './lib/cdp.mjs';
import { Composer } from './lib/composer.mjs';
import { scenarios } from './scenarios.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, def) => { const i = args.indexOf(name); return i !== -1 && args[i + 1] ? args[i + 1] : def; };

const configPath = fs.existsSync(path.join(here, 'slack-e2e.local.json')) ? path.join(here, 'slack-e2e.local.json') : path.join(here, 'slack-e2e.config.json');
const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
const PORT = Number(opt('--port', config.port || 9222));
const COMPOSER_LABEL = opt('--composer-label', config.composerLabel || 'Message to ');
const DRY_RUN = flag('--dry-run');
const CLEAR_FIRST = flag('--clear-first');
const KEEP = flag('--keep');
const PAUSE_MS = Number(opt('--pause-ms', config.pauseMs || 1500));
const ONLY = opt('--only', '') ? opt('--only', '').split(',').map(s => s.trim()) : null;

if (flag('--list')) {
    for (const s of scenarios) console.log(`${s.id.padEnd(30)} ${s.title}`);
    process.exit(0);
}

const log = (...a) => console.log(...a);
const short = (s, n = 110) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n) + ((s || '').length > n ? '…' : '');

async function runStep(composer, step) {
    switch (step.type) {
        case 'type': await composer.type(step.text, step.delayMs ? { delayMs: step.delayMs } : {}); return { ok: true };
        case 'html': await composer.setHtml(step.html); return { ok: true };
        case 'newline': await composer.newline(); return { ok: true };
        case 'tab': await composer.tab(); return { ok: true };
        case 'backspace': await composer.backspace(); return { ok: true };
        case 'paste': await composer.paste(step.text); return { ok: true };
        case 'waitFor': {
            const ok = await composer.waitForComposer(step.js, { timeoutMs: step.timeoutMs || 8000 });
            if (!ok && !step.optional) return { ok: false, reason: `timed out waiting for ${step.what}` };
            return { ok: true, note: ok ? `${step.what}: yes` : `${step.what}: no (optional)` };
        }
        case 'require': {
            const ok = await composer.waitForComposer(step.js, { timeoutMs: 500 });
            return ok ? { ok: true } : { ok: false, reason: `precondition missing: ${step.what}` };
        }
        case 'select': {
            const r = await composer.select(step.text);
            return r.ok ? { ok: true, note: `selected "${short(r.selected, 50)}"` } : { ok: false, reason: `select failed: ${r.reason}` };
        }
        default: return { ok: false, reason: `unknown step ${step.type}` };
    }
}

function evaluateChecks(list, before, after, ctx) {
    return list.map(fn => { try { const r = fn(before, after, ctx); return { ok: !!r.ok, detail: r.detail }; } catch (e) { return { ok: false, detail: `check threw: ${e.message}` }; } });
}

async function main() {
    const cdp = await CDP.connect({ port: PORT });
    const composer = new Composer(cdp, { composerLabel: COMPOSER_LABEL, log });
    const results = [];
    let aborted = null;
    try {
        const info = await composer.assertTarget();
        log(`Slack window : ${info.title}`);
        log(`Composer     : "${info.ariaLabel}"`);
        log(`SlackPolish  : injected=${info.slackPolishInjected} apiKey=${info.hasApiKey} style=${info.settings.style || info.settings.improveStyle || '?'} hotkey=${info.settings.improveHotkey || 'Ctrl+Shift'}`);
        if (!info.slackPolishInjected) throw new Error('SlackPolish is not injected into this Slack page (start it via SlackPolish.app).');
        if (!DRY_RUN && !info.hasApiKey) throw new Error('No OpenAI API key configured in SlackPolish settings (F12).');
        if (!info.isEmpty) {
            if (!CLEAR_FIRST) throw new Error('The composer already contains a draft. Clear it, or re-run with --clear-first to discard it.');
            log('Composer has a draft — clearing it (--clear-first).');
            await composer.clear();
        }
        const hotkey = info.settings.improveHotkey || 'Ctrl+Shift';
        const selected = ONLY ? scenarios.filter(s => ONLY.includes(s.id)) : scenarios;
        if (ONLY && selected.length !== ONLY.length) throw new Error(`Unknown scenario id(s): ${ONLY.filter(id => !scenarios.some(s => s.id === id)).join(', ')}`);
        log(`\nRunning ${selected.length} scenario(s)${DRY_RUN ? ' [DRY RUN — no polish]' : ''}\n`);

        for (const scenario of selected) {
            const t0 = Date.now();
            const result = { id: scenario.id, title: scenario.title, status: 'PASS', notes: [], hard: [], soft: [] };
            results.push(result);
            log(`▶ ${scenario.id} — ${scenario.title}`);
            try {
                const messagesBefore = await composer.messageCount();
                await composer.assertTarget();
                await composer.focus();
                for (const step of scenario.steps) {
                    const r = await runStep(composer, step);
                    if (r.note) result.notes.push(r.note);
                    if (!r.ok) { result.status = 'SKIP'; result.notes.push(r.reason); break; }
                }
                if (result.status === 'SKIP') {
                    log(`  ⏭  skipped: ${result.notes[result.notes.length - 1]}`);
                } else {
                    const before = await composer.snapshot();
                    result.before = { text: before.text, html: before.html, counts: before.counts, slugs: before.slugs, anchors: before.anchors, mentions: before.mentions };
                    log(`  in : ${short(before.lines.join(' ⏎ '))}`);
                    if (DRY_RUN) {
                        log(`  dom: ${JSON.stringify(before.counts)}${before.slugs.length ? ' slugs=' + JSON.stringify(before.slugs.map(s => s.url)) : ''}`);
                    } else {
                        await composer.focus();
                        await composer.pressHotkey(hotkey);
                        const polish = await composer.waitForPolish();
                        result.polish = polish;
                        if (!polish.triggered) throw new Error(`hotkey did not trigger a polish (state=${polish.finalState}${polish.toasts.length ? ', toasts: ' + polish.toasts.join(' | ') : ''})`);
                        const after = await composer.snapshot();
                        result.after = { text: after.text, html: after.html, counts: after.counts, slugs: after.slugs, anchors: after.anchors, mentions: after.mentions };
                        log(`  out: ${short(after.lines.join(' ⏎ '))}  (${(polish.durationMs / 1000).toFixed(1)}s)`);
                        const globalHard = [
                            { ok: polish.finalState === 'active', detail: `polish state: ${polish.finalState}${polish.toasts.length ? ' toasts: ' + polish.toasts.join(' | ') : ''}` },
                            { ok: after.text.trim().length > 0, detail: 'output not empty' },
                            { ok: !after.leaks, detail: after.leaks ? 'TOKEN LEAK: __SLACKPOLISH_ in composer' : 'no token leak' }
                        ];
                        result.hard = [...globalHard, ...evaluateChecks(scenario.invariants, before, after)];
                        result.soft = evaluateChecks(scenario.expectations, before, after);
                        const messagesAfter = await composer.messageCount();
                        result.hard.push({ ok: messagesAfter === messagesBefore, detail: messagesAfter === messagesBefore ? 'nothing was sent' : `MESSAGE COUNT CHANGED ${messagesBefore} -> ${messagesAfter}` });
                        for (const h of result.hard) log(`  ${h.ok ? '✅' : '❌'} ${h.detail}`);
                        for (const s of result.soft) log(`  ${s.ok ? '☑️ ' : '▫️ '} (soft) ${s.detail}`);
                        if (result.hard.some(h => !h.ok)) result.status = 'FAIL';
                        if (messagesAfter !== messagesBefore) { aborted = 'message count changed — stopping to avoid sending anything else'; }
                    }
                }
            } catch (error) {
                result.status = 'ERROR';
                result.error = error.message;
                log(`  💥 ${error.message}`);
            }
            result.durationMs = Date.now() - t0;
            if (aborted) break;
            if (KEEP && result.status !== 'PASS' && result.status !== 'SKIP') { log('  (--keep: leaving composer content in place for inspection; stopping)'); break; }
            try { await composer.clear(); } catch (e) { log(`  ⚠️ could not clear composer: ${e.message}`); }
            await sleep(PAUSE_MS);
        }
    } catch (error) {
        log(`\n💥 ${error.message}`);
        process.exitCode = 2;
    } finally {
        cdp.close();
    }

    const counts = results.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
    log('\n================ SUMMARY ================');
    for (const r of results) log(`${r.status.padEnd(5)} ${r.id.padEnd(30)} ${r.hard.filter(h => !h.ok).map(h => h.detail).join('; ') || r.error || ''}`);
    log(`\nPASS ${counts.PASS || 0}  FAIL ${counts.FAIL || 0}  ERROR ${counts.ERROR || 0}  SKIP ${counts.SKIP || 0}${aborted ? `\nABORTED: ${aborted}` : ''}`);
    const reportsDir = path.join(here, 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });
    const reportPath = path.join(reportsDir, `${new Date().toISOString().replace(/[:.]/g, '-')}${DRY_RUN ? '-dry' : ''}.json`);
    fs.writeFileSync(reportPath, JSON.stringify({ ranAt: new Date().toISOString(), dryRun: DRY_RUN, results }, null, 2));
    log(`report: ${path.relative(process.cwd(), reportPath)}`);
    if ((counts.FAIL || 0) + (counts.ERROR || 0) > 0 || aborted) process.exitCode = 1;
}

main();
