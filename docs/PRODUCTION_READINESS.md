# Production readiness and next patches

## Latest: 0.7.0 candidate, 21 October 2026

The six requested workstreams now have expanded source implementation and targeted validation: advanced Python/SQLite/vision fixtures, opt-in human-audio tooling, constraint/overlap handling, derived latency measurements, recovery overlay controls and installer/update/backup support. See [current quality and recovery report](QUALITY_AND_RECOVERY.md). The previous frozen 0.6.0 60/120-minute encrypted runs and hosted 0.6.1 CI passed; their earlier pending labels below are historical. No signing identity is available and the user deferred human voice validation. Those, wider hardware/accessibility and actual installer acceptance remain open gates, not completed work.

Review date: 20 October 2026. Baseline: experimental 0.5.8, plus the source changes described below. **Not yet a production reliability claim.** This review inspected response parsing, request deadlines/retries, persistence, CI configuration, and existing validation evidence. It is not an independent penetration test or exhaustive review of every dependency or hardware path.

## First patch: response integrity

Four new regressions failed against the baseline and passed after the patch:

- A text delta larger than the 200,000-character answer budget could be displayed before validation. An OpenAI-compatible completion marker in the same chunk could bypass the check entirely.
- Complete comment/metadata events could keep arriving without a cumulative stream budget.
- Gemini text arriving after a successful STOP could be appended to the completed answer.
- Valid JSON with a null, array or primitive envelope produced inconsistent errors instead of an actionable invalid-response error.

The parser now checks each delta before emitting it, caps each event at 2 Mi characters and the received stream at 8 MiB, validates object envelopes, and returns at Gemini completion. Returning or throwing closes the upstream async iterator. The JSON fallback applies the same visible-answer budget. Existing valid partial drafts remain available when a later error occurs; failed requests are not silently replayed after text appears.

These limits protect application resources. They do not validate factual correctness or guarantee model speed. Transport implementations may already allocate a chunk before passing it to the parser.

Verification: 85 deterministic tests, including the four reproduced regressions and two additional boundary/partial-draft cases; 24 source native hardening checks; complete source desktop integration with local mock providers; runtime npm audit: zero known advisories at review time. No paid provider calls were made. Existing 0.5.8 release assets do not contain this patch. See [versioned validation](VALIDATION.md) for earlier packaged, hardware and endurance results.

## Version 0.6 implementation update

A delayed-credential race was also reproduced: four overlapping calls passed a two-request limit. Answer/transcription slots are now reserved before key lookup, and cancellation is checked before upload; native regression verifies duplicate/excess calls and cancelled key lookups never upload.

Source improvements now include bounded memory-only diagnostic export, estimated speech-end/final/request/first-text/completion/save stages, origin-scoped HTTP cooldowns and jittered retries, optional Windows workspace encryption, memory-only history, retention, UTF-8 storage limits, source-line resume anchors, keyboard screenshot cropping, high-contrast styles, explicit signing support and expanded CI/release checks. These are implemented capabilities; their existence does not close every quality, hardware or availability gate below.

Local deterministic checks currently pass 102 tests, plus 24 native hardening checks and ten new native production scenarios. UI checks cover 16 view/viewport combinations and four overlay layouts. Final packaged/portable checks pass for ASAR 52a647669dd981523f2814c0d57491d77eb22dc9ce86487e32c42e6f8547e605; fresh 60/120-minute encrypted runs and hosted CI remain pending. See VALIDATION.md.

The developer evaluation corpus/runner is available; the desktop still never executes generated code. Local/offline deployment is documented, but no bundled local model or internet-disconnected quality/performance acceptance is claimed. Signing remains unavailable without an owner-provided identity, as explicitly agreed. Full human-authored held-out quality, assistive-technology testing and broader hardware coverage remain open.

Provider observations are not hidden: the first 12-case smoke passed nine narrow coding/screen/resume checks and failed three raw ASR lexical checks. In the additional budget of at most 50 cases, paired ASR checks scored SMART 8/10 and VERBATIM 9/10 under the original raw rubric. The comma-grouping difference 100000 versus 100,000 was one lexical false failure in both modes; SMART also removed an explicit contrast. Coding completed seven passing finite-case evaluations and three provider HTTP 503 failures. Screen evaluation then encountered three more 503 responses and a local cooldown rejection; the batch stopped at 34 attempts. The unrun remainder is not counted as successful. These synthetic variants do not establish population accuracy or production SLOs.

See [evaluation procedures](EVALUATION.md), [hardware operator steps](HARDWARE_VALIDATION.md), [local deployment scope](LOCAL_MODE.md) and [security/migration limits](../SECURITY.md).

## Work queue, in order

Priority P1 means required before claiming a broadly reliable production release. P2 means the next measured quality/coverage improvement. Estimates require implementation discovery; no dates are promised.

