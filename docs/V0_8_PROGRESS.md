# v0.8.0 development progress

Status: source changes only, 21 October 2026. Published v0.7.0 EXEs do not contain this work. Runtime package version remains 0.7.0 until a release candidate is prepared.

## First implementation slice

- Added renderer-local monotonic attempt timings shared by audio, typed, screen and notes requests. Screen attempts begin before capture; failed/cancelled captures count as attempts without fabricated generation completion.
- Diagnostic schema 3 includes capture, first nonempty workspace DOM update, generation completion, attempt end and save stages, plus random main-process attempt IDs. It distinguishes estimated speech endpoints from finalized-transcript and request/capture origins. Unknown speech endpoints stay unknown; known transcript-to-request queue time remains measurable.
- Exports explicitly identify the 40-character useful-text heuristic as a proxy, not a semantic judgement. Retention reports total versus retained/evicted attempts; failures, cancellations and save failures remain visible. No image, transcript, resume, key or raw provider-error text is added to diagnostics.
- Recent same-source spoken corrections, including corrections during a slow active answer, retain the original question, acquire a new local revision and require review. A matching active generation is cancelled, partial text remains available, and replacement generation requires an explicit send. Clear/cancel removes remembered correction context. This is deterministic cue handling, not full speaker diarization or unrestricted natural-language correction understanding.
- Added Hold / Resume auto draft controls in the workspace and overlay. User Hold survives subsequent finalized constraints. Answer now explicitly sends the visible pending question.
- Tightened the employment preflight: whole-name checks, explicit employment/source-line cues and conflicting negative statements. A skills mention or target-company reference does not establish employment. This remains a conservative heuristic; complex resumes, dates, metrics and arbitrary personal claims still need broader structured evidence work and real evaluation.

## Local validation

- Fourteen new deterministic regression tests cover late corrections, source isolation, persistent Hold, capture timing/failure, first-stage immutability, known/unknown endpoints, diagnostic retention and employment evidence.
- The isolated synthetic desktop runner exercises Hold/resume, cancellation after a correction, no automatic replacement, explicit revised requests, failed/successful capture accounting and first rendered text. Its fake microphone, loopback provider and synthetic desktop thumbnail do not record a real microphone, capture real screen pixels or contact a cloud provider. Production screenshot lease validation is retained.
- Existing seven local latency/fault scenarios and source desktop integration were run. UI validation covers 16 view/viewport combinations, four overlay layouts, text contrast and keyboard navigation.
- These local checks establish behavior, not internet latency targets, model quality, broad accent/device coverage or production availability. The later six-case live sample is documented separately below.

Commands:
- npm test
- npm run test:realtime
- npm run test:realtime:desktop
- npm run test:latency
- npm run test:ui
- npm run test:desktop

CI is configured to run the new desktop scenarios against the packaged app and retain their synthetic summary and content-free diagnostics. Hosted results are not yet claimed for this source change.

## Second implementation slice — 22 October 2026

- Added six JavaScript coding, five screen and eight grounding development fixtures. Corpus totals are 64 coding, 62 screen and 60 grounding cases; the ASR/routing counts remain 100 each.
- Added a pinned restricted Node runner and executable fixture validation. Reference solutions, wrong code/syntax, input mutation, execution/output limits and container controls are exercised locally. Expected outputs stay outside provider requests.
- Added strict structured grading, optional case-sensitive critical-token scoring and a content-free report CLI that preserves failure/unrun denominators and source provenance.
- Evaluator schema 3 separates provider, grading and total duration. Historical metrics remain unknown rather than invented.
- Six real Gemini smoke cases passed their finite rubrics. See [dated evidence](V0_8_SMOKE_2026_10_22.md) for the small sample and latency limits. This does not qualify the larger holdout.
- Added visible slow-response/paused-stream states and Stop answer in the overlay, with two new cancellation/fault scenarios. No automatic replay or provider-health polling was introduced.

## Remaining work, in order

1. Broaden the initial six-case live baseline; author a fresh independent private holdout and expand language/vision coverage. Scoring/input-contract validation and the first content-free baseline are now implemented.
2. Validate endpoint/correction behavior on consented real speech, including accents, long pauses and overlap. Current quiet windows are retained until evidence supports shortening them.
3. Expand semantic screen contract extraction and resume claim/date/metric grounding beyond employment cues.
4. Measure network bottlenecks and choose task/model/image optimizations using accuracy and end-to-end latency together. No unapproved parallel requests, paid fallback or new cloud benchmark budget is introduced here.
5. Run the frozen holdout, constrained-network matrix, fresh endurance and deferred hardware/accessibility checks before a new release.

See [the full plan](V0_8_REALTIME_PLAN.md). Its speed and accuracy thresholds remain proposed acceptance targets.
