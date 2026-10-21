# Validation

## Version 0.7.0 candidate — quality, recovery and release tooling

117 deterministic checks pass. Source checks include advanced Python/SQLite reference solutions, wrong-output and infinite-loop rejection, restricted execution probes, consented human-audio manifest validation, failure-inclusive stage diagnostics, source-overlap handling, explicit recovery controls and non-overwriting profile backup tests. Native source/packaged production and hardening checks, local fault/latency scenarios, actual portable launch, installer payload inspection, and Windows signature rejection checks are recorded separately under ignored test-results. Hosted CI validates the final committed candidate; it is not assumed green until its run completes.

The real Windows restore regression caught a missing protected Local State key dependency. Backups now retain that file and reject an encrypted backup missing its key state. A restored isolated profile decrypted its actual workspace and credential and generated against a local mock. Normal user data was not read or changed.

UI coverage includes 16 view/viewport combinations, four overlays with recovery feedback, a 640x450 CSS-pixel / DPR 2 reflow case and forced-colors rendering. This is not a Narrator or physical browser/OS zoom acceptance test.

43 additional Gemini requests were used, including six targeted retests after failures. Original receipts remain retained. See [quality and recovery](QUALITY_AND_RECOVERY.md) for task-level results and rubric corrections; these are not broad accuracy rates. The human voice check was deferred by the user; no human speech was recorded or uploaded. Actual signing, broader hardware, human quality/accessibility and install/uninstall acceptance remain open. Builds are unsigned, and public downloads remain 0.5.8.


## Version 0.6.1 candidate — direct screenshot answers

105 unit checks, ten source and packaged native production scenarios, all 24 packaged hardening checks, source and packaged desktop end-to-end checks, and 16 workspace / four overlay layout checks passed. The quick-capture integration uploads exactly one synthetic JPEG, keeps the workspace minimized, creates no new window and opens no review dialog. Review/crop expiry, display-change invalidation and cancellation checks still pass. No cloud calls were made for this change; these checks do not grade real screenshot interpretation or code correctness.

The actual portable launcher passed on 21 October 2026 with isolated synthetic audio/provider/history, matching extracted ASAR/helper hashes and graceful exit code zero. ASAR SHA-256: `88d1cf5d714d158dc95f69f2f119e224b51b926c778b2ddfc4db2368b07b1fde`. Portable SHA-256: `4ad7173d0e294d4c7aab21f6f710e9e15538b763049e574150cea4daeff76be0`. Source ZIP verification covered 100 allowlisted file digests and the embedded manifest at runtime commit e206cb0. Hosted Windows push CI passed at runtime commit e206cb0: https://github.com/AYASKA-in/parakeet-rea-studio/actions/runs/39556917695 (including portable launch, source verification and dependency inventory).

The original frozen 0.6.0 endurance summary remains retained locally with artifact identities; its archived portable is kept separately. The results below are not a long-session qualification of 0.6.1.

## Version 0.6.0 candidate — production hardening

Status: experimental, unsigned. Final candidate packaged/portable and encrypted 60/120-minute endurance checks passed. Earlier hosted runs failed in display-fixture assumptions and portable trusted-path matching; fixes and current hosted status are tracked under 0.6.1.

- 102 deterministic tests pass, including stream bounds, retry/cooldown, encryption/retention, strict diagnostic allowlists, routing corpus and evaluator checks.
- Source and final packaged native production checks pass ten scenarios, including the newly reproduced request-admission race, actual Windows encryption/restart, low-disk rollback, forced termination, no-history disk copies, retention, timing export and keyboard cropping.
- All 24 final packaged native hardening checks pass. Full packaged desktop integration and the actual portable EXE also pass after all fixes. Extracted ASAR SHA-256: 52a647669dd981523f2814c0d57491d77eb22dc9ce86487e32c42e6f8547e605; helper SHA-256: 8808af1ef46f195e07a2eb63998d7e4654beecf86fb9d8abe5713b2c8842bdde.
- UI: 16 view/viewport combinations and four overlay layouts pass visible text contrast, overflow and keyboard checks.
- Pinned Docker runner self-test passed ten reference task families, wrong-code rejection, timeout cleanup, non-root/read-only root and blocked external network. Generated model code is never executed on Windows directly.
- The 12-case live smoke passed three finite coding cases, three screen token/limit extraction checks and three structured resume checks. Three raw ASR lexical cases failed. The additional budget is recorded below; no private resume, screen or microphone was uploaded.
- A genuine physical sleep/wake and real audio delivery run passed on the existing laptop: 94 microphone frames and 93 loopback frames, no cloud requests or saved raw audio. Native suspend 18:11:39.910 UTC and resume 18:13:18.520 UTC on 20 October 2026; recording stayed stopped, context remained, explicit restart/stop succeeded.
- That hardware run and the 302-second encrypted dual-source synthetic soak are tied to candidate ASAR 6e99191e8e9b8159b80fc6df2022d4472be7a65555e1f6dac9ebe000791d272e, before the subsequent request-admission fix. Audio processing is unchanged by that fix; these are not automatically final-binary endurance receipts.

