# Contributing

This is an independent Windows assistant. Contributions must be original or
compatibly licensed. Do not submit vendor binaries, decompiled source, credentials,
meeting recordings, resumes or private transcripts.

Use Windows and Node.js 22.14 or newer:

Native builds use Windows' .NET Framework C# compiler (`Framework64/v4.0.30319/csc.exe`), normally available on Windows 11. `npm run build:native` builds the original timer helper; start/build/native-test hooks run it automatically. Build it first when invoking a native test script directly. Packaged users need no separate SDK.

```powershell
npm ci
npm test
npm start
```

`npm run test:desktop` runs local mock-provider tests in Electron and Microsoft
Edge, including real Windows capture-exclusion checks. It requires an interactive
Windows desktop, Edge and a free port 5173. Tests use synthetic media and no paid
provider calls. CI runs the portable core/audio/reliability tests and builds on
Windows; an interactive native check remains part of local release verification.

`npm run test:live` is an explicit, bounded integration check using your own Gemini
key entered through masked stdin. It sends synthetic speech, a coding problem and
a synthetic screen image and image-only resume PDF to Google. It consumes the project's quota and may incur
charges on a billing-enabled project. It does not capture your real desktop for
the model. Results and encrypted test-profile settings stay in ignored
`test-results/`. Do not attach that whole directory to issues.

Before a pull request, run the relevant tests, document changed behavior and
describe how you verified it. Preserve sandboxed renderers and trusted-window IPC.
Use text-node DOM rendering for model output. New capabilities must be explicit to
the user; do not silently start audio, screen capture, uploads or model fallback.

Build with `npm run build:win`, then `npm run release:source`. The source packager
uses an allowlist and excludes research artifacts, dependencies, builds, credentials
and local sessions. Keep dependency licenses intact. Contributions are under MIT.

User documentation lives in `docs/` and README. Update it with behavior changes. See `docs/RELEASING.md` for publication gates, `docs/RELIABILITY.md` for finite test scope, and `npm run test:soak -- --minutes=120` for real wall-clock synthetic endurance. A one-minute preflight is not a completed long soak.

Run `npm run test:hardening` for the local safety regressions, or append `-- --packaged` after building. Tests deliberately inject a save failure only in their own profile. Real private material must not be used with an unpaid-cloud test profile; live scripts use synthetic fixtures.

`npm run test:live -- --vision-only` runs one synthetic screenshot stage; `--pdf-only` runs one synthetic PDF stage. Preserve failed receipts before a focused retry and report both attempts. A later successful retry does not erase provider timeouts or establish a general success rate. `node scripts/verify-portable.cjs` checks the actual built EXE in an isolated profile.
