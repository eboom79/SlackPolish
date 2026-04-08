# macOS Runtime Launcher

This is the new macOS support architecture for SlackPolish.

It does **not** modify:
- `Slack.app`
- `app-arm64.asar`
- `Info.plist`

Instead, it launches Slack with a Chrome DevTools remote debugging port and
injects SlackPolish into Slack's real web page at runtime.

## Why

The previous macOS installer path rewrote Slack's packaged `app-arm64.asar`.
We proved that even a repack-only replacement of that archive changes Slack's
startup/auth behavior on current Slack for macOS.

This launcher avoids that entire class of problems by leaving the signed app
bundle untouched.

## File

Launcher script:

- `installers/launch-slackpolish-MAC-ARM.py`

## What it does

1. Starts Slack with `--remote-debugging-port=<port>`
2. Polls Slack's DevTools HTTP endpoint
3. Attaches to Slack page targets over the DevTools WebSocket protocol
4. Installs SlackPolish into future documents with:
   - `Page.addScriptToEvaluateOnNewDocument`
5. Immediately evaluates SlackPolish in the current page with:
   - `Runtime.evaluate`

The injected script only activates on real workspace URLs:

- `https://app.slack.com/client/...`

It skips Slack's non-workspace pages such as login / landing shells.

## Usage

Launch Slack and keep the injector running:

```bash
python3 installers/launch-slackpolish-MAC-ARM.py --relaunch -v
```

Attach to an already-running Slack debug port without launching Slack:

```bash
python3 installers/launch-slackpolish-MAC-ARM.py --attach-only --debug-port 9222 -v
```

Use a specific Slack app path:

```bash
python3 installers/launch-slackpolish-MAC-ARM.py \
  --slack-path /Applications/Slack.app \
  --relaunch
```

## Current scope

The runtime payload currently loads:

- `slack-config.js`
- `logo-data.js`
- `slack-text-improver.js`
- `slack-settings.js`
- `slack-channel-summary.js`

## Operational model

- The launcher is intended to remain running while Slack is open.
- Closing the launcher stops future target attachment.
- Restarting Slack normally without the launcher will run Slack without SlackPolish.
- The installed `SlackPolish.app` should be a Desktop symlink to the real app bundle stored under SlackPolish Runtime.
- The `.command` launchers remain available as fallback entry points.

## Status

This is the working implementation behind SlackPolish's new macOS support.

What is already validated:
- no Slack app-bundle mutation is required
- no `Info.plist` mutation is required
- no ASAR repack is required
- Slack exposes usable DevTools page targets in runtime-launch mode
- SlackPolish can be injected into the real workspace page
- text improvement works through this launcher path
- settings work through this launcher path
- channel summary works through this launcher path
