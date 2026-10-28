# JustPolish v1.7.2 Release Notes

**Release Date:** October 28, 2026
**Build:** 2

## Works with Slack 4.53

Slack 4.53 (shipped around October 21, 2026) moved to Electron 45, which refuses
the remote-debugging flag JustPolish relies on unless Slack runs with a profile
directory outside its default one. Slack silently restarted itself without the
flag, so `JustPolish.app` waited for a DevTools endpoint that never appeared and
reported an unrelated Electron-fuse message. This release makes JustPolish start
Slack the way Electron 45 requires.

## What changed

### Slack runs on a dedicated JustPolish profile
- The launcher starts Slack with
  `--user-data-dir=~/Library/Application Support/SlackPolish Runtime/slack-profile`
  in addition to the remote-debugging flag
- On first use the profile is **seeded from your existing Slack profile** without
  caches, logs and lock files (about 3 MB instead of 1.6 GB): you stay signed in,
  and your JustPolish settings and OpenAI key carry over. An existing JustPolish
  profile is never overwritten
- Slack's own output for each launch is kept in `state/slack-stderr.log`; when
  the DevTools endpoint does not open, the launcher now reports the Slack and
  Electron versions and quotes Slack's message instead of guessing
- The installer explains the profile; the uninstaller removes it and leaves your
  regular Slack profile untouched

### What this means day to day
- With JustPolish running, clicking Slack in the Dock focuses that Slack, as
  before
- Starting Slack *without* JustPolish uses the regular profile; preferences you
  change there do not appear in the JustPolish profile, and vice versa
- The Electron fuse patcher is no longer part of any recommended path; it remains
  as a troubleshooting tool only

## Upgrading

### macOS Apple Silicon
```bash
python3 installers/install-slack-MAC-ARM.py
```
Quit Slack fully (Cmd+Q), then click `JustPolish.app` once. The first start seeds
the profile and takes a few seconds longer.

### Chrome extension
Unchanged in this release. If you skipped v1.7.1, click **Reload** on the
JustPolish card in `chrome://extensions`.

## Verification

- `node tests/run-all-tests.js` (47/47; new `tests/installer/test_launcher_profile_dir.js`)
- Live: from a cold Slack 4.53.269, `JustPolish.app` relaunches Slack on the
  dedicated profile, DevTools answers within a second, the workspace is signed in
  and the runtime is injected
