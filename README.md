# Busy Office

Pretend work desktop for kids. Opens full screen with five made-up apps: Postbox (email), Huddle (chat), Scribe (documents), Tally (spreadsheet), and Bubbles (a web feed). Every key press or click does something: types a few characters, sends an email, posts a chat, fills a spreadsheet cell, scrolls or upvotes. After each finished task it often switches apps.

**Exit:** hold `Ctrl + Alt + Shift` and press `Q` (Mac: `Ctrl + Option + Shift + Q`).

## Download

Get the file for your computer from the [latest release](../../releases/latest):

| System | File |
| --- | --- |
| Mac (Intel or Apple Silicon) | `BusyOffice-x.y.z-mac.dmg` |
| Windows (installs) | `BusyOffice-x.y.z-windows-setup.exe` |
| Windows (no install, just run) | `BusyOffice-x.y.z-windows-portable.exe` |
| Linux | `BusyOffice-x.y.z-linux.AppImage` |

The builds aren't signed, so the first launch needs one extra step:

- **Mac:** open the app, close the warning, then go to System Settings → Privacy & Security → "Open Anyway". If it says the app is damaged, run `xattr -cr "/Applications/Busy Office.app"` in Terminal.
- **Windows:** on the SmartScreen warning click "More info" → "Run anyway".
- **Linux:** `chmod +x BusyOffice-*.AppImage`, then run it.

## How locked is it

- All keys are captured; the window refuses to close and takes focus back if it loses it.
- **Mac:** kiosk mode disables Cmd+Tab, Cmd+Q, Force Quit and the Dock.
- **Windows:** Alt+F4 and Ctrl+W are blocked. The Windows key and Alt+Tab can't be fully blocked, but the window jumps back. Ctrl+Alt+Del always works.
- **Linux:** depends on the desktop environment.
- Only the main monitor is covered.

## Development

```
npm install
npm start        # locked, full screen
npm run dev      # normal window, no lockdown
```

Change the exit combo in `main.js` (`isUnlockCombo`). All text (names, emails, chats, posts) is in `renderer/content.js`.

## Releasing

Push a version tag. GitHub Actions builds Mac, Windows and Linux and attaches them to a release:

```
npm version patch
git push --follow-tags
```
