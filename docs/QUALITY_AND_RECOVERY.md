# Quality, recovery and release checks

Version 0.7.0 is an unsigned experimental candidate. These changes improve measurement and safeguards; they do not certify perfect answers or production availability.

## Coding and screenshot evaluation

The corpus now contains 58 coding cases, 57 screenshot cases and 52 resume/grounding cases, plus the existing 100 synthetic ASR clips and 100 routing sequences. Curated additions cover interval merging, debugging, Unicode, directed shortest paths, fixed-size windows with negative values, SQLite duplicates/NULLs/left joins, small code text, bottom-of-screen constraints, a directed diagram, clipped/conflicting requirements and page instruction injection. All are public developer fixtures, not a blinded human holdout.

Generated Python is syntax-compiled by CPython and run against finite tests. SQLite queries execute on disposable databases with query-only mode. Expected results remain outside the container and are not sent to the model. Tests are withheld from the prompt, but the corpus is public; this is not an adversarially secure or independently held-out assessment. JavaScript, Java, C++ and other compilers are not yet benchmarked. The desktop app never executes generated code.

The separate Docker runner uses a pinned official Python image, no network or host mounts, non-root execution, read-only root filesystem, bounded memory/CPU/processes/output/time, and container cleanup. Run npm run test:eval-sandbox to check reference solutions, wrong-code rejection, infinite-loop termination and isolation. Run npm run eval:prepare to regenerate screenshot fixtures. Provider evaluation requires an explicit --live flag, chosen model and request ceiling; keep the key in PARAKEET_EVAL_API_KEY, never in files. The quality orchestrator is capped at 50 requests and stops later batches on authentication/quota/cooldown failures.

### Measured cloud samples on 21 October 2026

43 of the authorized maximum 50 requests were used. The first 37 attempts scored coding 5/8, screen 5/7, grounding 1/2, SMART ASR 8/10 and VERBATIM ASR 9/10 under raw rubrics. The six targeted retests passed after explicit input-shape examples, descriptive clarification rubrics and an employment-evidence preflight were added. Original reports remain retained. Two initial screen failures were wording mismatches despite correct clarification decisions. Three coding failures exposed underspecified input contracts; these are not counted as model-correct original answers. The missing-employer failure was substantive and prompted the safeguard. These are small correlated samples, not general accuracy rates or independent before/after experiments. Compilation time is included in coding evaluation elapsed time; it is not model-only latency.

## Conversation accuracy

New installations default to VERBATIM to help retain constraints; an explicitly saved SMART setting is preserved. Neither style guarantees correct negation or numbers. Finalized transcript edits retain original wording. Unfinished comparator phrases wait for their value. Sustained simultaneous microphone/system energy holds automatic system questions for review; this can also indicate echo and is not speaker diarization. Both mode still transcribes both streams separately and routes automatic questions from system audio.

Consented human recordings are a separate acceptance step. Run npm run eval:record to open a local recorder with capture off. Only Start begins microphone capture; Stop saves a plaintext WAV and reference manifest under ignored test-results. It makes no cloud calls and does not use the normal profile. Use harmless speech, verify the reference against what was actually spoken, and keep recordings private. The cloud-consent and non-confidential-content declarations must be true before importing. The human-audio loader rejects missing consent, duplicate IDs, path escapes and checksum mismatches.

For a consented manifest, run node scripts/evaluate.cjs --live --kind=asr --audio-manifest=ABSOLUTE_MANIFEST_PATH --allow-human-audio --split=reserved --model=YOUR_TRANSCRIPTION_MODEL --max-calls=1. Raw human transcript text is omitted from reports. Word-error and critical-token results still need numeric-format and identifier adjudication. Accent/overlap labels are self-reported; one speaker cannot establish broad accent coverage. The user deferred the voice check; no human audio was recorded or uploaded in this round.

## Latency and recovery

Settings exports bounded, content-free current-process diagnostics with question-end estimate, finalized transcript, request, first text, first useful-text proxy, completion and durable save. The useful-text proxy is at least 40 non-markup characters; it is not a semantic quality judgment. Derived durations have sample counts and p50/p95, while errors, partials, cancellations, quota/auth/network categories and failed saves remain in attempt denominators. Missing or out-of-order stages are not fabricated. Question-end timing is an audio-energy estimate, not a provider word timestamp.

Run npm run test:latency for seven local UI/save scenarios: normal, delayed stream, retryable 503, quota, authentication rejection, connection reset and broken partial stream. These are controlled local measurements, not internet latency SLOs or real packet-loss/DNS/TLS/hardware coverage.

The overlay shows microphone/call energy, quiet/off states, reconnecting or gap review, provider retry/cooldown/quota/authentication feedback and errors. Quiet means no detected energy, not a failed device. Status reflects browser connectivity hints and observed requests; online does not prove a provider is reachable. Manual retry never happens automatically after partial text. Capture again explicitly acquires and sends a fresh screenshot; old pixels are not reused. Connection settings is available for authentication problems.

## Installer, verified updates and rollback

Builds now include a per-user NSIS installer and portable EXE. Installer uninstall is configured to retain app data. Installer payload checks compare app/helper/ASAR against the tested unpacked build without installing into the user's Windows account. Actual install/uninstall and upgrade acceptance in a disposable Windows account remain required.

No automatic downloader/updater is enabled. The verified update policy requires a matching SHA-256 and a valid Authenticode signature from an explicitly pinned publisher certificate. Use scripts/verify-update.ps1 to inspect a file; it never installs or executes it. Obtain the expected hash and publisher pin through a trusted release channel. Unsigned experimental artifacts fail this verified-update gate.

Actual signing needs a maintainer-provided identity. build:signed requires signing credentials plus PARAKEET_SIGNER_THUMBPRINT and checks the app, native helper, portable launcher and installer signatures. Do not publish a supposedly signed release if any executable fails. The helper may need signing before packaging, depending on the signing pipeline.

Close the app before profile backup. node scripts/profile-backup.cjs backup --source=PROFILE --destination=NEW_BACKUP_FOLDER --version=INSTALLED_VERSION copies known profile files and Electron Local State with hashes. Local State is required to retain the protected encryption key when moving profiles. These files contain private data and encrypted credentials; do not publish them. Restore creates a NEW profile directory and never overwrites an existing one: node scripts/profile-backup.cjs restore --source=BACKUP --destination=NEW_PROFILE --version=TARGET_APP_VERSION. Windows encrypted data remains bound to the same Windows user/machine protections. Integrity hashes are not an authenticated backup signature; protect the backup directory.

For rollback, use an app compatible with a pre-upgrade backup and launch against the restored separate profile using PARAKEET_USER_DATA. A newer profile cannot be restored into an older app by this tool. Encrypted profiles cannot be opened by versions older than 0.6.0. Backups are snapshots, not a live synchronization mechanism or guaranteed crash-consistent copies of an open app.

## Remaining external acceptance

Actual certificate signing, consented human accent/overlap trials, broader Windows/device coverage, real DNS/TLS/packet-loss tests, Narrator review and disposable-account installer acceptance remain open. The prior laptop microphone/system/sleep checks and frozen 0.6.0 endurance remain historical evidence, not fresh 0.7.0 hardware/endurance qualification.
