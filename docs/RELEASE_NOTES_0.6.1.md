# 0.6.1 experimental candidate

Answer screenshot and Ctrl+Alt+Enter now capture the whole visible selected display and stream an answer without showing a preview or restoring the workspace. Primary display is the default. Review / crop remains available for image inspection, display selection, cropping and quality controls. Quick capture sends Detail pixels (native size, longest edge capped at 3840) to the configured vision provider on explicit action. Existing capture expiry, display-revision validation, provider policy and memory-only image handling remain enforced.

Screen prompts ask for visible constraints, language/interface, sample and edge-case checks, complexity, and an explicit request for clearer text when needed. Generated code is not automatically executed or guaranteed correct. Screenshots cannot see content below the scroll position.

Windows portable app paths are resolved before constructing trusted renderer URLs to handle temporary-directory short paths. IPC sender/frame/page restrictions remain intact.

Validation: 105 unit checks, ten native production scenarios, desktop end-to-end local mock (including minimized one-action screenshot and explicit review/crop), and 16 workspace / four overlay layout checks pass in source. The same ten packaged native scenarios, all 24 packaged hardening checks, packaged desktop end-to-end, actual portable launcher and source ZIP/checksum verification also passed locally. Hosted Windows push CI also passed at runtime commit e206cb0 (run 39556917695). No new cloud calls were made.

Frozen 0.6.0 encrypted endurance finished: 120-minute dual source and 60-minute microphone, zero unexpected errors or missing finalized mock transcript IDs. This evidence belongs to 0.6.0, not the changed 0.6.1 runtime. Physical microphone, loopback and sleep checks were completed on the earlier candidate; no dock was available.

Builds remain unsigned. The public release remains 0.5.8 until publication of a tested candidate. Broader model-quality, accessibility, hardware and offline acceptance gates remain open; there is no 100% correctness or availability claim.
