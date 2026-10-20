# End-to-end user guide

[Install/download](../README.md#download-and-run) · [API setup](API_KEYS.md) · [Troubleshooting](TROUBLESHOOTING.md)

## Start a session

Open the EXE, configure a provider and data-use policy in Settings, then test a synthetic typed question. Use New session to separate conversations. The workspace shows transcript and answer drafts; Session history stores earlier sessions locally. No subscription/account/cloud synchronization is bundled. Use assistance only where permitted by meeting/assessment rules.

## Listening

Choose Microphone, System audio or Microphone + system. Test each input separately before both. Select the correct microphone; Refresh updates the device list. Names may appear only after permission. A missing selected device can fall back to Windows default; permission denial does not bypass Windows controls.

Click Start listening and grant requested permissions. System audio can include other applications' playback. Windows loopback negotiation retains a display stream, but audio mode does not read/upload its video. Use headphones to reduce microphone feedback.

You/Call audio labels identify source, not individual speakers. This is not diarization. Interim wording can change; finalized text is saved. Stop if the wrong input is being captured. Use the transcript edit control to correct finalized text, then save; the original remains for comparison. Recheck negation, numbers, names and code identifiers.

## Drafting answers

Type and click Draft answer, or Ctrl+Enter. Concise is short; STAR structures a behavioral response; Technical emphasizes explanations/tradeoffs; Coding asks for code, complexity and edge cases. Review personal claims in STAR answers. The app never executes generated code.

Stop generating cancels a request and may retain partial text. A partial/truncated answer is not complete. Previous/next controls browse existing drafts without another provider call.

Auto draft is initially enabled and remembers your preference. It groups finalized segments and waits for a pause. With both sources, only system/call audio triggers automatic drafting. Local question heuristics can miss indirect/multilingual requests or misjudge completion.

The pending card shows what will be sent. Send now or Ctrl+Shift+Space sends ready recognized text; Dismiss discards the pending question. Interim speech can block sending. Audio interruptions hold questions for review; inspect them and send explicitly after recovery. Do not assume every question will be answered automatically.

## Resume and context

My context holds role/company, resume, job description and notes. Local import accepts TXT, Markdown and selectable-text PDF: up to 10 MB, 40 PDF pages and 50,000 applied characters. Review/edit extraction before applying, especially reading order and dates.

Scanned PDFs may have no local selectable text. Optional AI PDF import explicitly uploads the document to Gemini after confirmation, requires a compatible data route and is disabled in unpaid practice mode. Use only material permitted by your provider/account arrangement.

Relevant reviewed evidence can inform personalized answers under the selected policy. Check every claimed employer, qualification, metric and achievement. The model may request confirmation of stale dates or missing evidence; it cannot establish your experience from guesses.

Clear personal context removes current and saved session-context copies and refreshes app-owned backups. It does not remove transcripts, answers, notes, exports or earlier provider submissions. Delete sessions separately for those records.

## Glass overlay

Open with the workspace icon or Ctrl+Shift+O. Expand Overlay controls to adjust background opacity, placement and click-through; the workspace offers corresponding floating controls.

- Background opacity ranges from clear to 95%. White text remains opaque with shadow/glow. Controls keep dark surfaces; increase background opacity over busy or bright content.
- Drag the header, choose one of nine anchors, or move 32 pixels with Ctrl+Shift+arrows. Ctrl+Shift+Home centers it.
- Click-through lets you click underlying content. Ctrl+Shift+P restores mouse input.
- Ctrl+Alt+Up/Down scrolls; Ctrl+Alt+Left/Right browses drafts.
- Ctrl+Shift+H hides; Ctrl+Shift+M restores the workspace. Reopening the EXE focuses the existing instance if shortcuts conflict.

Capture exclusion is enabled on supported Windows paths. Verify your actual meeting preview. It does not hide processes, OS dialogs, physical cameras or all alternate capture methods. See the README privacy section.

## Screen text, code and images

1. Open the relevant problem and choose Answer screenshot or Ctrl+Alt+Enter.
2. Select the correct display and review capture age/content.
3. Drag a crop around the problem; Clear crop restores the full image. Refresh screenshot captures current content.
4. Edit the question and choose Fast, Balanced or Detail.
5. Review the data route/image, then Analyze and answer. Cancel sends no screenshot.

Longest-edge image limits are 1600/2560/3840 pixels. Fast bounds reasoning even for coding; Detail allows more reasoning and takes longer. A tighter crop or enlarged text helps small code. No model can read details absent from the captured pixels.

Screenshots expire after two minutes or display configuration changes. Ordinary screen-content changes do not invalidate a preview automatically; refresh manually. Images are transient, not saved in history. Answers and a screenshot-used flag may persist. Other visible apps can appear in a screenshot, so inspect before upload. Image support depends on your provider/model.

## Speed and bandwidth

Settings → Answer quality, speed and transcription contains Fast/Balanced/Careful priorities, language hints, technical vocabulary, Smart/Verbatim transcription and Standard/Low-bandwidth audio.

Start with Standard and Balanced. Fast favors brief answers and shorter pauses; Careful gives more reasoning but no accuracy guarantee. Low bandwidth skips long silence and can miss quiet speech. Both sources use two Gemini connections and roughly twice the raw audio payload, plus protocol overhead. Add up to 100 comma/newline-separated vocabulary terms and an appropriate language hint such as `en-IN` when helpful. Save settings between listening sessions.

## History, updates and removal

Check the saved-status message before closing. A failed save keeps a pending snapshot with Retry saving. History is bounded to 100 sessions and 16 MB; export/delete older records explicitly at capacity. Overflow is rejected instead of silently erasing history.

Generate notes creates a provider-generated summary where policy permits. Export session writes Markdown; history offers transcript-text export. Search, reopen and delete in Session history. Exports are plain text. Clear transcript retains answers/notes; clear context retains transcripts/answers; deleting a session removes its app-owned record/recovery copy. External exports/backups/provider copies are outside these operations.

Sleep/lock stops capture and requests; stale screenshot/document reviews are discarded. After wake/unlock, review interruptions and explicitly start listening. Reconnect buffering holds up to eight seconds of new audio, while earlier in-flight speech may be lost. Saved gap notices make that limitation visible.

If audio processing falls materially behind wall time, capture stops with a saved warning. Check competing workload/audio devices, then restart. This guard detects a substantial slow clock; it does not prove sample-perfect capture or reconstruct missing speech.

To update, stop listening, wait for saved status, close the old app and run the new checksum-verified EXE. Settings/history stay in the same Windows profile. No automatic updater is bundled. Export important content before updates; a new Windows account/computer may require key re-entry.

To remove the app, close it and delete the EXE. Its data remains at `%APPDATA%\Parakeet Studio`. To remove local data too, export what you need, remove the saved key in Settings, close the app and delete that exact folder through Explorer. This is irreversible and does not remove external exports or provider copies.