| Priority | Work | Current gap | Acceptance gate |
|---|---|---|---|
| P1 | Request and save observability | Stage export implemented; representative network/mode distributions remain unmeasured. | Content-free local stage timings, bounded retention and export; p50/p95 and failure counts by mode/network; cancellation, error and save failures included in denominators. No transcript, image, resume, key or raw provider error in metrics. |
| P1 | Provider resilience | Bounded retry hints, jitter and origin cooldowns implemented; broader outage and provider classification coverage remains. | Deterministic clock tests for supported retry hints, capped waits within remaining deadlines, cancellation during waits, cooldown recovery, quota/auth classification and no partial-answer replay. Never cycle keys or silently choose a billed fallback. |
| P1 | Answer-quality release gate | A few real-provider checks and synthetic transport tests do not establish coding, vision, grounding or ASR accuracy. | Versioned, separately held-out corpus: at least 100 ASR clips, 100 routing sequences and 50 cases each for coding, screens and resume grounding. Report critical-token errors, unsupported claims, ambiguity handling and latency together. Execute coding evaluations only in a separate restricted runner. |
| P1 | Privacy and retention | Optional Windows encryption, memory-only storage and retention implemented; exports and default persistent storage remain plaintext unless encryption is selected. | Explicit no-history mode and retention controls; deletion verified against primary/recovery copies; encryption design includes recovery and key-loss behavior before opt-in encryption ships. Document provider data-use limitations. |
| P1 | Build/release gates | Expanded pinned workflow and signing support prepared; hosted acceptance and actual signing identity remain pending. | CI gates for supported automated integration checks, immutable action revisions, clean source/asset identity, secret scanning, dependency/license inventory, tamper verification and signed Windows artifacts. Signing requires a real signing identity/service. |
| P1 | Failure and hardware matrix | One laptop sleep check and synthetic soaks leave driver, real-loopback, network and crash gaps. | Declared supported Windows versions/devices; real microphone and loopback tests; packet loss, offline/reconnect, DNS/TLS failure, low disk, forced process termination, device removal and sleep during capture/save. Verify retained drafts and recording stays stopped after recovery. Dock tests require that hardware. |
| P2 | Resume evidence | Normalized source-line anchors implemented; real-world unsupported-claim grading and user confirmation need broader evidence. | Facts tied to reviewed source spans/dates; ambiguity prompts for missing/conflicting facts; tests prohibit invented employers, tenure and metrics. |
| P2 | Screen understanding | Capture/crop/expiry exist; broad small-text, diagram, code and multi-monitor accuracy is unmeasured. | Screens at representative DPI, light/dark, small fonts and image layouts; preview readability checks; explicit uncertainty or recapture for unreadable content. Preserve consent/expiry and never store screenshot pixels in history. |
| P2 | Measured model routing | Fast/Balanced/Careful use policies, but the best quality/latency tradeoff is unproven. | Same holdout inputs across eligible model configurations, quota/cost declaration, comparable correctness and latency tables; keep user-selected provider policy intact. |
| P2 | Long-session resource budgets | Earlier real-time synthetic endurance passed, but it is versioned evidence and not a model or broad hardware benchmark. | Repeat on each material audio/runtime change; memory growth, PCM progress, final-turn retention and error budgets on declared hardware. Preserve failed-run receipts. |
| P2 | Accessibility and usability | Contrast/resizing checks exist; screen-reader, high contrast, keyboard-only and real-user task coverage is incomplete. | Complete setup, audio, screen review, recovery and export with keyboard/screen reader; 200% scaling, reduced motion, clear focus/errors and readable overlay over varied backgrounds. |
| P2 | Local/offline operation | Loopback configuration is supported; a bundled verified offline stack is not. | Explicitly selected local ASR/OCR/model tested with internet disabled and constrained CPU/RAM. Declare accuracy, speed and resource requirements rather than claiming cloud behavior offline. |
| P2 | Support and migration | Portable operation works; broader schema migrations and user diagnostics need release gates. | Backup/restore across supported versions, downgrade behavior, sanitized opt-in diagnostic bundle, clear reset/export instructions and reproducible bug template. |

## Definition of a production candidate

Close P1 gates with receipts tied to the exact source revision and packaged hashes. Publish measured scope, failures and limitations; passing unit tests alone is insufficient. Expand the hardware and quality matrix over time. Do not label earlier endurance runs as evidence for a new binary without checking relevant changes and repeating required gates.

There is no defensible promise of 100% correct real-time AI answers, universal screen-share invisibility, unlimited free quota or guaranteed availability. Define and measure availability, transcription quality, answer correctness, recovery and latency separately. The next implementation batch should start with local stage metrics and a deterministic provider retry/cooldown harness, then use those measurements to select optimization work.

The remaining-budget recovery run completed the additional 50-case ceiling: eight structured screen cases passed; five of eight resume cases passed, with three company-field mismatches. The earlier failures remain recorded. Across this mixed, correlated 50-case set, 37 raw rubric passes and 13 failures were observed (including six HTTP 503 failures and one local cooldown rejection); this pooled count is not a general accuracy or availability estimate. The company-field failures need observed-value adjudication in future frozen tests; this run did not retain those values, so they are not assumed to be harmless formatting differences. Some screen timings overlapped genuine sleep and are excluded from steady-state latency claims. No further cloud calls are planned under this budget.

Final hardening also redacts credentials from JSON/SSE provider-error messages and upstream stacks. A native regression reproduces both HTTP-200 error forms. Local server readiness now explicitly probes the saved loopback model listing without conversation content; model discovery is not an offline quality or ASR/vision capability guarantee.