Paired synthetic ASR: raw critical-token pass counts SMART 8/10, VERBATIM 9/10. One failure in each was thousands grouping (100000 vs 100,000); offline explicit numeric-grouping adjudication gives 9/10 and 10/10 for these narrow lexical checks. SMART also shortened an explicit contrast. Raw reports remain unchanged. This does not establish general semantic accuracy or justify a universal model ranking.

In the additional batch, seven of ten coding attempts passed finite input cases; three failed with provider HTTP 503 high demand, not wrong-code grades. The next screen stage encountered three more 503s and then a local cooldown rejection, stopping at 34 attempts. Unrun cases are not successes. A remaining-budget recovery run is recorded separately. Some later cloud timing overlapped the physical sleep step; those elapsed times cannot establish steady-state network latency.

Independent human-authored holdouts, real accents/noise/overlap, diverse screen diagrams, difficult coding, screen-reader/200% zoom usability, additional hardware/docks, signed distribution and a real internet-disconnected local-model benchmark remain open. Earlier 0.5.7 60/120-minute evidence is version-specific. See [readiness](PRODUCTION_READINESS.md) and [evaluation](EVALUATION.md).


## Version 0.5.8 — desktop UI refresh

- 79 unit regressions passed.
- Full packaged Electron/Edge integration passed, including separate audio, streamed answers, PDF/screenshots, persistence, capture exclusion and native glass opacity.
- All 24 packaged native hardening checks passed.
- Actual portable extraction, synthetic answer/audio, saved history and graceful exit passed.
- UI audit passed 16 page/viewport combinations and four overlay layouts, with no document overflow or clipped primary controls. Lowest sampled visible text contrast: **5.36:1**. Keyboard skip navigation and microphone disclosure passed.

These checks use synthetic inputs and isolated profiles with no real provider calls. The main changes are HTML/CSS presentation; capture/provider/recording logic is unchanged. The long-session and real-model evidence below belongs to **0.5.7**, not a new 0.5.8 endurance or model-quality benchmark. See [UI design and test scope](UI_DESIGN.md).

## Version 0.5.7 validation

Experimental Windows x64 prerelease, 20 October 2026. These are bounded observations, not a correctness or availability guarantee.

| Check | Result |
|---|---|
| Unit regressions | 79 passed |
| Packaged native hardening | 24 passed |
| Packaged desktop integration | Passed: audio, answers, PDF import, exports, capture exclusion, overlay and contrast |
| Actual portable launcher | Passed: extraction hashes, synthetic answer/audio, history and graceful exit |
| Microphone endurance | 60.04 real minutes passed; 28,123 frames, 124 finalized mock turns, 120 local-provider answers |
| Disconnect recovery in microphone run | Four injected outages, four explicit reviews, zero unexpected errors or missing saved final IDs |
| Microphone continuous PCM payload | 99.926% of nominal duration-based payload; not proof of sample-perfect capture |
| Dual-source endurance | **Passed: 120.042 real minutes.** See full results below. |

The two-hour test completed in its original process after initial publication. Both completed reports passed the declared frozen-hash, continuous-throughput, saved-warning and retention gates.

Real Gemini synthetic checks passed speech (16.905 s including capture/drain), a coding response (14.488 s; displayed/static checks), and a scanned fake resume (4.582 s). The first screenshot request timed out at about 90 seconds; one focused retry returned the correct arithmetic answer in 8.773 s. Both attempts were retained. These are individual samples, not typical-latency or accuracy benchmarks.

