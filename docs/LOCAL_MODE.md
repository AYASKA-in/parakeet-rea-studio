# Local and offline operation

The app can use an explicitly configured OpenAI-compatible server on a loopback address. It does not bundle a transcription or language model and does not silently download one. A configured local endpoint is not proof of offline operation: the server may forward content to a cloud service.

1. Configure your chosen server's supported answer model and WAV transcription endpoint. Use the server's own model identifiers, not Gemini model IDs.
2. Choose OpenAI-compatible API and a loopback base URL such as http://127.0.0.1:1234/v1. If the server needs no authentication, its documentation may permit a non-secret placeholder token.
3. Select Local server policy. Remote/non-loopback URLs are rejected under this policy. Configure microphone, then system audio separately.
4. Test typed answers, WAV transcription and screenshots independently. A text-only model cannot analyze images. Gemini Live transcription is not used for an OpenAI-compatible provider.
5. To validate offline claims, disconnect internet while preserving loopback, repeat those tasks, and measure CPU/RAM, critical-word errors, first-text latency and save/recovery. Model/server network forwarding must also be disabled. Do not disable Windows security to perform this check.

No real local-model performance or internet-disconnected acceptance result is claimed for this release. Loopback mock integration verifies the application path only. Choose runtime/model size based on measurements on the intended hardware; model licenses and distributions need separate review before bundling. Local-model installation and its resource budget remain an explicit deployment decision.

Version 0.6 adds Check saved local server in Settings → Local data and diagnostics. Save the local provider first. This bounded five-second request checks the saved loopback /models listing and whether the configured IDs are listed; it sends no conversation content. A successful list response does not prove that chat, WAV transcription or vision endpoints work, and does not prove the server itself stays offline.
