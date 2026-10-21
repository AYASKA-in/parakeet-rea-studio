# Signing and hands-on Windows acceptance

Status: signing and hands-on checks remain deferred; the initial hosted silent installer lifecycle passed on 21 October 2026. An automated pass is not a signing approval, spoken Narrator acceptance, or a physical device test.

## What is ready

- Install lifecycle testing is restricted to a fresh GitHub-hosted Windows VM. It refuses this personal laptop and self-hosted runners, even with the opt-in flag.
- The installer test uses the VM account's real roaming profile, HKCU registration, desktop and Start Menu shortcuts. It installs, starts, saves encrypted synthetic context plus a dummy key, uninstalls, checks retained data, reinstalls, decrypts and sends one answer request to a loopback mock, then uninstalls again.
- No real credentials, microphone, screen capture or cloud API calls are involved in that installer test. Its report is uploaded, never the profile.
- On this laptop, a packaged synthetic fixture exposes named controls, a transcript log and save-status role through native Windows UI Automation. This observation does not establish spoken output quality or complete keyboard navigation.
- The local speech recorder and the accessibility fixture can be launched independently. Neither starts recording or cloud traffic on launch.

The laptop reports Windows Home (CoreSingleLanguage), with no Windows Sandbox executable. A fresh hosted Windows runner provides disposable-account isolation; it does not replace manual wizard, client Windows, SmartScreen, elevation, multi-user, or hardware acceptance.

## Deferred voice check

From the repository, run:

```powershell
npm run eval:record
```

1. Confirm you are free of calls. Use only the harmless displayed phrase.
2. Leave cloud consent off for local-only checking. Enable it only if this clip may be sent to the configured provider for a later explicit benchmark.
3. Check the harmless-content declaration, press **Start local recording**, read the phrase naturally, then **Stop and save**.
4. Review the reference against what you actually said. A number spoken incorrectly or omitted must not be scored as a model transcription error. Preserve the saved WAV and manifest privately under ignored `test-results`.
5. Tell the maintainer the recording is ready. Do not put a key or audio file in a public issue.

The currently approved cloud budget has **7 requests remaining** after 43 synthetic requests. No human upload is authorized solely by opening the recorder. A completed consented fixture, verified reference and explicit benchmark invocation are required. Stop on authentication or quota errors.

Record separate clips for normal speech, your natural accent, corrections, technical identifiers and interruptions. Use a second consenting speaker for overlap. Synthetic tests and one speaker cannot establish accent or overlap accuracy. Measure verbatim output first, reviewing number normalization separately.

## Narrator and keyboard check

```powershell
npm run test:accessibility:prepare
```

This opens **Parakeet Studio — Accessibility acceptance (synthetic)** with an isolated profile, invented context and one saved practice session. No API key is installed. Keep listening off.

When ready for spoken output, start Narrator yourself with **Ctrl+Windows+Enter**. Repeat the shortcut to stop it afterward. If Narrator was already running, leave it in its original state.

| Task | Required observable result |
| --- | --- |
| Tab from document start | Skip link is reachable; Enter reaches the main workspace. Focus remains visible. |
| Navigate workspace, context, history and Settings | Names, headings and selected navigation are announced in a useful order. |
| Open Session history, then Synthetic hash map practice | Question, transcript and answer can be read; code remains intelligible. |
| Explore Audio source and Microphone options | Labels and current values are announced. Do not start recording for this check. |
| Open floating copilot | Question, answer, controls and recovery status are reachable by keyboard; return to workspace remains possible. |
| Edit a harmless question | Field name, typed content and keyboard hints are clear. Do not submit to a real provider. |
| Trigger a missing-key error | Error is announced without moving focus unexpectedly or repeating the entire page. |
| Use real Windows scaling/zoom and high contrast | Content, focus and controls remain readable; distinguish actual OS settings from CSS emulation. |
| Close the fixture | No recording is left running, and the personal profile is unchanged. |