Actual Modern Standby sleep/wake passed on the 0.5.6 baseline on one ASUS Windows laptop; capture stayed off after wake, 100 sessions remained and explicit restart worked after reconnecting the test controller. Version 0.5.7 adds native recovery/timer-policy regressions; it has not had a new physical sleep trial. No dock/external monitor was available.

Endurance uses synthetic Chromium fake microphone inputs, real production processing/storage and a local mock provider, hidden windows and temporary test-only display-sleep blocking. Both source pipelines receive the same synthetic WAV. No private audio, cloud ASR or semantic answer quality is graded. Working-set totals include shared pages; CPU samples share measurement intervals with the timer service. Finalized-ID retention is not transcription accuracy.

The EXE is unsigned. See [reliability and remaining work](RELIABILITY.md), [security](../SECURITY.md) and [release procedure](RELEASING.md).

## Completed real wall-clock endurance

Completed on 2026-10-20. Original failed/superseded receipts remain private and retained. No elapsed-time simulation or restart was used for the final runs.

| Run | Result |
|---|---|
| Microphone | 60.040 minutes; 28,123 frames; 124 finalized mock turns; 120 local-provider answers; 4 outages/4 explicit reviews; 0 unexpected errors; 0 missing saved finals; 99.926% nominal PCM |
| Microphone + system pipeline | 120.042 minutes; 112,486 frames; 496 finalized mock turns; 240 local-provider answers; 8 outages/8 explicit reviews; 0 unexpected errors; 0 missing saved finals; 99.952% nominal PCM |

| Run | Steady working set p50 / p95 | Peak working set | Mock final-drain notices |
|---|---|---|
| both | 442.0 / 607.4 MiB | 614.6 MiB | 0 |
| microphone | 457.6 / 762.5 MiB | 766.5 MiB | 0 |

Working sets sum processes and include shared pages. Both runs overlapped for their first hour under other test workload. CPU counters share measurement intervals and are diagnostic checkpoints, not exclusive averages. Mock drain notices are disclosed separately; the fixture does not transcribe every generated tone. These results do not grade real ASR, coding correctness or provider availability.

Frozen portable SHA-256: `e5a7e7b4bcc1d95dd60f5153f24112956e07897dcd78add5f8036f242b8846e3`. Artifact and harness hashes remained unchanged.

The remaining-budget recovery run completed the additional 50-case ceiling: eight structured screen cases passed; five of eight resume cases passed, with three company-field mismatches. The earlier failures remain recorded. Across this mixed, correlated 50-case set, 37 raw rubric passes and 13 failures were observed (including six HTTP 503 failures and one local cooldown rejection); this pooled count is not a general accuracy or availability estimate. The company-field failures need observed-value adjudication in future frozen tests; this run did not retain those values, so they are not assumed to be harmless formatting differences. Some screen timings overlapped genuine sleep and are excluded from steady-state latency claims. No further cloud calls are planned under this budget.

Final hardening also redacts credentials from JSON/SSE provider-error messages and upstream stacks. A native regression reproduces both HTTP-200 error forms. Local server readiness now explicitly probes the saved loopback model listing without conversation content; model discovery is not an offline quality or ASR/vision capability guarantee.

Fresh frozen final-candidate encrypted endurance runs started at approximately 18:30 UTC on 20 October (21 October IST): dual-source 120 minutes and microphone 60 minutes. Both passed: dual source 120.041 minutes, 112,496 frames, 496 finalized mock turns, 240 answers and eight injected outages/eight explicit reviews; microphone 60.040 minutes, 28,123 frames, 124 finalized mock turns, 120 answers and four outages/four explicit reviews. Both retained every finalized ID with zero unexpected errors and nominal PCM delivery of 99.961% / 99.925%. Frozen portable SHA-256: f85d1f0ff49f6f452ecf5ce7c6e666761cf047985e7a21faa4bfd3e13b6ef003. These results cover the frozen 0.6.0 runtime, not subsequent 0.6.1 quick-capture changes. Both use the same synthetic fake-microphone fixture per source and local mock providers under competing load, with test-only idle-display-sleep prevention.
