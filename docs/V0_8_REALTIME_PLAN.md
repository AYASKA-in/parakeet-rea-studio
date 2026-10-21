# v0.8.0 plan: real-time quality, reliability and speed

Status: proposed implementation plan, 21 October 2026. This document changes no runtime behavior. Targets below are provisional acceptance criteria, not measured results or availability guarantees.

## Baseline and scope

Extend v0.7.0 rather than duplicate its diagnostics, retry controls, overlay health, correction handling and evaluation runner. Current evidence is summarized in QUALITY_AND_RECOVERY.md. Its public developer corpus contains 58 coding, 57 screen and 52 grounding cases, 100 synthetic ASR clips and 100 routing sequences. Small correlated provider samples and local mock tests do not establish population accuracy or internet performance. Human voice acceptance remains deferred.

Deliver five workstreams: representative benchmarks, conversation state, actionable health, end-to-end timing and grounded answers. Preserve existing encrypted credentials, history preferences and explicit capture permissions. This plan authorizes no recordings or cloud requests; live runs require a bounded approved budget and consent for human audio.

## Provisional operating targets

Measure on a declared Windows reference device, model configuration, input size and network profile. Start with a named standard-network test profile of 20 Mbps download, 5 Mbps upload and 80 ms added round-trip latency; keep a separate constrained profile of 1 Mbps download, 256 Kbps upload and 300 ms added RTT. These describe injected conditions, not every user's connection.

| Measure | Standard-network provisional gate |
| --- | --- |
| Question end to first useful spoken-question answer | p50 <= 3 seconds; p95 <= 7 seconds |
| Screenshot click to first useful answer | p50 <= 4 seconds; p95 <= 9 seconds |
| Question end to completed short answer | p50 <= 7 seconds; p95 <= 15 seconds |
| Screenshot click to completed coding answer | p50 <= 12 seconds; p95 <= 25 seconds, fixed output/task size |
| Durable save after completed answer, persistent history enabled | p95 <= 500 ms on reference storage |
| Visible capture/request state after user action | <= 250 ms; slow status after 5 seconds without useful output |
| Application-controlled attempt integrity | >= 99% across 1,000 controlled fault/recovery attempts; zero silent loss, duplicate answers or ignored cancellation |

Report constrained-network performance separately; do not claim the standard-network targets there. Preserve bounded queues and resource use, visible network state and explicit recovery. Set finite per-mode deadlines after baseline measurements. Do not let retries extend the original deadline.

Report total successful, incorrect, clarification, partial, timeout, cancelled, auth/quota, transport and save-failure counts. All attempts remain in reliability denominators; latency quantiles show their sample counts and completion/timeout distributions. Application integrity is distinct from provider availability and answer correctness.

First useful output means content that starts addressing the actual task. The existing 40-character proxy remains explicitly a proxy until compared against human-labelled samples. Separate estimated speech-end timing from manually annotated endpoints. Never substitute request-to-token time for full question-end-to-answer time.

## 1. Representative benchmarks

Build a versioned development set and a separate private, independently authored holdout. Do not tune prompts on holdout failures and continue calling that set held out. Rotate exposed cases into development and create a fresh holdout. Keep private fixtures, consented recordings and expected answers outside the public source release.

Minimum evaluation corpus:
- 100 coding problems: algorithms, debugging, SQL and realistic input/output contracts. Initially retain Python/SQLite and add JavaScript; add C++/Java only with independently validated compiler runners.
- 100 screen problems: small text, high DPI, dark/light themes, code indentation, diagrams, long statements, bottom-edge constraints, clipping, contradictory and unreadable inputs.
- 100 consented ASR clips from at least 10 speakers across declared accents, plus 100 turn sequences with interruptions, corrections, pauses, overlapping audio and unfinished constraints.
- 50 grounding tasks covering supported facts, absent employers, metrics, dates, conflicting resume content and document instruction injection.

