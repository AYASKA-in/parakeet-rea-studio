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
- These tests establish local behavior, not internet latency targets, model quality, broad accent/device coverage or production availability.

Commands:
- npm test
- npm run test:realtime
- npm run test:realtime:desktop
- npm run test:latency
- npm run test:ui
- npm run test:desktop

CI is configured to run the new desktop scenarios against the packaged app and retain their synthetic summary and content-free diagnostics. Hosted results are not yet claimed for this source change.

## Remaining work, in order

1. Freeze a representative baseline and validate benchmark scoring/input contracts; author a fresh independent private holdout and expand multi-language/vision cases.
2. Validate endpoint/correction behavior on consented real speech, including accents, long pauses and overlap. Current quiet windows are retained until evidence supports shortening them.
3. Expand semantic screen contract extraction and resume claim/date/metric grounding beyond employment cues.
4. Measure network bottlenecks and choose task/model/image optimizations using accuracy and end-to-end latency together. No unapproved parallel requests, paid fallback or new cloud benchmark budget is introduced here.
5. Run the frozen holdout, constrained-network matrix, fresh endurance and deferred hardware/accessibility checks before a new release.

See [the full plan](V0_8_REALTIME_PLAN.md). Its speed and accuracy thresholds remain proposed acceptance targets.
