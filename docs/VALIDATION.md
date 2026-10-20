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
| Dual-source endurance | **Still running at initial publication. Not yet a completed 120-minute result.** |

The two-hour test continues in its original process; publication does not reset its elapsed time. Its completed report must pass the declared hash, throughput, warning and retention gates before this page is updated.

Real Gemini synthetic checks passed speech (16.905 s including capture/drain), a coding response (14.488 s; displayed/static checks), and a scanned fake resume (4.582 s). The first screenshot request timed out at about 90 seconds; one focused retry returned the correct arithmetic answer in 8.773 s. Both attempts were retained. These are individual samples, not typical-latency or accuracy benchmarks.

Actual Modern Standby sleep/wake passed on the 0.5.6 baseline on one ASUS Windows laptop; capture stayed off after wake, 100 sessions remained and explicit restart worked after reconnecting the test controller. Version 0.5.7 adds native recovery/timer-policy regressions; it has not had a new physical sleep trial. No dock/external monitor was available.

Endurance uses synthetic Chromium fake microphone inputs, real production processing/storage and a local mock provider, hidden windows and temporary test-only display-sleep blocking. Both source pipelines receive the same synthetic WAV. No private audio, cloud ASR or semantic answer quality is graded. Working-set totals include shared pages; CPU samples share measurement intervals with the timer service. Finalized-ID retention is not transcription accuracy.

The EXE is unsigned. See [reliability and remaining work](RELIABILITY.md), [security](../SECURITY.md) and [release procedure](RELEASING.md).