Keep finite hidden tests outside model requests. Use the existing separate restricted runner for generated code, with CPU/memory/time/process/output limits, no network, no credentials and no host mounts. Never execute generated code in the desktop app. Add boundary/property tests and misleading solutions so the evaluator itself is checked.

Score coding pass@1 and all-case test success; screen fact/constraint extraction and final solution separately; ASR word error, numbers/negation/identifier preservation and turn boundaries; grounding supported claims, appropriate clarification and unsupported claims. Report performance per difficulty slice with uncertainty and sample size.

Provisional quality gates: >= 90% coding test-pass rate and >= 95% required screen-constraint extraction on the declared supported suite; >= 95% correct clarification on unreadable/missing inputs; >= 98% critical-token accuracy on clean declared speech conditions, with noisy/overlap conditions reported separately. Zero observed unsupported resume claims or document-instruction execution in the release suite. Zero observed is not a universal guarantee. Establish baseline first, report misses and do not lower a gate merely to ship.

## 2. Conversation understanding

Extend renderer/question-queue.js, renderer/audio.js, audio activity and live-session modules with explicit state:
Listening -> possible question -> waiting for constraints -> ready -> answering -> completed.
Corrections create a new question revision. Ambiguity or overlapping sources enters needs review.

Keep interim and finalized transcript revisions distinct. Preserve verbatim recognized words, original text and user edits; normalization must not silently change not/less than/greater than, decimals, units, identifiers or limits.

Use adaptive endpointing: begin with a 600-900 ms quiet window, but use unfinished syntax, explicit continuation and correction cues to wait longer. These are tunable starting points, not universal pause rules. Provide Answer now and Hold controls. Bound automatic waiting to an initial 5-second review threshold: show the incomplete question for confirmation instead of sending a speculative answer.

Prepare context while speech is arriving; trigger answer generation only after readiness. A correction invalidates pending work using request IDs and question revisions. Cancel stale generation; retain an already visible draft with its superseded status, and do not silently generate an additional billed replacement.

Keep microphone and call audio separate. Preserve system-audio routing for interviewer questions. Distinguish signal energy, device availability and recognized speech; overlapping energy is an ambiguity/echo signal, not reliable speaker identification. For source removal, gaps or resume from sleep, require explicit restart where capture was stopped.

Gate: no premature answer in known unfinished/corrected cases; no stale answer attached to a newer revision; final constraints preserved in >= 95% of independently labelled turn sequences. Report false holds and response delay alongside this score.

## 3. Actionable overlay health

Extend existing overlay states rather than add a separate dashboard. Show a compact current state and the most useful recovery action:
- Mic / Call: off, quiet, signal detected, device unavailable or reconnecting.
- Speech: receiving, finalizing, gap detected or needs review.
- Answer: queued, responding, partial, complete or failed.
- Provider: observed connectivity, retry countdown, quota, authentication or deadline reached.
- Save: saved, memory-only or save failed.

Use text and icons as well as color. Keep white text readable independently of glass/background opacity. Preserve keyboard navigation, focus and accessible announcements without speaking every streamed token.

Use observed successful requests and failures; an operating-system online flag is not proof of provider health. Poll no cloud health endpoint continuously. Show only one primary recovery action: Restart capture, Review question, Retry, Capture again or Open settings. A screenshot retry requiring new pixels must explicitly recapture; never silently reuse a stale image.

Gate: inject every supported failure and verify the right status/action appears, drafts survive as designed, quiet is not called broken and no retry happens after partial output without user action. Perform Narrator/hands-on readability acceptance when the user is ready.

## 4. End-to-end speed and bounded recovery

Extend electron/diagnostics.cjs and scripts/verify-latency.cjs with one content-free attempt ID and question/screen revision. Record capture start/end, estimated question end, transcript final, queue wait, request start, first token, first useful proxy, complete, rendered and durable-save acknowledgement. Keep clock origins explicit; use monotonic time and convert cross-process timings safely.

