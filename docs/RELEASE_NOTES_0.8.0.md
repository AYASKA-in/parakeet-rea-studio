# 0.8.0 — experimental unsigned Windows release

## Downloads

- [Portable EXE](https://github.com/AYASKA-in/parakeet-rea-studio/releases/download/v0.8.0/Parakeet-Studio-0.8.0-portable.exe): run without installation.
- [Setup EXE](https://github.com/AYASKA-in/parakeet-rea-studio/releases/download/v0.8.0/Parakeet-Studio-0.8.0-setup.exe): per-user Windows installer.
- [Source, checksums and release manifest](https://github.com/AYASKA-in/parakeet-rea-studio/releases/tag/v0.8.0).

## Included changes

- Glass Hold/Resume button: bold white text, solid teal background, visible border and hover/focus feedback. Checked at 0%, 35% and 95% background opacity on narrow and regular overlays.
- Hold/Resume auto draft controls in the workspace and overlay; explicit holds survive new transcript segments.
- Late same-source spoken corrections retain the original question and revised constraints, cancel obsolete generation, preserve partial drafts and require explicit replacement submission.
- Visible slow-provider and paused-stream feedback with Stop answer. No automatic replay after partial output or continuous cloud health polling.
- Content-free attempt timings through capture, queueing, text, completion and save; failed/cancelled attempts remain in their denominators.
- Stronger employment-evidence cues, JavaScript evaluation in a restricted pinned Node container, clearer grounding contracts and stricter numeric/structured grading.
- The packaged correction/screenshot verifier waits for the recorded save boundary rather than mistaking ready controls for completed diagnostics.
- A bounded desktop benchmark with synthetic WebAudio input, real transcription/answer services, workspace/overlay DOM measurements and verified disk saves.

## Evidence and limitations

The deterministic suite passes 154 tests. The release page records the exact source revision and the release CI run. Automated release checks are separate from model accuracy and internet performance. This build does not include a shared API key.

Historical development evidence is retained with its recorded source hashes: [50-request quality study](V0_8_BASELINE_2026_10_22.md) and [12-request desktop timing study](V0_8_DESKTOP_SPEED_2026_10_22.md). In the latter, nine flows completed and matched saved answers. Unshaped first-text ranges were typed 4.1–4.3 seconds, screenshots 4.5–4.6 seconds and synthetic speech 7.2–7.8 seconds. Native desktop acquisition was excluded from that screenshot measurement. These are small source-development samples, not fresh speed measurements of this packaged EXE or production SLO qualification.

Grounding clarification remains imperfect; an unsuccessful prompt experiment was reverted. SMART can omit correction context; VERBATIM remains the default while explicit saved preferences are respected. The proposed speed targets remain unqualified. Human voice/overlap, Narrator, broader real devices, controlled networks and fresh long-session qualification remain outstanding. Earlier sleep/endurance receipts cover only their recorded candidates. Capture exclusion is not guaranteed for every sharing tool.

The production-only npm audit reports zero vulnerabilities. The full development-tool audit reports eight moderate entries rooted in [sprintf-js denial of service](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), propagated through the builder/download tooling. These remain tracked development-tool findings; the suggested forced electron-builder downgrade was not applied during publication. This is not a claim that every bundled native/runtime component has been audited.

**Unsigned:** signing-service approval/certificate is not configured. Signing support does not mean the portable app, installer or helper has a trusted publisher signature. This is an experimental prerelease.

## Upgrade

Close running copies and preserve a compatible backup of your application profile before upgrading. Existing keys and workspace data are not shipped inside the download. The per-user installer retains application data during normal uninstall. Keep Local State with encrypted profiles, and use a compatible pre-upgrade backup for rollback rather than opening a newer profile in an older app.

See [user guide](USER_GUIDE.md), [API-key setup](API_KEYS.md), [external acceptance scope](EXTERNAL_ACCEPTANCE.md) and [signing policy](CODE_SIGNING.md).

## Provider documentation check

On 22 October 2026, Google's [model catalog](https://ai.google.dev/gemini-api/docs/models) lists the configured `gemini-3.5-flash-lite` and `gemini-3.5-transcribe-live` models. Its [pricing page](https://ai.google.dev/gemini-api/docs/pricing) lists free-tier input/output for them. Availability, project limits and terms can change; use your own eligible project, review the current provider terms and do not assume unlimited free usage. No new cloud calls were made while packaging this release.
