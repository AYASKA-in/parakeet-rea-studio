# Parakeet Studio 0.6.0 — experimental production-hardening candidate

- Request slots reserved before credential lookup; cancellation and duplicate/excess requests are checked before upload.
- Streaming output budgets checked before display; terminal Gemini completion closes the stream; malformed envelopes fail visibly.
- Bounded transient retry with jitter/Retry-After and provider-origin cooldowns. No automatic quota retry, partial-answer replay, paid fallback or key cycling.
- Content-free timing export: up to 500 process-local attempts, measured stage offsets, p50/p95 and outcome/save counts. Speech end is an estimate, unavailable stages remain blank.
- Optional Windows workspace encryption, memory-only history and 7/30/90-day retention. Primary/recovery snapshots follow the policy; exports remain plaintext. Encryption requires the original Windows profile/user. Do not downgrade an encrypted profile to 0.5.8 or older.
- Resume source-line anchors, keyboard screenshot cropping, high-contrast support and proper Windows application identity/icon.
- Expanded pinned CI gates, dependency inventory, explicit signing preparation, synthetic evaluation suite, isolated Python grading, and operator-controlled device/sleep tests.

This candidate remains unsigned and experimental. Test results and unresolved provider/hardware/quality limits are recorded in VALIDATION.md and PRODUCTION_READINESS.md. No production-grade, offline-model, universal invisibility or 100% accuracy guarantee is made. Earlier endurance evidence remains tied to its original version. Signing support does not mean this artifact is signed.
