# 0.8.1 — portable startup recovery (experimental, unsigned)

The portable launcher now extracts into a separate temporary directory for each launch. Reopening the same EXE previously reused a directory containing the running app, risking replacement of locked runtime files. The regression check requires the second copy to reach Electron's single-instance handler, restore the existing minimized workspace, and exit without modifying its runtime files. Each launch still extracts Electron; reopening can take tens of seconds on a busy machine.

The sidebar footer shows the actual running version. The minimize button names Ctrl+Shift+M as the restore shortcut. Upgrade guidance explains that an older minimized copy remains running and must be closed before switching versions. Capture protection and profile encryption policies are unchanged.

## Downloads

- [Portable EXE](https://github.com/AYASKA-in/parakeet-rea-studio/releases/download/v0.8.1/Parakeet-Studio-0.8.1-portable.exe)
- [Per-user setup EXE](https://github.com/AYASKA-in/parakeet-rea-studio/releases/download/v0.8.1/Parakeet-Studio-0.8.1-setup.exe)
- [Checksums and source](https://github.com/AYASKA-in/parakeet-rea-studio/releases/tag/v0.8.1)

## Validation scope

The release CI records the exact shipping commit. Portable verification checks packaged app/helper identities, a synthetic streamed answer, fake microphone PCM, saved transcript, normal second launch restoring a minimized workspace, single-instance ownership and graceful exit. It uses an isolated profile and a loopback mock provider, with no cloud calls or personal audio. Installer lifecycle tests run only in a disposable hosted Windows account. The main deterministic suite contains 154 checks.

Earlier v0.8.0 model and timing studies remain historical evidence, not new v0.8.1 accuracy or speed measurements. Real voice, Narrator and broader device acceptance remain subject to their recorded outstanding scope. No model changes or new provider requests were made for this patch.

These EXEs remain unsigned experimental builds. No shared key is included. Close older copies, back up your profile and keep Local State with encrypted data before upgrading. If Settings says Choose data-use policy, review it explicitly before sending content. Do not downgrade a newer profile into an older app.
