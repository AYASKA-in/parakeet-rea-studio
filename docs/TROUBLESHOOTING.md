# Troubleshooting

[README](../README.md) · [User guide](USER_GUIDE.md) · [Key setup](API_KEYS.md)

## App will not start or appears missing

Use the Windows x64 portable EXE, not the source ZIP. Check its published SHA-256 checksum and Windows Security's actual message. The binary is unsigned; do not disable protection or run an untrusted download. First launch may take longer because it extracts the runtime.

Capture protection hides taskbar buttons, so a minimized app can look closed. Press **Ctrl+Shift+M** to restore it. Before upgrading, close the running workspace with its **X** button and wait for it to finish saving; minimizing does not quit it. An older running copy can keep ownership of the same profile. Version 0.8.1 and newer show their version in the sidebar footer.

The v0.8.1 portable launcher uses a separate temporary extraction directory for every launch. Earlier portable versions can stall when reopened while their runtime files are in use. Close the old copy before opening the newer download. Use the portable EXE directly, or the setup EXE to install; these are different distribution formats. Settings reports shortcut conflicts; close/reconfigure the conflicting app, then Retry global shortcuts. On a different Windows account, encrypted credentials may require re-entry.

## No AI answer

Check the exact error. **Choose data-use policy** means startup succeeded but uploads are blocked until you review a data-use mode in Settings. A retained key does not automatically choose consent after an upgrade. Configure a provider key, model IDs and data-use mode. “AI provider configured” is not an authentication test. Try one harmless typed question before audio/screenshots. Unknown policy blocks uploads. Unpaid practice deliberately excludes personal context and disables AI PDF upload/stored-session summaries.

For 401/403, check key/project permissions/restrictions. For 404, check URL/model. For 429, check project quota/concurrency; another key in the same project does not help. For 503, provider capacity may be unavailable. Stop unnecessary sessions, wait and explicitly retry. No automatic paid fallback occurs. Use [Google's troubleshooting guide](https://ai.google.dev/gemini-api/docs/troubleshooting).

## No transcript or wrong audio

1. Test microphone only, then system audio only.
2. Check Windows Settings → Privacy & security → Microphone and allow appropriate desktop-app access.
3. Select the correct input and Refresh device list; verify that Windows itself receives audio.
4. For system audio, play a synthetic speech clip audibly and check sharing permissions/output-device selection.
5. Stop and restart after changing devices. Repeated mute/device-loss notices indicate input/driver trouble.
6. Test Standard audio before Low bandwidth; the latter can miss quiet speech.

You/Call audio are source labels, not speaker identification. Avoid capturing real private material during troubleshooting. Gemini audio uses WebSockets and a dedicated transcription model; a working typed answer does not establish audio access.

## Auto draft waits, stops after a reconnect, or answers prematurely

Review the pending card. Finalized text and a short pause are required; interim speech/noise can postpone sending. In both-source mode, microphone speech does not trigger automatic answers. Audio interruptions hold the pending question for review. Correct critical wording and use Send now; Dismiss clears unwanted text. Disable Auto draft for manual control. The heuristic cannot recognize every indirect or multilingual question.

## Glass text is unreadable or cannot be clicked

Increase **background** opacity over a bright/busy screen. Text opacity remains full; clear glass cannot guarantee contrast against every background. Ctrl+Shift+P restores mouse input when click-through is enabled. Ctrl+Shift+Home centers the overlay; Ctrl+Shift+arrows move it. Ctrl+Shift+M restores the workspace. Fixed shortcuts can conflict with other apps.

## Screenshot is wrong, stale or unreadable

Choose the correct display in preview, Refresh and inspect its timestamp. Crop tightly or enlarge the original text. Fast reduces image size; try Balanced/Detail for small code. Captures expire after two minutes or display changes; ordinary content changes require manual refresh. A chat-only model may not support images. Do not assume the model read invisible/cropped-off text.

## Resume import misses text

Local import requires selectable PDF text. Scanned documents may need a trusted local OCR tool or optional explicit AI PDF upload under a permitted data policy. Review reading order/dates before applying. Limits: 10 MB, 40 pages, 50,000 applied characters. Unpaid practice does not include saved personal context in answers; this is expected.

## Missing history, failed saves or capacity

Check saved status. Use Retry saving after resolving disk/access issues; do not close while content remains dirty. Export/delete older records at the 100-session/16-MB limit. The app rejects overflow rather than silently dropping history. A corrupt primary can recover from its app-owned backup with a notice; avoid manually overwriting either while the app runs.

Normal data is under `%APPDATA%\Parakeet Studio`. A source/test run with `PARAKEET_USER_DATA` uses a separate profile. Do not upload either folder publicly: it may contain plaintext transcripts/resume content and encrypted credentials. Export selected non-sensitive content when asking for help.

## After sleep, lock or network loss

If Windows audio timing optimization is unavailable, verify the release checksum and keep the portable app intact. The helper uses Windows' .NET Framework runtime, normally present on Windows 11. On managed computers, ask your administrator about blocked app components; do not disable security or change system-wide timer/power settings to bypass a policy.

An “Audio processing fell behind real time” warning means the audio clock lagged materially behind wall time. Capture stops rather than continuing to report healthy listening. Close unnecessary workload, check audio devices/drivers and restart; some speech may be missing. Report a synthetic reproduction if it repeats.

Recording intentionally stays off after sleep/lock. Wait for desktop recovery, review saved gap notices and explicitly start listening. The reconnect buffer is bounded to eight seconds of new audio; earlier speech may be missing. Repeating an answer request after partial output can duplicate content, so inspect the retained draft first.

## Reporting a bug

Use [Issues](https://github.com/AYASKA-in/parakeet-rea-studio/issues) with app version, Windows version, input mode, minimal synthetic reproduction and redacted error. Include whether it reproduces with a typed question, one input or both. Never include keys, headers, resumes, private images/audio or complete profile folders. Security issues follow [SECURITY](../SECURITY.md).