Optimize after baselining:
1. Remove duplicate work and measure context assembly, image encoding and IPC separately.
2. Preserve reusable context and source indexes locally; do not cache secrets or silently reuse stale screenshots.
3. Stream useful content early with bounded output appropriate to short explanation versus complete code.
4. Compress screenshots adaptively only after readability/constraint tests; avoid excessive downscaling of small text. Use selected-display/full-frame capture with optional user-approved crop; unseen scroll content requires another capture.
5. Use bounded queues, latest-revision priority, cancellation and backpressure. Never silently drop a question.
6. Respect retry hints and origin cooldowns with jitter inside the same deadline. Authentication and exhausted quota require action, not retry storms.
7. Select a documented primary/fallback model from measured task accuracy and latency. No assumed permanent free tier, unapproved billed fallback, key cycling or automatic parallel requests.
8. Reserve a second verification request for explicitly enabled high-risk cases. Include its time, failures and requests in the budget; do not call every answer twice.

Run normal, slow upload/download, offline/reconnect, 429, 503, DNS/TLS failure, socket reset, stream stall, partial answer, cancellation, device loss and save failure. Report question-end latency, throughput and resource limits under continuous operation. Establish a measurable improvement over baseline without quality regression.

A text-only queued attempt may be offered for explicit retry after reconnect; offline must never be shown as successful. Local-model mode can be evaluated separately if configured, with no unvalidated offline quality claim.

## 5. Grounded answers and readable-screen decisions

Replace the narrow employer-string safeguard in electron/grounding.cjs with structured evidence linked to reviewed resume source spans. Distinguish supported, conflicting and absent facts. Evidence extraction can be wrong: do not present model-generated confidence percentages as calibrated certainty.

For personal-history questions, cite the relevant local source span in the UI. Prevent invented employers, tenure, qualifications and metrics. Phrase missing information as a short clarification; offer a generic answer only with a clear label and no claim that it describes the user.

For screens, extract the visible task, inputs/outputs, constraints, examples and unreadable regions before answering. Compare the answer against that extracted contract. Do not infer clipped bottom-of-screen text or content outside the captured display. Avoid silently assuming the programming language or input contract.

Untrusted transcript, resume and screen content are evidence, not application instructions. Retain instruction-injection cases. For coding, structure the answer as approach, code, complexity and key edge cases; expose assumptions only when needed. Optional additional verification remains bounded and user-configured.

Gate: supported-answer tests, missing/conflicting evidence, unreadable screens, critical numeric constraints and injection tests pass; publish observed unsupported-claim and clarification rates. Do not describe plausible or self-reviewed code as compiled/tested unless it was actually evaluated in the separate runner.

## Delivery order and release decision

Phase A: freeze the baseline, define event meanings, validate the evaluator and build the private holdout. Deliver baseline report with quality, p50/p95, attempts, failures and request counts.

Phase B: implement revision-aware conversation state and the compact health/recovery surface. Deliver deterministic interruption/correction/device/provider failure scenarios and operator controls.

Phase C: implement structured grounding and screen contract extraction. Run local fixtures before limited cloud checks. Tune on development cases only.

Phase D: optimize measured bottlenecks, image transport and model routing; rerun equivalent cases with all additional requests counted. No model/version switch without measured evaluation.

Phase E: freeze source/model configuration, run fresh holdout, controlled network matrix and a two-hour continuous session. Complete consented human speech and accessible operator checks when available. Publish portable/installer artifacts only with exact source revision, checksums, known limitations and honest unsigned/signed status.

Each phase must retain existing v0.7.0 regression checks and produce a report. Block release on silent data loss, stale-answer attribution, unconsented capture, secret leakage, unbounded retries or known critical unsupported personal claims. If quality or speed goals fail, report the result and keep experimental status; do not imply 100% correctness or availability.
