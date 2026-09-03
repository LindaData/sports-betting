# Art note — app icon (the one permitted binary asset)

**Why a shape can't do it:** Xcode's asset catalog requires the App Store icon as a 1024×1024 PNG; there is no procedural path. App Store Connect rejects uploads with no icon or with an alpha channel.

**What it is:** the game's own scene, frozen. White football with the dark centre pentagon and five satellites (same construction as `buildBall` in `GameScene.swift`), goalposts with the red gap trim (`Palette.postTrim`), striped pitch with chalk line, sky gradient from `Palette.skyTop` to `Palette.skyBottom`, three motion streaks. Every colour is a `Palette.swift` value converted to 8-bit.

**Distinctness:** no bird, no pipes, no pixel art, no yellow. A reviewer comparing this to Flappy Bird sees a football and goalposts.

**Reproducible:** `python3 studio/art/make_app_icon.py` regenerates `PitchFlap/Assets.xcassets/AppIcon.appiconset/AppIcon.png` (needs Pillow). Rendered at 4096 and downsampled, RGB, no alpha.

**Tested at:** 1024 (this file), and mentally at 60 — one silhouette, no text.

```
ART: app-icon  TOUCHES: AppIcon.appiconset/AppIcon.png, Contents.json  DISTINCTNESS: football + goalposts, no bird/pipes  FILE: studio/art/app-icon.md
```
