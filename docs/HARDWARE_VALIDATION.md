# Hardware validation

Use npm run test:devices -- --packaged on an interactive Windows desktop. This creates a separate profile and a loopback-only mock provider. It does not use a real cloud key, save PCM audio or recognize private speech. Reports contain frame/peak counters and synthetic checkpoint labels only.

The watcher writes its exact control path to test-results/devices-*/progress.json. Capture stays off until the operator sets startDevices=true in that control file. The device phase records twelve seconds from the real microphone, followed by twelve seconds of system loopback. The latter plays a quiet four-second 440 Hz tone. Speak a short harmless phrase during the microphone phase; ensure playback will not disturb another call.

After device checks, the watcher waits for startSleep=true. That starts a new local microphone capture and sets phase=sleep-now. Use Windows Start → Power → Sleep, wait about thirty seconds, wake and sign in. The test requires genuine native suspend/resume events, capture remaining stopped, retained context, and an explicit successful restart/stop. It can reconnect to the surviving test window if Modern Standby disconnects its controller. A controller/driver failure is an incomplete result, not a pass. If the test window is still open after failure, stop listening and close that test window.

Use only the exact control file printed by this run; do not modify your normal profile. The watcher times out waiting for operator steps. Dock/external-display coverage requires that hardware; the current laptop-only test cannot establish it.

A low-disk simulation and forced termination of a separate test app are covered by test:production. These exercise recovery of the last completed save, not every possible power-loss point or physical disk failure. Tests never terminate the normal application.
