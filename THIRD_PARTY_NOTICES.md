# Third-party notices

The MIT grant in LICENSE applies to this project's independently written source.
Dependencies retain their own copyright notices and license terms.

Direct dependencies/tooling pinned in package-lock.json:

| Component | Role | License |
| --- | --- | --- |
| Electron | Desktop runtime | MIT; bundled Chromium/Node and other notices also apply |
| pdf-parse | PDF text extraction | Apache-2.0 |
| Playwright | Browser/native test automation | Apache-2.0 |
| ws | Test WebSocket server | MIT |
| electron-builder | Packaging tooling | MIT |

Production transitive components include PDF.js/pdfjs-dist (Apache-2.0),
@napi-rs/canvas and its platform packages (MIT), and their upstream native
components. Installed packages include their detailed license files; the lockfile
records resolved versions and declared license metadata. Electron distributions
include LICENSE.electron.txt and LICENSES.chromium.html. Preserve these when redistributing
the packaged runtime. A clean source release omits node_modules and downloads
dependencies through npm ci.

No original ParakeetAI executable, native binding, extracted source, logo asset,
backend or account credentials are included. This project is not affiliated with
ParakeetAI. The working project name does not imply vendor endorsement.
