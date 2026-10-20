# Reliability and validation

This is experimental software. A successful request does not prove a correct answer. Measure audio delivery, critical-word transcription accuracy, question-routing precision/recall, answer correctness, personal-fact grounding, display/storage and latency separately.

## Verified scope

The 0.5.7 unit suite has 75 cases. Packaged local-provider desktop integration covers audio, streamed answers, PDF import, export, screen capture exclusion, overlay behavior and browser contrast. The native hardening suite has 22 cases including storage/policy failures, stale operations, power-event overlap, stopped recording after recovery and retained partial answers. These tests use synthetic inputs and do not grade cloud-model semantics.

A genuine Modern Standby sleep/wake check on one ASUS Windows laptop passed on 0.5.6: actual suspend/resume events, stopped capture after wake, retained 100 synthetic sessions, explicit restart/stop. Its test controller disconnected across sleep; reconnecting to the same surviving app and restoring the closed local provider completed the check. No dock/external monitor was available. This is not a claim of exhaustive sleep/driver/hardware coverage.

An initial 0.5.6 microphone-only 60-minute soak passed. Its dual-source run found a real pre-send disconnect race at about 85 minutes. Version 0.5.7 buffers that known-unsent frame through bounded recovery; new tests cover the race, stale callbacks and no replay for unknown send failures. An explicit native window level also preserves the overlay's topmost flag on this machine.

Hidden unregistered WebAudio fixtures also exposed a slow processing clock. Visible and explicit foreground-renderer controls kept pace. The app retains normal renderer priority while hidden and now stops with a saved warning if its audio clock lags materially behind wall time. A silent-output-sink experiment failed acceptance and was reverted. The final harness defaults to Chromium's registered fake microphone for each source; it never captures actual microphone/system content. Both sources receive the same synthetic speech fixture through separate production pipelines. The older WebAudio fixture remains available with `--web-audio-fixture` for reproduction.

Final 0.5.7 uninterrupted 60/120-minute results belong in release notes after real wall-clock completion. Do not interpret a one-minute preflight, simulated clock or partially completed soak as long-session acceptance.

## Endurance harness

`npm run test:soak -- --minutes=120` uses both synthetic sources; add `--single --minutes=60` for microphone only. It launches packaged production code with a private profile, real WebAudio/AudioWorklet, 99 historical sessions plus one active session and a loopback provider. No user key or real microphone/video is used. Faults deliberately disconnect Live connections at minute 10 and every 15 minutes afterward. The harness explicitly reviews/sends held synthetic questions after reconnect; the production app does not silently resume held questions.

Receipts retain duration, frame/payload counts, final transcripts, answer counts, faults/review actions, process working-set/CPU samples and workspace bytes. Assertions require sustained capture, unblocked runtime, 100 retained sessions, every mock-finalized ID saved at normal stop and no unexpected renderer/Live error. Hidden windows and temporary test-only idle-sleep blocking are declared. Two concurrent runs are competing load, not an idle-laptop benchmark. Working-set sums include shared pages; payload bytes exclude base64/WebSocket/TLS overhead.

## What is not guaranteed

- Perfect recognition of accents, noise, overlapping speakers, numbers, negation or technical identifiers.
- Perfect routing/completion judgment for every language or indirect question.
- Correct coding, factual or personal answers. Generated code is not executed by the app.
- Universal capture invisibility, lossless arbitrary-outage recovery, offline cloud AI or unlimited free-tier capacity.
- A complete multilingual/vision/coding quality benchmark, bundled offline model, verified provider session resumption or signed release/update chain.

Google's [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) are project-wide and actual capacity can vary. Another key in the same project does not create independent availability. More model calls add latency and can share the same mistakes.

## Optimization roadmap

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
