# Quality evaluation

This suite separates plumbing checks from provider correctness. Its initial corpus contains 100 English synthetic speech variants (20 sentences at five rates), 100 routing sequences (25 topics with four forms), and 50 variants each for coding, table screenshots and fictional resumes. These are correlated templates, not 350 independent realistic interviews. A reserved split keeps entire families together, but the public synthetic split is not a blinded human-authored holdout. Accents, noise, overlap, varied diagrams and hard coding problems still need independent examples.

## Prepare fixtures and check the runner

On Windows, run:

~~~powershell
npm run test:eval
npm run eval:prepare -- --audio
~~~

Preparation uses an installed Windows speech voice and Edge to create synthetic WAV/PNG files under ignored test-results/eval-media. Fixture SHA-256 checks prevent accidental substitution before upload. No microphone or real desktop is used.

Coding evaluation requires Docker Desktop with Linux containers. The pinned official Python image is recorded in evals/sandbox-image.json. Fetch that exact digest, then run npm run test:eval-sandbox. The runner mounts no host files, has no network, runs without root/capabilities on a read-only root filesystem, and bounds memory, CPU, processes, output and time. Expected results remain outside the container. The desktop application itself never executes generated code. Do not substitute a project image containing private data.

## Run a bounded provider check

For secure entry through a separate test window, run npm run eval:desktop. Enter your own eligible Gemini key in that window. Its cap is 12 synthetic cases; a failed stage stops that smoke run. It reads no personal profile, clears its saved key and recovery copy afterward, and uses memory-only history. An unpaid project without billing avoids accidental paid usage; the app cannot inspect account billing status.

For targeted batches, configure PARAKEET_EVAL_API_KEY only in the current terminal/process environment, then run, for example:

~~~powershell
npm run eval:run -- --live --kind=asr --provider=gemini --model=gemini-3.5-transcribe-live --max-calls=10 --transcription-mode=VERBATIM
npm run eval:run -- --live --kind=screens --provider=gemini --model=gemini-3.5-flash-lite --max-calls=5
~~~

Kinds: asr, coding, screens, resumes. A model is required explicitly. Use split=reserved only after freezing the intended change; keep its failures visible. Case selection rotates through families before reusing variants. An optional case=ID selects a specific declared case. Each case has one provider attempt, no automatic paid fallback and no automatic retry after an answer. Authentication/quota failures stop a batch. Maximum calls is a ceiling, not a success denominator.

OpenAI-compatible loopback endpoints support the same adapter with provider=openai and an explicit base-url/model. A local server can still forward requests elsewhere; check its configuration.

Reports remain in ignored test-results and include exact evaluator source hashes, attempted/failed counts, duration and rubric outcomes. Synthetic ASR transcripts may be retained for adjudication; no private recordings or screenshots belong here. Do not upload raw private diagnostics or keys to issues.

## Read results carefully

- ASR: raw word error rate plus critical-token misses. Spoken-number equivalence, punctuation and SMART normalization need adjudication; lexical failure is not automatically a semantic error. Compare SMART and VERBATIM on the same frozen cases before changing defaults.
- Routing: actual local queue decisions, with unfinished questions and preserved follow-up constraints.
- Coding: exact outputs on finite synthetic inputs inside the restricted runner. This does not prove correctness on arbitrary inputs or security of generated programs.
- Screens/resumes: strict declared structured fields. This grades extraction/negation on these fixtures, not conversational quality or all unsupported personal claims.
- Timing: batch elapsed time includes adapter/runner work. Use app diagnostic stage export for user-visible first text and durable-save latency. Never present mock-provider timings as cloud-model latency.

The initial 12-case smoke passed three finite coding cases, three screen token/limit checks and three structured resume checks. Three ASR cases failed the original raw lexical rubric. Those failures remain recorded; they must not be relabeled as passes or erased by a later rerun. A broader user-authorized batch is evaluated separately. See VALIDATION.md for final recorded results.

The optional developer evaluation sandbox uses the Docker Official Image for Python, pinned by digest in evals/sandbox-image.json. Python and the image OS components retain their upstream licenses. This image is downloaded separately for testing and is not bundled in the desktop EXE/source ZIP. The application icon is an original rendering of this repository’s own vector mark.
