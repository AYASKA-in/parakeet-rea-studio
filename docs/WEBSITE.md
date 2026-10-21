# Product website on GitHub Pages

Public URL: https://ayaska-in.github.io/parakeet-rea-studio/

The buildless website lives in `docs/site/`. GitHub Pages receives only that reviewed directory; the desktop application, research, keys and local test files are not published as website files. Executable links point to immutable versioned GitHub Release assets. There is no website API-key form, AI backend, cookie storage, analytics or remote font dependency.

## Preview and verify

- Run `node scripts/preview-site.cjs` and open the printed project-path URL.
- Run `node scripts/verify-site.cjs` for public-file, asset/anchor, SEO, structured-data and payload checks.
- Run `node scripts/verify-site.cjs --browser` with the project development dependencies and local Edge installed. This checks 320/390/768/1024/1440 widths across the three examples, contrast, keyboard skip navigation, screenshot dialogs and Escape/focus restoration, FAQ, mobile navigation, reduced motion, forced-colors rendering and no-JavaScript fallback. It uses local content and makes no cloud-model requests. Reports are in ignored `test-results/site/`.

## Publishing

The repository Pages source is GitHub Actions. The pinned `.github/workflows/pages.yml` validates on applicable PRs; only main-branch runs can deploy to the `github-pages` environment. Only the deploy job has Pages/OIDC write permissions. Do not upload the repository root or all of `docs/`.

Push website changes to main. The workflow checks a public-file allowlist and scans text assets for obvious credential patterns before uploading. Add new reviewed public filenames to the allowlist in `scripts/verify-site.cjs` when necessary. This check is a release guard, not a complete secrets or content audit.

The website is separate from the Windows EXE. Website-only changes do not rebuild or replace published application artifacts. The existing Windows workflow may still run on the commit.

## Updating downloads

1. Publish and verify a new GitHub Release first. Do not point at an unreleased build or a placeholder.
2. Update versioned portable/setup links, visible release labels, FAQ signature/version text and SoftwareApplication metadata in `docs/site/index.html` together.
3. Update the pinned release assertions in `scripts/verify-site.cjs` to the actual shipping version. Preserve accurate unsigned/prerelease notices.
4. Review product screenshots for current behavior and synthetic-only content. Regenerate the 1200x630 `assets/social-preview.png` after changing the visual identity or hero. Keep image dimensions and alt text accurate.
5. Run both checks above, inspect desktop/mobile screenshots, commit and push. Verify the final deployed page and download targets.

Keep published historical EXEs, checksums and source manifests immutable. The website source in main can move independently from a release's frozen source revision.

## Search and sharing

The page includes descriptive text, one main heading, canonical URL, index/follow metadata, Open Graph/Twitter image metadata, SoftwareApplication and matching visible FAQ JSON-LD, image dimensions/alt text and an XML sitemap. No fake reviews, ratings or customer claims are included. The 404 page is marked noindex.

The project URL has a sitemap at `/parakeet-rea-studio/sitemap.xml`. A project-path `robots.txt` is included, but crawlers normally read robots rules at the host root; this repository does not control other GitHub Pages repositories or the host-root policy. Page-level indexing metadata and the sitemap remain present.

Indexing and rankings depend on search engines and are not guaranteed by deployment. The owner can add the URL-prefix property to a search console and submit the sitemap. No search-account credentials are needed to run this website.
