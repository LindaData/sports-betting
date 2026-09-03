---
paths:
  - "apps/ios-flappy/**"
---
# Rules for the PitchFlap iOS game

These apply to every file under `apps/ios-flappy/`. They encode decisions already made in the code; do not relitigate them in a PR without a design note from `studio-designer`.

## Game code

- **Every gameplay constant lives in `Tuning.swift`, with units in the comment.** No magic numbers in `GameScene.swift`. A change to feel is a change to `Tuning.swift`, nothing else.
- **Motion is per second, multiplied by `dt`.** Never `+= constant` per frame. `dt` is clamped by `Tuning.maxTimeStep`; keep it that way.
- **The ball's vertical velocity is integrated by hand** (semi-implicit Euler) and pushed to the physics body. `physicsWorld.gravity` stays `.zero`. Do not switch to engine gravity; the tuning constants would stop meaning what they say.
- **A tap replaces vertical velocity; it never adds to it.** This is the core feel decision.
- **Collisions are bitmasks; the ball's `collisionBitMask` is 0.** Detection and response are separate decisions. Scoring uses the trigger strip in the gap, never per-gate flags.
- **State is an explicit enum** (`ready`, `playing`, `gameOver`). Every input and every `update` step switches on it. Add states; never add booleans that shadow one.
- **No image or audio assets in v1.** Everything is drawn procedurally. Adding a binary asset requires a `studio-art` note explaining why a shape can't do it.
- **Positions are fractions of `size`, never hardcoded points.** The scene is `.resizeFill`.
- Every colour goes in `Palette.swift`.

## Swift and Xcode

- Target iOS 17, iPhone only, portrait only. Don't widen without a producer decision.
- Swift 5 language mode in the project file. If moving to Swift 6 strict concurrency, the SpriteKit callbacks (`update`, `didBegin`, `touchesBegan`) are main-actor; annotate the scene `@MainActor` rather than sprinkling `nonisolated`.
- The checked-in `.xcodeproj` uses Xcode 16's synchronized root group (`objectVersion = 77`). Files added under `PitchFlap/` are picked up automatically; do not hand-edit `project.pbxproj` to add files.
- `project.yml` (XcodeGen) must stay in sync with the pbxproj's settings when either changes.
- Bundle identifier `com.lindadata.pitchflap`. The owner sets the signing team locally; never commit a `DEVELOPMENT_TEAM` value.

## Store and compliance

- The word "Flappy" never appears in the app name, bundle ID, store copy, screenshots, or keywords. Apple rejected apps that "leverage a popular app" in 2014 and the guideline (2.3, 4.1) still stands. Art, name, and copy must be distinct.
- v1 collects nothing. If analytics is added, it must keep the App Privacy label at "Data Not Collected" or "Data Not Linked to You" and must not require the App Tracking Transparency prompt. Any SDK added needs its privacy-manifest impact written into the PR.
- Never commit `.p8`, `.p12`, `.mobileprovision`, or App Store Connect API keys. The repo hook blocks these; do not work around it.

## Verification honesty

- This repo's cloud sessions run on Linux with no Swift toolchain. A PR that touches Swift must say in its body whether it was compiled, and on what. "Structurally checked" is not "builds".
- The only real checks are on the owner's Mac. Keep Swift changes small enough that a single build-and-run on device is a sufficient review.
