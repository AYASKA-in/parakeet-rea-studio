# Actual desktop timing — 22 October 2026

**Validation run completed:** 12 authorized Gemini requests, nine real desktop app answer flows, nine completed generations and nine matching answers verified in the saved workspace file. No retries, reconnects, authentication/quota failures or premature answers were observed. This validates the measured flow on this laptop; it does not establish a production availability or accuracy percentage.

Published v0.7.0 EXEs are unchanged. This is an unreleased source measurement, with instrumentation and source hashes recorded in [V0_8_DESKTOP_SPEED_SUMMARY.json](V0_8_DESKTOP_SPEED_SUMMARY.json). All 12 requests in this allowance are used; no further cloud run is scheduled automatically.

## Measured results

Answer model: `gemini-3.5-flash-lite`. Speech model: `gemini-3.5-transcribe-live`, VERBATIM. App answer mode was Balanced; the default direct-screenshot route selected Detail/HIGH thinking. Typed and spoken conceptual questions used MEDIUM thinking. These policy choices are part of the measured behavior, not assumed equivalent task budgets.

On the current, unshaped connection, two repetitions per route produced these observed ranges:

| Route | First workspace text | First glass-overlay text | Completed answer visible | Local save acknowledged |
| --- | --- | --- | --- | --- |
| Typed question click | 4.107–4.248 s | 4.156–4.295 s | 4.742–5.365 s | 4.748–5.384 s |
| Screenshot answer click | 4.499–4.580 s | 4.547–4.635 s | 5.005–5.020 s | 5.009–5.024 s |
| Synthetic speech endpoint | 7.220–7.768 s | 7.205–7.740 s | 7.719–8.214 s | 7.725–8.218 s |

The same inputs were also tested once per route with application-level HTTP pacing:

| Route | First workspace text | First overlay text | Completed answer visible | Local save acknowledged |
| --- | --- | --- | --- | --- |
| Typed | 4.475 s | 4.482 s | 5.328 s | 5.333 s |
| Screenshot | 5.656 s | 5.711 s | 5.961 s | 5.966 s |
| Synthetic speech | 8.885 s | 8.858 s | 9.466 s | 9.471 s |

The paced profile adds 300 ms before the HTTP request, budgets its body at 256 Kbps and spaces response chunks at 1 Mbps. It does not shape WebSocket transcription or emulate TCP/TLS/loss/OS networking. With one paced sample per route, differences cannot be attributed solely to pacing; provider variability also changes results.

These tables use observed ranges, not population p95 claims. The JSON includes nearest-rank quantiles and their sample counts; with one or two repetitions their upper quantile is just the largest observation.

## What was actually exercised

- **Typed:** real click -> application IPC/credential retrieval -> real streamed Gemini answer -> workspace and overlay DOM -> completed answer -> local save acknowledgement. The persisted answer and completed status were verified from `workspace.json`, beyond an in-memory success message.
- **Speech:** one Windows-synthesized, 6.4-second question -> silent WebAudio microphone substitute -> production AudioCapture and PCM worklet -> real Gemini Live WebSocket -> two finalized transcript segments -> automatic question assembly and quiet-window scheduling -> real streamed answer -> both UIs -> disk save. All three runs preserved the entire question and its second-sentence constraint in the queued question. No real microphone or speaker playback was used.
- **Screenshot:** real Answer screenshot action -> production encoding, capture lease/validation and request path -> real Gemini vision answer -> both UIs -> disk save. Native desktop acquisition was replaced with a synthetic screenshot fixture, so its hardware/compositor cost is **not included**. No real desktop pixels were uploaded.

First-text timestamps come from MutationObservers in the real workspace and overlay. They measure DOM text availability, not physical monitor paint or an accessibility reader's speech. Overlay comparisons use the renderer performance time origins; they are not a calibrated sub-millisecond display measurement. Typed/screenshot origins are actual DOM click events, avoiding Playwright click scheduling time. Speech origin is the scheduled end of the synthetic input signal above a fixed PCM amplitude threshold; it is not an independently annotated human acoustic endpoint. The app's estimated audio endpoint remains separately visible in its diagnostic stages.

