# Version 0.5.7 validation

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
