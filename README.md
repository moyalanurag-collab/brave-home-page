# Command Centre

Anurag's Brave start page. Plain HTML, CSS and JavaScript with no build step and no libraries.

## Files
- `index.html` is the page itself. `Documents\start.html` forwards here, so your existing Brave setting keeps working.
- `css/app.css` holds the design tokens and components.
- `js/core.js` handles storage, settings, time helpers, icons, dialogs and toasts.
- `js/widgets.js` contains the clock, weather, focus, shortcuts, tasks, notes, agenda and world clock.
- `js/shell.js` runs the search bar, command palette, customise mode, settings and keyboard shortcuts.
- `manifest.json` and `icons/` are only needed when the page is loaded as a Brave extension.

## Keyboard
| Key | Action |
|---|---|
| Ctrl K | Command palette |
| / | Search bar |
| T | New task |
| N | Notes, full screen |
| F | Start or pause the focus timer |
| E | Customise the layout |
| , | Settings |
| 1 to 0 | Open a shortcut. Hold Shift to open it in a new tab |
| Esc | Close whatever is open |

## Live data
- **Weather** comes from Open-Meteo (open-meteo.com). It needs no key or account.
- **Google Calendar** syncs from your calendar's "Secret address in iCal format", which you paste into Settings. This only works when the page runs as the extension, because browsers block calendar feeds on a local file. The feed covers the next 14 days and refreshes every 15 minutes.
- **Search suggestions** from Google and **bookmark search** in the palette also only work in the extension. On the plain page, suggestions come from your own search history and shortcuts.

## Load as a Brave extension (optional)
This makes the page open in every new tab and turns on calendar sync, suggestions and bookmarks.
1. Open `brave://extensions`.
2. Turn on **Developer mode** in the top-right corner.
3. Click **Load unpacked** and choose the `Command Centre` folder.
4. Open a new tab. If Brave asks whether to keep the change, choose Keep.

The extension keeps its own data, separate from the local page. To move your tasks and notes across, use Settings > Your data > Download backup on the local page, then Restore backup in the extension.

## Data
Everything is saved in this browser on this computer (localStorage), so it survives restarts. Clearing Brave's site data for local files, or for the extension, erases it. Download a backup now and then.
