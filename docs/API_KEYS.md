# API-key setup

[README](../README.md) · [User guide](USER_GUIDE.md)

## Google Gemini

1. Open [Google AI Studio's key page](https://aistudio.google.com/apikey), sign in and accept its terms.
2. Create/select a Cloud project. Existing Cloud users may need to import a project into AI Studio first.
3. Create a key and copy the complete value. New AI Studio keys use Google's authorization-key flow; do not assume a particular prefix. Never paste a key into chat, issues or source files.
4. Check project model access, [pricing](https://ai.google.dev/gemini-api/docs/pricing) and [limits](https://ai.google.dev/gemini-api/docs/rate-limits). For zero billing charges, use an eligible free-tier project without billing. The app cannot verify that account state.
5. In Settings select **Google Gemini**:

   | Field | Starting value |
   |---|---|
   | API base URL | `https://generativelanguage.googleapis.com/v1beta` |
   | API key | Your complete key |
   | Answer model | `gemini-3.5-flash-lite` |
   | Transcription model | `gemini-3.5-transcribe-live` |

6. Choose a data-use policy. Start unpaid projects with **Unpaid cloud — non-personal practice only** and synthetic content. Review [provider terms](https://ai.google.dev/gemini-api/terms) before using private material.
7. Save, test a harmless typed question, then a short microphone question. Text and audio model access can fail independently.

Google's [official key guide](https://ai.google.dev/gemini-api/docs/api-key) covers current key types, restrictions and project permissions. Use restrictions compatible with a desktop client; browser-referrer restrictions intended for websites may not work here. Do not blindly remove security restrictions to troubleshoot.

One key covers Gemini answers, Live transcription and supported image/PDF requests. Both audio sources use two connections. Limits are project-wide, so another key in the same project does not bypass quotas. No key is bundled or shared by this project.

## Saved credentials

The app encrypts its key with Windows secure storage and does not return the secret to the settings UI. Leave the field empty to preserve it. Stop listening before changing connection settings. **Remove saved API key** clears the app-owned credential and recovery copy.

Credentials are bound to provider/server origin. Changing origin/provider requires a replacement. Re-enter your key after moving to a different Windows account/computer if decryption fails. This app uses Settings, not an automatically detected `GEMINI_API_KEY` environment variable.

If exposed publicly, replace the key through your provider and review usage; follow Google's current leak-response guide. Never submit the secret or settings file in a support ticket.

## OpenAI-compatible and local servers

Choose **OpenAI-compatible API**, enter its actual model IDs, key and base URL including `/v1`. Remote endpoints require HTTPS. A local endpoint such as `http://127.0.0.1:1234/v1` is permitted with Local server policy; supply the server's expected token. No local server/model is bundled, and a loopback server can itself call cloud services.

For full functionality the server needs streamed `POST /chat/completions` and multipart-WAV `POST /audio/transcriptions`. Screenshot requests need image support. A chat-only server is not automatically compatible with audio/vision. Gemini's dedicated transcription uses its native Live protocol.

| Failure | Check |
|---|---|
| 400 | Model/configuration/input format |
| 401/403 | Complete key, permissions, restrictions and account/region eligibility |
| 404 | Model ID and base URL |
| 429 | Project quota/concurrency; wait or reduce usage |
| 503 | Provider demand; bounded retries can still fail |
| Text works, audio fails | Dedicated audio-model access, WebSocket connectivity and Windows permissions |

“AI provider configured” means settings were saved, not that authentication succeeded. Correct the reported issue and explicitly retry. No automatic paid fallback or key cycling occurs.
