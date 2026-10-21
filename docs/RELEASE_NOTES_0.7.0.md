# 0.7.0 — experimental unsigned Windows release

## Download

- [Portable EXE](https://github.com/AYASKA-in/parakeet-rea-studio/releases/download/v0.7.0/Parakeet-Studio-0.7.0-portable.exe): run directly without installing.
- [Setup EXE](https://github.com/AYASKA-in/parakeet-rea-studio/releases/download/v0.7.0/Parakeet-Studio-0.7.0-setup.exe): per-user NSIS installation.
- [Release, source ZIP and SHA-256 checksums](https://github.com/AYASKA-in/parakeet-rea-studio/releases/tag/v0.7.0).

## Changes

Direct selected-display screenshot answers without opening a review window; optional Review / crop; call-audio transcription; readable glass controls and recovery feedback; preserved corrections and unfinished constraints; VERBATIM default for new installs while retaining existing preferences; source-overlap review; optional protected workspace storage and history controls; bounded timing diagnostics; compatible non-overwriting profile backup/restore; per-user installer and explicit signature gates.

Developer tooling includes coding/SQL/vision/grounding benchmarks, restricted Python/SQLite grading and opt-in human-audio fixtures. The 43-request synthetic cloud round exposed both real model failures and rubric/interface mistakes; original failures remain recorded, with six targeted retests after fixes. No broad accuracy or 100% availability claim is made.

## Validation and remaining gates

The release page identifies the exact build commit and completed CI run. Automated coverage includes 120 deterministic tests, packaged app/UI/recovery/latency checks, real Windows encrypted-profile restore, portable launch, installer payload verification and a hosted disposable Windows install/uninstall/reinstall lifecycle. Normal uninstall must remove the whole installation directory, registry entry and shortcuts; reinstall must retain/decrypt the synthetic profile and key.

**Unsigned:** no publisher certificate or signing-service approval is configured. Signature/timestamp verification support does not mean these artifacts are signed. Human voice, spoken Narrator, wider physical-device and manual installer/UAC/multiple-account cases remain pending. Earlier endurance and sleep/wake receipts qualify only their recorded candidates.

## Upgrade

Close every running copy and make a compatible profile backup before changing versions. Keep Local State with protected profiles; Windows user/machine protections can limit relocation. Uninstall retains application data. Do not open a newer encrypted profile with an older application; use a compatible pre-upgrade backup for rollback.

See [user guide](USER_GUIDE.md), [quality and recovery](QUALITY_AND_RECOVERY.md), [acceptance scope](EXTERNAL_ACCEPTANCE.md) and [signing policy](CODE_SIGNING.md).
