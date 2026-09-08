# Pitch Flap — a first iPhone game

A complete, playable Flappy Bird–style game in Swift, built to be read as much
as played. Tap to keep the ball up, thread it between the goalposts, don't hit
the grass.

It is themed to this repo (a football through goalposts) but the mechanics are
the classic ones, and every system in it is the system you will reuse in the
next game you make.

- **`LEARN.md` is the lesson.** Read that first if the goal is to understand
  how iPhone games are built. This file is just setup.
- **`PitchFlap/Tuning.swift` is the dial board.** Every number that decides how
  the game feels is in one file, with units.

---

## What you need

| Thing | Why | Cost |
|---|---|---|
| A Mac | Xcode only runs on macOS. There is no way around this. | — |
| Xcode 16 or newer | The IDE, compiler, simulator, and device installer. | Free, Mac App Store |
| An Apple ID | To run on your own iPhone (a paid account is *not* required). | Free |
| Apple Developer Program | Only to ship on the App Store. Not needed to build or play. | $99/yr |

Deployment target is iOS 17, portrait, iPhone only.

## Run it

```bash
git clone <this repo>
cd apps/ios-flappy
open PitchFlap.xcodeproj
```

Then in Xcode:

1. Pick a simulator in the toolbar (any iPhone) and press **⌘R**.
2. Click the mouse to flap. That is the whole control scheme.

The simulator is fine for logic, but it lies about feel — no haptics, and frame
pacing is not the phone's. Judge the game on a real device.

## Run it on your own iPhone

1. Plug the phone in, unlock it, tap **Trust**.
2. In Xcode: **Project navigator → PitchFlap → Signing & Capabilities**.
3. Tick **Automatically manage signing**, and set **Team** to your personal
   Apple ID team (add the account under Xcode → Settings → Accounts).
4. Change **Bundle Identifier** to something unique to you, e.g.
   `com.yourname.pitchflap`. Bundle IDs are globally unique across Apple.
5. Select your iPhone in the toolbar's device menu and press **⌘R**.
6. First launch will be blocked. On the phone: **Settings → General → VPN &
   Device Management → your Apple ID → Trust**. Launch again.

A free Apple ID signs the app for **7 days**, after which it stops launching
until you rebuild. That is Apple's limit, not a bug. A paid account extends it
to a year.

## If the project file gives you trouble

The `.xcodeproj` here was written by hand rather than by Xcode. Two fallbacks,
either of which takes about a minute:

**Regenerate it**

```bash
brew install xcodegen
cd apps/ios-flappy && xcodegen generate
```

**Or build a fresh project around the sources**

1. Xcode → **File → New → Project → iOS → App**.
2. Interface **SwiftUI**, Language **Swift**. Name it `PitchFlap`.
3. Delete the generated `ContentView.swift` and `PitchFlapApp.swift`.
4. Drag the six files from `PitchFlap/` into the new project, ticking
   **Copy items if needed** and the `PitchFlap` target.

The source files carry the whole game; the project file only lists them.

## Layout

```
PitchFlap/
  PitchFlapApp.swift   @main — the app entry point (10 lines)
  GameView.swift       SwiftUI screen that hosts the SpriteKit scene
  GameScene.swift      the game: loop, physics, gates, scoring, states
  Tuning.swift         every gameplay constant, with units
  Palette.swift        every colour
  Assets.xcassets      app icon slot and accent colour
```

No image or audio files. Everything is drawn from shapes and coloured
rectangles at runtime, so there are no assets to go missing and nothing to
license. Swapping in real art later is a per-node change, not a rewrite.
