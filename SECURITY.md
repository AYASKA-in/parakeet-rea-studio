# Security and privacy

The original Windows timer helper changes only the timer-resolution-ignore bit
for app-discovered processes whose executable identity matches this app. It
preserves prior policy snapshots, checks process start times on restoration and
restores the timer bit when recording ends or desktop recovery/shutdown runs.
It does not install a service, change the system power plan, execute model output
or accept process identifiers from model text.

Do not put API keys or private meeting material in public issues or screenshots.
For a vulnerability, use the repository host's private vulnerability reporting
when available, or request a private reporting channel without disclosing exploit
details publicly. No contact address is bundled with this project.

Repository: https://github.com/AYASKA-in/parakeet-rea-studio . Where enabled, use
Security → Report a vulnerability. Request a private channel if unavailable;
do not disclose an unfixed exploit or secrets in a public issue.

Dependency review on 20 October 2026: `npm audit --omit=dev` reports no production
advisories. The full audit reports a moderate `sprintf-js` denial-of-service
advisory propagated through development-only packaging dependencies (eight
affected dependency entries). It is not bundled in the production application.
Maintainers should review the upstream fix rather than blindly applying npm's
suggested toolchain downgrade. See GHSA-hp3w-g68c-fv3c on GitHub Advisory Database.

Keys are encrypted using Windows secure storage. By default, transcripts, resume context and
their recovery snapshots are local plain-text JSON. Version 0.6 adds optional Windows workspace encryption, memory-only storage and age-based retention. The selected provider receives
audio, relevant context and requested screen images. Free-tier providers can have
different data-use policies; consult their terms before sending private material.

Screen capture occurs only on an explicit request. The preview supports selecting
a monitor and cropping before upload. Images are transient; session history stores
the answer and a screenshot-used flag. This app does not run generated code.

Capture exclusion uses Windows window protection on supported paths. It does not
hide processes or guarantee invisibility in every meeting/capture tool. Check the
actual meeting preview. Releases are unsigned unless separately signed by a
maintainer; verify published SHA-256 checksums and build from source if desired.

0.5.2 binds credentials to provider/origin, snapshots request profiles, guards single-instance storage ownership and refreshes recovery copies on explicit context/key removal. Data-use mode defaults to unknown and blocks sends until selected. Unpaid practice mode omits saved personal context and disables AI PDF uploads and stored-session summaries. A reviewed mode is a user declaration about provider terms, not a privacy or billing guarantee. Recognizable contact filtering cannot identify every private item, and contact filtering does not replace a suitable provider/data arrangement.

Workspace encryption covers primary and recovery workspace snapshots, not plaintext exports, crash dumps, external backups or copies already sent to providers. It depends on the original Windows user/profile key material. Do not downgrade an encrypted profile to 0.5.8 or earlier: those versions cannot read the encrypted envelope. Export important content and back up the closed profile before migration. Memory-only mode clears app-owned saved workspace copies; it is not forensic secure erasure. Content-free timing counters are memory-only, capped at 500 attempts and exported only on request.

The optional evaluation runner is a developer tool, separate from the desktop application. Model code runs only in the pinned restricted container, without host mounts or network. Docker/OS isolation is a boundary to maintain and patch, not a proof of arbitrary-code safety.
