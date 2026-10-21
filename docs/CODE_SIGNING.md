# Code signing policy

## Current status

**Public releases and the current experimental candidate are unsigned.** The project has no approved signing identity or signing-service enrollment. A build/check script or a certificate request is not a signature. Do not describe a release as signed until the actual artifacts pass verification.

The source repository is [AYASKA-in/parakeet-rea-studio](https://github.com/AYASKA-in/parakeet-rea-studio), under MIT. Current repository owner/maintainer contact is the public GitHub account AYASKA-in. Release signing approvers must be explicitly designated by that owner; no additional reviewers or approvals are implied.

## Free route to investigate: SignPath Foundation

[SignPath Foundation](https://signpath.org/) offers signing for qualifying open-source projects. Its [conditions](https://signpath.org/terms.html) require an eligible license, existing documented releases, active maintenance, verifiable project reputation, build provenance, MFA for team members and manual approval of each signing request. Acceptance is discretionary.

The Foundation signs under its own publisher identity. Its policy requires truthful functionality/privacy disclosures, announced system changes and uninstallation. A newly released repository must not claim established reputation or existing independent reviews.

No application has been submitted, no sponsorship has been granted, and no required attribution is displayed as if approved. The owner can review the draft below and apply through the [official application page](https://signpath.org/apply.html). The owner's legal identity, MFA enrollment, organization membership, project acceptance, signing policy/configuration and service credentials cannot be supplied by this repository.

### Application draft for owner review

- **Project:** Parakeet Studio.
- **Repository:** https://github.com/AYASKA-in/parakeet-rea-studio
- **License:** MIT; dependency inventory and third-party notices are included. Request a licensing review rather than asserting that an inventory is legal certification.
- **Existing public release:** v0.7.0 experimental unsigned prerelease; earlier v0.5.8 is retained. Main includes the changes previously tracked in merged PR #1.
- **Platform:** Windows x64; Electron application, original C# owned-process timer helper, NSIS installer and portable package.
- **Functionality:** User-controlled microphone and Windows playback transcription, AI answer drafting, explicit screenshot analysis, resume/context assistance, saved transcripts and a movable glass overlay. Optional Windows capture exclusion is exposed; it is platform/capture-method dependent and no universal invisibility guarantee is made.
- **Data flow:** Requests go to the provider configured by the user when the user invokes relevant features. Cloud providers process sent audio, text or images under their policies. Screenshot and outgoing-text review options are available. Local transcript/history storage and optional Windows-bound encryption are documented. No user keys, recordings, resumes or reverse-engineering artifacts are included in source releases.
- **Privacy and limitations:** See [SECURITY.md](../SECURITY.md), [README](../README.md) and [user guide](USER_GUIDE.md). Use only in permitted practice/conversations with appropriate recording consent.
- **Build provenance:** Pinned GitHub Actions and dependencies; clean-source manifests/checksums and CI reports. Provider-specific signing provenance and artifact configurations must be agreed with SignPath after enrollment.
- **Team/approvers:** Owner to confirm public role assignments and MFA. Do not invent independent reviewers.
- **Requested artifacts:** Original app/helper executables and installer/portable packages; third-party Electron binaries must retain their upstream identity and must not be represented as original project code.
- **Publisher attribution:** Add the exact required SignPath attribution only after acceptance and an actual approved signing configuration.

## Other distribution options

[Microsoft's signing guide](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options) describes Store-managed signing for approved MSIX submissions, paid CA certificates and Azure Artifact Signing. It currently limits Artifact Signing individuals to the US and Canada. Do not assume eligibility from timezone or buy a subscription before verifying the owner's legal-region eligibility. Store signing requires a separate MSIX packaging/submission workstream; it does not sign the current EXE installer.

A self-signed certificate is for controlled development/testing, not a publicly trusted release. Signing alone does not promise that a new download will have established SmartScreen reputation.

## Implemented build gates

`npm run build:win` produces explicitly unsigned artifacts. Publishing is always disabled during build.

For a supported certificate-file identity, `npm run build:signed` requires secure environment configuration:

- `CSC_LINK` or `WIN_CSC_LINK` and the corresponding password if required.
- `PARAKEET_SIGNER_THUMBPRINT`: the owner-verified publisher certificate's 40-character SHA-1 thumbprint. This is an identity pin, not a file-integrity hash.
- No credentials in source, CLI text, workflow logs or reports.

This local certificate-file path is not a completed SignPath integration. A managed HSM/service needs its approved provider integration, artifact definitions and provenance, rather than exporting a protected private key.

Signed builds enable `forceCodeSigning`. Electron-builder signs the helper during extra-resource copying; the afterPack hook verifies that result before packaging, without adding a second signature. The helper receives product/version metadata during compilation.

The final gate verifies the portable EXE, NSIS setup, unpacked app and timer helper have Windows Authenticode **Valid** status, the pinned signer and a timestamp certificate. Missing credentials, missing helper signing, wrong publisher, unsigned bytes or absent timestamps fail the build.

After service enrollment, validate the supported signing path with real artifacts, independently verify nested payloads and the generated uninstaller, regenerate checksums/source receipts and complete the signed-install acceptance matrix. The NSIS uninstaller is builder-generated; a signed outer installer alone does not prove its extracted uninstaller is signed.

Never auto-publish a candidate merely because a signing job ran. Review the exact source revision and signing result first.
