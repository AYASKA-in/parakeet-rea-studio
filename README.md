# Parakeet REA Studio

An independent, MIT-licensed Windows assistant for interview practice and permitted meetings. Listen to microphone/system audio, draft AI answers, review screenshots, and keep readable answers in a movable glass overlay. The Windows app is named **Parakeet Studio**. It is not affiliated with ParakeetAI and includes no vendor binaries or extracted source.

**Experimental · Windows x64 · Bring your own API key.** AI output can be wrong. Universal capture invisibility, offline operation and 100% correct answers are not promised.

[Download Windows EXE](https://github.com/AYASKA-in/parakeet-rea-studio/releases/download/v0.5.7/Parakeet-Studio-0.5.7-portable.exe) · [Release/checksums](https://github.com/AYASKA-in/parakeet-rea-studio/releases/tag/v0.5.7) · [User guide](docs/USER_GUIDE.md) · [API-key setup](docs/API_KEYS.md) · [Troubleshooting](docs/TROUBLESHOOTING.md)

## Download and run

1. Download **`Parakeet-Studio-0.5.7-portable.exe`** above. This is the app; source ZIPs are for developers.
2. Keep it in a folder you control, such as `Documents\Parakeet Studio`. No Node.js, Python or installer is needed. First launch extracts the runtime and can take longer.
3. Download the release's `SHA256SUMS.txt` and compare its EXE checksum:

   ```powershell
   Get-FileHash -Algorithm SHA256 '.\Parakeet-Studio-0.5.7-portable.exe'
   ```

4. Open the EXE. This community build is unsigned and may show an unknown-publisher warning. Verify the source/checksum before deciding to run it; do not disable Windows security.
5. Configure your own provider key in **Settings**, choose a data-use policy, and save.

Tested on Windows 11 x64. Cloud AI requires internet and model access; audio depends on Windows permissions/drivers. ARM64, other operating systems, legacy S3 sleep and physical dock combinations are not validated. The browser preview demonstrates the interface; use the desktop EXE for AI/audio.

## First answer

1. [Create a Gemini key](docs/API_KEYS.md) and enter it directly in Settings → **Google Gemini**.
2. Keep the base URL `https://generativelanguage.googleapis.com/v1beta`, answer model `gemini-3.5-flash-lite`, transcription model `gemini-3.5-transcribe-live`.
3. For free non-personal practice, choose **Unpaid cloud — non-personal practice only** and use synthetic questions without private resumes/meeting material.
4. **Save connection**, type “Explain a hash map” in the workspace, then **Draft answer**. “AI provider configured” means settings are saved; the first request tests key/model/quota access.
5. Choose **Microphone**, **System audio** or **Microphone + system**, then **Start listening**. Stop when finished.
6. Open the floating copilot with **Ctrl+Shift+O**. **Ctrl+Shift+M** brings back the workspace.

No shared key is bundled. Starting presets are not a claim of best accuracy for every task. Google controls availability, quotas and data terms. A billing-enabled project may incur charges; the app cannot detect billing tier and never silently selects a paid fallback. Check [pricing](https://ai.google.dev/gemini-api/docs/pricing), [limits](https://ai.google.dev/gemini-api/docs/rate-limits) and [terms](https://ai.google.dev/gemini-api/terms).

## Features

![Workspace with a synthetic practice question](docs/images/workspace.png)

Screenshots use synthetic local-provider fixtures; displayed timings are not cloud-latency benchmarks.

| Feature | What it does |
|---|---|
| Live transcription | Separate microphone/call-audio inputs, interim/final text, editable finalized wording |
| Answer drafts | Concise, STAR, Technical and Coding styles; Fast/Balanced/Careful priorities |
| Auto draft | Groups finalized question segments and waits for a pause; Send now/Dismiss controls |
| Glass overlay | Background-only opacity, opaque white text, nine anchors, dragging and click-through |
| Screen analysis | Explicit capture → monitor preview/crop → editable question → send |
| Resume context | Local PDF/TXT/Markdown extraction and review; optional explicit AI PDF upload |
| Sessions | Local transcripts, answers, notes, history search/reopen, export and deletion |
| Recovery | Bounded reconnect buffer, visible gaps, retained partial answers; capture stays off after sleep |

Answer text comes from your configured AI provider. Local code handles capture, routing, context and display. The desktop app does not execute generated code. Review model answers and test proposed solutions.

![Floating copilot with a synthetic coding answer](docs/images/glass-overlay.png)

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+Enter | Draft from the question field |
| Ctrl+Shift+Space | Send the pending question / draft an answer |
| Ctrl+Shift+L | Start/stop listening |
| Ctrl+Shift+O | Show/hide copilot |
| Ctrl+Shift+M | Show workspace |
| Ctrl+Shift+H | Hide copilot |
| Ctrl+Shift+P | Toggle click-through / restore mouse input |
| Ctrl+Shift+← / → / ↑ / ↓ | Move copilot 32 pixels |
| Ctrl+Shift+Home | Center copilot |
| Ctrl+Alt+← / → | Previous/next answer |
| Ctrl+Alt+↑ / ↓ | Scroll floating answer |
| Ctrl+Alt+Enter | Open screenshot review |

Settings reports unavailable global shortcuts and offers **Retry global shortcuts**. Reopen the EXE if the workspace shortcut conflicts. Shortcut remapping is not included.

## Privacy and screen sharing

Capture exclusion is enabled by default for workspace/overlay on supported Windows capture paths; taskbar buttons are hidden. Test your actual meeting app's shared-screen preview. OS dialogs, remote tools, alternate capture methods and cameras may behave differently. The process is not hidden. Follow applicable meeting/assessment rules and participant permissions.

Choose a data-use mode:

- **Choose before sending content:** blocks provider sends until selected.
- **Unpaid cloud — non-personal practice only:** omits saved personal context/prior answers; AI PDF upload and stored-session summaries are disabled. Filtering is best effort, not anonymization.
- **Provider terms reviewed for this data:** your declaration that the provider/account permits your material; it changes neither billing nor privacy terms.
- **Local server:** requires a loopback URL. Supply your own server/models; it could itself forward data to cloud services.

Audio uploads while listening. Relevant reviewed context may accompany answers under the selected policy. Screenshot pixels upload only after review/send. **Review outgoing text** shows filtered answer text before sending.

Keys use Windows encryption. Transcripts, resume context and recovery snapshots are **plain-text local JSON** under `%APPDATA%\Parakeet Studio`. Deleting the EXE does not delete this data. See [SECURITY](SECURITY.md) and the [user guide](docs/USER_GUIDE.md#history-updates-and-removal).

## Speed and reliability

Start with Standard audio and Balanced answers. Fast reduces pause/reasoning budgets; Careful can help difficult tasks but takes longer. Crop screenshots around the problem. Low-bandwidth mode skips long silence and can miss quiet speech. Both-source Gemini uses two Live connections and more quota/bandwidth.

Up to eight seconds of **new** audio is buffered during reconnection. Earlier in-flight speech may be lost; saved notices mark interruptions. Review held questions and use Send now. After sleep/lock, start listening explicitly. See [validation and remaining work](docs/RELIABILITY.md). No finite test proves a universal success rate.

## Build and contribute

Developers need Windows, Git and Node.js 22.14+:

```powershell
git clone https://github.com/AYASKA-in/parakeet-rea-studio.git
cd parakeet-rea-studio
npm ci
npm test
npm start
```

`npm run build:win` creates the EXE. `npm run release:source` creates an allowlisted source ZIP/checksums. See [CONTRIBUTING](CONTRIBUTING.md) and [release procedure](docs/RELEASING.md). Local-provider tests need no real API key.

Use [Issues](https://github.com/AYASKA-in/parakeet-rea-studio/issues) for reproducible bugs with version, steps and redacted errors. Never attach keys, private screenshots/resumes/recordings or your entire profile. Use [SECURITY](SECURITY.md) for vulnerabilities. Project source: [MIT](LICENSE); dependencies retain their [own licenses](THIRD_PARTY_NOTICES.md).
