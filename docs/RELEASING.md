# Release procedure

Maintainer guide. A GitHub repository and release require the maintainer's explicit publishing authorization and authenticated account. Do not publish the enclosing Sentinel project or local research/profile material.

1. Work in this standalone project. Use original/compatibly licensed source. Keep keys, resumes, recordings, screenshots of private content, vendor binaries/decompiled source and test profiles out of Git and release assets.
2. Update package/package-lock version, user docs and release notes. Check current provider docs; free quotas/model availability can change.
3. Run `npm ci`, `npm test`, `npm audit --omit=dev`, and review the full development-tool audit separately. Do not apply an automatic breaking downgrade merely to clear a dev-only advisory.
4. `npm run build:win`, then `npm run test:desktop -- --packaged` and `npm run test:hardening -- --packaged` on an interactive Windows desktop. Native UI/capture checks are not established by headless CI alone.
5. Complete applicable real sleep/hardware and wall-clock endurance tests. Record exact version/hash, scope, duration, faults, failures, limitations and resource observations. Do not overwrite a failed receipt with a passing one.
6. Check docs' relative links, download names and images. Use only reviewed synthetic UI screenshots. Source packaging must preserve binary image bytes and third-party license notices.
7. Run `npm run release:source`; inspect the manifest, extracted ZIP and SHA-256 sums. Recheck for secrets/private data. Source packager allowlists source/tests/scripts/docs/workflows and excludes research, dependencies, builds and test profiles.
8. Commit only the standalone allowlist, push to the authorized repo, and inspect CI. Do not attach a source ZIP from an older commit after changing docs/code.
9. Publish a GitHub **prerelease** for experimental builds, with the EXE, source ZIP, SHA256SUMS, manifest and honest release notes. Explicitly state unsigned status and test limits. Use the pinned version download URL in README; `/releases/latest` may omit prereleases.
10. Verify the public repo/README, release visibility, asset names/sizes and downloadable SHA-256 values. Do not claim successful publishing from a local build or an unsubmitted draft.

The Windows workflow runs unit checks/build/source packaging without API secrets. Local-provider tests require no real key. Bounded live-provider tests are opt-in, synthetic, quota-consuming checks; never use private resume/desktop content for them.

After both real runs pass, use `node scripts/summarize-validation.cjs test-results/<both-run> test-results/<microphone-run>`. It additionally requires at least 95% nominal continuous PCM payload, retained final IDs, no unexpected errors and one explicit synthetic review per injected outage. Publish resource observations with fixture/window/load caveats, not as model-correctness statistics.
