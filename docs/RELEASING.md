# Release procedure

Maintainer guide. A GitHub repository and release require the maintainer's explicit publishing authorization and authenticated account. Publish only this standalone project; exclude unrelated projects and local research/profile material.

1. Work in this standalone project. Use original/compatibly licensed source. Keep keys, resumes, recordings, screenshots of private content, vendor binaries/decompiled source and test profiles out of Git and release assets.
2. Update package/package-lock version, user docs and release notes. Check current provider docs; free quotas/model availability can change.
3. Run `npm ci`, `npm test`, `npm audit --omit=dev`, and review the full development-tool audit separately. Do not apply an automatic breaking downgrade merely to clear a dev-only advisory.
4. `npm run build:win`, then `npm run test:desktop -- --packaged` and `npm run test:hardening -- --packaged` on an interactive Windows desktop. Native UI/capture checks are not established by headless CI alone.
   After packaging finishes, run `node scripts/verify-portable.cjs`. It verifies the actual portable extraction/app/helper hashes, synthetic answer/audio/persistence and graceful exit using a private profile.
5. Complete applicable real sleep/hardware and wall-clock endurance tests. Record exact version/hash, scope, duration, faults, failures, limitations and resource observations. Do not overwrite a failed receipt with a passing one.
6. Check docs' relative links, download names and images. Use only reviewed synthetic UI screenshots. Source packaging must preserve binary image bytes and third-party license notices.
7. Commit only the reviewed standalone allowlist, then run `npm run release:source` from a clean checkout. Inspect the manifest's exact source revision and `sourceDirty: false`, extracted ZIP and SHA-256 sums. Recheck for secrets/private data. Source packager allowlists source/tests/scripts/docs/workflows and excludes research, dependencies, builds and test profiles.
8. Push to the authorized repo and inspect CI. If docs/code change, commit them and regenerate the source archive; do not attach a ZIP from an older commit.
9. Publish a GitHub **prerelease** for experimental builds, with the EXE, source ZIP, SHA256SUMS, manifest and honest release notes. Explicitly state unsigned status and test limits. Use the pinned version download URL in README; `/releases/latest` may omit prereleases.
10. Verify the public repo/README, release visibility, asset names/sizes and downloadable SHA-256 values. Do not claim successful publishing from a local build or an unsubmitted draft.

The Windows workflow runs unit checks/build/source packaging without API secrets. Local-provider tests require no real key. Bounded live-provider tests are opt-in, synthetic, quota-consuming checks; never use private resume/desktop content for them.

`npm run build:native` compiles the original `native/TimerPolicy.cs` with Windows' .NET Framework compiler. Start/build/native-test npm hooks run it automatically and reuse a current output. The source ZIP includes C# source; the portable app includes the compiled helper under resources. No model response is executed by the helper.

After both real runs pass, use `node scripts/summarize-validation.cjs test-results/<both-run> test-results/<microphone-run>`. It additionally requires at least 95% nominal continuous PCM payload, retained final IDs, no unexpected errors and one explicit synthetic review per injected outage. Publish resource observations with fixture/window/load caveats, not as model-correctness statistics.

Immediately after starting release soaks, freeze runtime/helper/harness hashes with `node scripts/record-validation-identity.cjs test-results/<both-run> test-results/<microphone-run>`. It refuses to overwrite a receipt. Do not rebuild or change the harness during acceptance. The final summary compares hashes and rejects unexpected saved audio warnings. Mock final-drain deadline notices are counted separately: the mock does not transcribe every generated tone into speech, and finalized-ID retention is not an ASR-accuracy claim.

## Additional 0.6 gates

Run test:production (including --packaged) for Windows workspace encryption migration/restart, privacy-setting rollback, forced termination, memory-only disk copies, retention, diagnostic export and keyboard crop. Run test:eval for corpus/routing and evaluator checks; run test:eval-sandbox separately with its pinned Docker image. Real provider benchmarks remain opt-in and preserve failed receipts. The hosted workflow pins Actions to immutable revisions and adds UI/native/portable gates, a runtime dependency audit and lockfile dependency inventory. Hosted success must be checked after push; a local pass does not prove hosted runner compatibility.

Unsigned builds use build:win. Signing support uses build:signed with CSC_LINK/WIN_CSC_LINK and password variables configured securely in the environment. The command refuses missing credentials and enables forceCodeSigning; never silently publish an unsigned result as signed. This project currently has no signing identity, so unsigned labeling remains mandatory. Validate Authenticode and timestamps on every claimed signed artifact. Never put signing credentials in source, workflow arguments, or reports.

After source packaging from the clean committed checkout, run node scripts/check-release.cjs. It checks the exact revision, manifest source hashes, EXE/ZIP checksums and every ZIP entry hash/embedded manifest without extracting untrusted paths. CI runs this before artifact upload. Source changes afterward require regenerating the archive and checksums.

Signing now explicitly verifies the extra-resource timer helper before packaging and requires a timestamp on the final pinned publisher signatures. See CODE_SIGNING.md and EXTERNAL_ACCEPTANCE.md for enrollment, provider integration and disposable installation acceptance scope.