Record Windows build, Narrator version/voice, scaling, exact task, observed spoken output and pass/fail/incomplete. Streaming announcements and recovery timing need a separate local mock fixture or explicitly authorized real-provider session; this no-key preparation window cannot validate them. Do not mark the prepared report's `narratorTested` field true without performing and reviewing the spoken tasks.

## Broader physical audio and device matrix

Inventory on this laptop found Realtek microphone/speakers, ASUS noise-cancelling input/output and virtual voice-changer input/output endpoints. Inventory is not evidence that an endpoint works.

```powershell
npm run test:devices -- --packaged --devices-only
```

To verify setup without opening capture, add `--prepare-only`; it opens/closes an isolated fixture, verifies recording is off and writes a prepared report, not a hardware pass.

The watcher creates its control JSON with all flags off, starts with recording off and prints an ignored `devices-.../progress.json` directory containing its `controlFile` path. In that test window, expand Microphone options and choose the intended device. Only when free of calls, set `startDevices` to `true` in that control JSON. It then captures 12 seconds of microphone audio and 12 seconds of Windows playback including a quiet four-second test tone. It sends PCM only to its in-process loopback mock, saves no raw audio and makes no cloud requests. Say a harmless phrase during the microphone phase. Without `--devices-only`, it additionally waits for a separate explicit sleep-start instruction. Close the test window or set `cancel` to `true` to cancel a pending operator step.

Repeat for each available endpoint, with a consenting operator:

| Configuration / event | Acceptance evidence |
| --- | --- |
| Built-in mic and speakers | Frames and input energy; no start before opt-in; explicit stop releases capture. |
| ASUS processing and virtual input/output | Correct routing and usable speech, not just a device label or nonzero PCM. |
| Wired / USB headset | Selected microphone and playback routing; unplug/reconnect behavior and explicit restart. |
| Bluetooth headset | Call mode versus stereo mode, sample rate, reconnect and absence of stale capture. |
| Default-output change during listening | Visible stopped/reconnecting state; no silent wrong-device continuation; restart uses intended output. |
| Permission denial / unavailable input | Actionable error and working stop/retry; do not change OS privacy settings automatically. |
| Sleep/wake / lock/unlock | Genuine power events, capture stays stopped, context survives, explicit restart works. |
| External monitor / dock / scaling | Overlay stays reachable and screenshot capture targets the intended display after topology changes. |

The scripted device-only check covers the selected input and default playback at one moment. Hotplug, Bluetooth, routing changes, denial and sleep are separate operator-observed tests, not implied by that pass. Mark absent equipment **not available**, never passed. Previous physical sleep and endurance receipts apply to their recorded earlier candidates, not automatically to this build.

## Installer coverage and remaining manual cases

CI command (refuses personal computers):

```powershell
npm run test:install-lifecycle -- --disposable-host
```

The initial per-user lifecycle passed in [hosted run 39567793764](https://github.com/AYASKA-in/parakeet-rea-studio/actions/runs/39567793764), with one local mock request and no cloud requests. The stricter version additionally waits for the entire installation directory to disappear during normal self-copy uninstallation.

The workflow runs on `windows-latest`. Check the completed run and `install-lifecycle-*/report.json` for its actual result. Source presence is not a completed installer acceptance test.

Still perform the visible wizard, cancel/back, paths containing spaces/non-ASCII characters, standard-user/UAC behavior, two Windows accounts, in-use files, an actual older installed-version upgrade, rollback to a compatible pre-upgrade backup and signed-download SmartScreen behavior in a separate Windows VM. The automated silent lifecycle does not claim these cases.

## Actual signing

See [Code signing policy](CODE_SIGNING.md). Builds remain **unsigned** until an approved identity/service produces signatures and the pinned publisher/timestamp gate passes. No signing certificate is present in the current user's personal store. Do not install a self-signed root on users' machines to simulate public trust.