The first 40 non-markup characters became visible with the first text in these samples. Inspection found task-related content in the prefixes, with a heading before one typed explanation. That does not turn the 40-character heuristic into a validated semantic useful-answer detector. Complete-answer timing is the UI's final rendering state; the application also records generation-completion and save stages separately. Save acknowledgements followed application completion by 4–20 ms in these nine attempts.

Instrumentation adds request-budget bookkeeping, DOM observers and diagnostic export polling. Its overhead is included, not subtracted. No instrumentation-free comparison was measured.

## What explains the speech delay

On the two unshaped speech runs:

| Stage | Observed interval |
| --- | --- |
| Scheduled synthetic endpoint -> last finalized transcript | 1.382–1.400 s |
| Last finalized transcript -> answer request | 2.202 s |
| Answer request -> first answer text event | 3.577–4.114 s |

The remaining visible delay includes rendering and event delivery. Local saving is a small part of the measured total. The quiet window protects unfinished questions; shortening it without correction/overlap evidence would trade reliability for apparent speed.

The conceptual question requested two short sentences, but the coding-keyword policy classified “binary search” as a coding task. The responses expanded to 918–1,686 characters across typed/spoken runs. This exposes an optimization opportunity: distinguish conceptual explanation from a request for executable code, then validate a bounded answer policy. It is not evidence that simply lowering thinking or token limits preserves quality.

## Answer quality is a separate check

The screenshot task was one simple numeric-sort repair repeated three times. All three manually reviewed standalone `solve(x)` functions passed the existing finite boundary/input-preservation tests in the separate restricted Node container, after timing ended.

The original whole fenced blocks scored 1/3 in the strict runner because two also contained `console.log` example calls, which contaminated its JSON result channel. Those original grades were retained; the examples were explicitly excluded only for the separately labelled, manually reviewed function check. These results do not mean three independent coding problems passed, nor that two sorting algorithms were wrong.

Completed generation, visible output and successful saving are not factual correctness or unrestricted coding success.

## Status and next optimization gates

The actual cloud-backed desktop path now has a measured baseline. **The proposed real-time speed targets are not qualified.** Observed speech first text was above the aspirational three-second median target, and screenshot first text was above four seconds on this connection. These were not the plan's controlled reference-network conditions, so they are not a population SLO qualification test.

Next evidence-driven work:

1. Separate short conceptual responses from implementation tasks; measure quality and first-visible delay together.
2. Compare Fast versus Detail on the same frozen screenshot tasks rather than silently reducing reasoning for coding.
3. Validate adaptive endpoint/quiet-window changes on complete, interrupted and corrected speech before reducing the measured 2.2-second wait.
4. Repeat with independent tasks, representative output sizes, real consented voices/devices and OS-level constrained networks. Real device acquisition, native full-display capture and physical paint remain separate hardware gates.

No runtime answer policy was changed by this measurement. No faster-model, physical-device, broad-network, long-session or 100% reliability claim is made.

## Reproduce safely

Windows prerequisites: installed project dependencies, Microsoft Edge and Windows System.Speech. This runner synthesizes its own fixture files; it never plays the voice aloud. Docker is needed only for the separate optional code checks, not for measuring the desktop flow.

```powershell
# Local rehearsal: loopback HTTP/WebSocket provider, no cloud calls or real audio capture.
npm run eval:desktop-live -- --local --max-calls=12

# Explicit live run: uses only the configured Gemini credential from Parakeet Studio.
# Choose a fresh ledger only after authorizing a new request allowance.
npm run eval:desktop-live -- --live --saved-connection --max-calls=12 --budget-ledger=.local-project/my-authorized-speed-budget.json
```

Live mode requires the configured Gemini provider and its exact Google API origin. It copies only the encrypted credential and Local State into an isolated profile with synthetic settings; personal resume/history/workspace data is not loaded. The copied credential files are removed after the app closes. Every HTTP attempt and WebSocket connection reserves a request before sending; retries/reconnects count against the same cap. Authentication/quota errors block later requests. An existing ledger is refused to prevent accidental replay. Do not delete a used ledger to bypass an allowance.

Private reports and synthetic artifacts remain in ignored `test-results`; the published summary excludes answer/transcript content and credentials. Four new deterministic checks cover the persistent request budget, auth/quota blocking, WAV endpoint parsing and incomplete-timing denominators. All **154 deterministic tests** passed, and the nine-flow local rehearsal and nine-flow real-provider run completed.
