# Desktop UI design — 0.5.8

The workspace uses a restrained slate and teal palette, readable system fonts and clear actions. All fonts and icons are local; the refresh adds no font downloads or UI dependencies.

## Visual system

| Role | Value |
|---|---|
| Canvas | `#f3f6fa` |
| Surface | `#ffffff` |
| Sidebar | `#edf2f7` |
| Primary text | `#172b42` |
| Secondary text | `#526377` |
| Action | `#09675f` |
| Action hover | `#07524c` |
| Soft action surface | `#e5f3f0` |
| Error | `#a12632` |
| Fonts | Windows Segoe UI Variable / Segoe UI; Consolas for code |

`renderer/styles.css` supplies the existing structural rules. `renderer/workspace-theme.css`, loaded afterward, owns the visual tokens, accessible sizing and responsive overrides. `renderer/overlay.css` is an independent glass presentation layer; the workspace no longer imports it.

Transcript text is 16 px; answer text is 17 px. Form values use 15 px, labels 14 px and help text 13 px. Primary buttons are 44 px tall. Utility labels are generally 12 px; the small STUDIO wordmark is decorative branding. No privacy/state message relies on color alone.

## Interaction changes

- Audio source and Start listening appear before the scrollable transcript, in matching visual/keyboard order.
- Microphone device selection and Refresh live under **Microphone options**, preserving all existing audio behavior.
- **Copilot window** is a labeled action instead of an unexplained icon.
- Sidebar shortcuts expose Show workspace and Show copilot.
- Navigation, keyboard focus, forms, error notices and disabled controls retain explicit states.
- At narrower widths the transcript/answer stack instead of shrinking their type.

## Glass overlay

White answer text remains fully opaque while background alpha is adjustable. Answers use 18 px, or 17 px at compact width, with a dark outline and restrained glow. Code uses 14 px. Chrome/control surfaces stay dark and readable. Expanded controls scroll within a bounded region, and compact-height spacing keeps the footer available at 340 × 300.

Clear glass over arbitrary screen pixels cannot have a universal contrast guarantee; increase background opacity on bright/busy screens. The UI refresh does not change capture protection, native window opacity, hotkeys, provider logic or recording lifecycle.

## Verification

`npm run test:ui` uses isolated Edge browser contexts, synthetic data and temporary loopback ports. It checks all four pages at 1440, 1280, 960 and 640 px, visible text contrast (4.5:1 normal / 3:1 large), document overflow, primary-control containment, keyboard skip navigation and microphone disclosure. Overlay checks cover normal/minimum sizes with controls open and closed. Screenshots and a JSON report are written under ignored `test-results/ui-<version>/`.

Disabled controls, decorative icons/wordmarks, placeholder text and arbitrary pixels behind transparent glass are not a blanket WCAG certification. Native audio, capture exclusion, imports, streamed answers and persistence remain covered by the desktop integration suite.

The existing 60/120-minute endurance results belong to 0.5.7. A UI test is not a new long-session or cloud-model quality benchmark.
