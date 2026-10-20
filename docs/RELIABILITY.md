# Reliability and validation

This is experimental software. A successful request does not prove a correct answer. Measure audio delivery, critical-word transcription accuracy, question-routing precision/recall, answer correctness, personal-fact grounding, display/storage and latency separately.

Version 0.5.8 adds a desktop UI refresh; its current UI/native/portable checks and the separately versioned 0.5.7 endurance baseline are recorded in [validation](VALIDATION.md).

## Verified scope

The 0.5.7 unit suite has 79 cases. Packaged local-provider desktop integration covers audio, streamed answers, PDF import, export, screen capture exclusion, overlay behavior and browser contrast. The native hardening suite has 24 cases including storage/policy failures, stale operations, power-event overlap, stopped recording after recovery and retained partial answers. These tests use synthetic inputs and do not grade cloud-model semantics.

A genuine Modern Standby sleep/wake check on one ASUS Windows laptop passed on 0.5.6: actual suspend/resume events, stopped capture after wake, retained 100 synthetic sessions, explicit restart/stop. Its test controller disconnected across sleep; reconnecting to the same surviving app and restoring the closed local provider completed the check. No dock/external monitor was available. This is not a claim of exhaustive sleep/driver/hardware coverage.

An initial 0.5.6 microphone-only 60-minute soak passed. Its dual-source run found a real pre-send disconnect race at about 85 minutes. Version 0.5.7 buffers that known-unsent frame through bounded recovery; new tests cover the race, stale callbacks and no replay for unknown send failures. An explicit native window level also preserves the overlay's topmost flag on this machine.

Hidden unregistered WebAudio fixtures also exposed a slow processing clock. Visible and explicit foreground-renderer controls kept pace. The app retains normal renderer priority while hidden and now stops with a saved warning if its audio clock lags materially behind wall time. A silent-output-sink experiment failed acceptance and was reverted. The final harness defaults to Chromium's registered fake microphone for each source; it never captures actual microphone/system content. Both sources receive the same synthetic speech fixture through separate production pipelines. The older WebAudio fixture remains available with `--web-audio-fixture` for reproduction.

Longer controls showed that foreground priority and keeping the display awake were insufficient. A Windows per-process timer-policy diagnostic restored real-time progression after the clock slowed; an integrated eight-minute control then passed. The original `native/TimerPolicy.cs` helper now disables **ignore timer-resolution requests** only for this app's own executable/child processes while listening, periodically checks the policy, preserves original snapshots and restores the timer bit on stop/suspend/crash cleanup/quit. Executable identity and process start-time checks prevent stale restoration to a reused PID. No other app or system power plan is changed. See [Microsoft's timer-policy reference](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-setprocessinformation).

The helper uses Windows' .NET Framework runtime, normally included with Windows 11. Original source ships in the repository; the portable EXE bundles the compiled helper. An unavailable optimization produces a saved warning, while the independent clock guard stays active.

Final 0.5.7 real wall-clock acceptance passed: microphone 60.040 minutes and dual-source 120.042 minutes. Both retained all mock-finalized IDs, met the declared continuous-PCM threshold and recorded no unexpected errors. See [complete measured results and caveats](VALIDATION.md). These are synthetic processing/storage/recovery checks, not model-accuracy benchmarks.

The actual portable EXE passes isolated extraction, app/helper hash equality, local-provider typed answer and synthetic microphone PCM, saved history, capture-protection status and graceful launcher exit. This is separate from testing `win-unpacked`.

## Endurance harness

`npm run test:soak -- --minutes=120` uses both synthetic sources; add `--single --minutes=60` for microphone only. It launches packaged production code with a private profile, real WebAudio/AudioWorklet, 99 historical sessions plus one active session and a loopback provider. No user key or real microphone/video is used. Faults deliberately disconnect Live connections at minute 10 and every 15 minutes afterward. The harness explicitly reviews/sends held synthetic questions after reconnect; the production app does not silently resume held questions.

Receipts retain duration, frame/payload counts, final transcripts, answer counts, faults/review actions, process working-set/CPU samples and workspace bytes. Assertions require sustained capture, unblocked runtime, 100 retained sessions, every mock-finalized ID saved at normal stop and no unexpected renderer/Live error. Hidden windows and temporary test-only idle-sleep blocking are declared. Two concurrent runs are competing load, not an idle-laptop benchmark. Working-set sums include shared pages; payload bytes exclude base64/WebSocket/TLS overhead.

## What is not guaranteed

Endurance uses a temporary test-only display-sleep blocker and does not change the system power plan. Electron process CPU counters share measurement intervals with the timer service's discovery calls; checkpoint percentages are diagnostic samples, not exclusive 30-second averages. Prefer the published duration, throughput, final-ID retention and error outcomes for acceptance.

- Perfect recognition of accents, noise, overlapping speakers, numbers, negation or technical identifiers.
- Perfect routing/completion judgment for every language or indirect question.
- Correct coding, factual or personal answers. Generated code is not executed by the app.
- Universal capture invisibility, lossless arbitrary-outage recovery, offline cloud AI or unlimited free-tier capacity.
- A complete multilingual/vision/coding quality benchmark, bundled offline model, verified provider session resumption or signed release/update chain.

Google's [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) are project-wide and actual capacity can vary. Another key in the same project does not create independent availability. More model calls add latency and can share the same mistakes.

## Optimization roadmap

Bounded real Gemini checks on 20 October 2026 passed synthetic speech (16.905 seconds including capture/drain), a coding response (14.488 seconds, displayed/static checks only) and a scanned fake resume (4.582 seconds). One screenshot request reached its 90-second deadline; one focused retry returned the correct arithmetic result in 8.773 seconds. Both attempts are retained in redacted local receipts, and test credential copies were cleared. These individual stages do not establish typical latency, broad accuracy or a 100% provider success rate.

1. Add content-free timing/outcome counters from question end through final transcript, queue, first text, completion and durable save. Publish p50/p95/errors per mode/network.
2. Add capped deadline/backoff/jitter/circuit-breaker behavior with provider-specific quota classification, supported Retry-After and no replay after partial answers.
3. Benchmark critical-token recognition and clarification on ambiguity, using 100+ consented/synthetic ASR clips and 100+ routing sequences with an untouched holdout.
4. Benchmark Fast/Balanced/Careful model routing. Keep one call for clear short tasks; spend reasoning only where difficult code/ambiguity warrants it.
5. Add reviewed resume evidence spans/dates and challenge unsupported personal claims.
6. Evaluate 50+ screen, coding and grounding cases each. Execute model code only in a separate no-network/no-host-files/resource-limited evaluation runner.
7. Benchmark explicitly configured local ASR/OCR/models with internet disabled and CPU contention before claiming offline operation.
8. Broaden hardware/network/crash testing and sign releases.

Provisional short-question target: first text p50 ≤3 seconds, p95 ≤8 seconds from question end on a declared usable network; this includes finalization/pause/upload. Complex coding needs a separate budget. These are targets, not measured service guarantees. Correctness and abstention must be reported alongside speed.

Even zero failures in 1,000 independent representative trials gives an approximate 95% failure-rate upper bound of 0.3%, not zero. Correlated audio chunks from one fixture are not independent interview trials. Finite evidence supports improvement, never a universal 100% claim.
