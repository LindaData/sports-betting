# How an iPhone game actually works

Read this with `PitchFlap/GameScene.swift` open next to it. Every section
points at real code in this repo.

---

## 1. The one idea

Almost everything you have written before is **request/response**: something
asks, your code answers, your code stops. A game is not that. A game is a
**loop that never stops**:

```
every frame (60 or 120 times a second):
    1. read input        - did they tap?
    2. advance the world  - move things by how much time passed
    3. resolve collisions - did anything hit anything?
    4. draw               - paint the result
```

That is the entire discipline. Everything else — physics, scoring, menus,
difficulty — is something you hang off one of those four steps.

In this game the loop is `GameScene.update(_:)`. SpriteKit calls it once per
frame and hands you a timestamp. Find it and read it top to bottom; it is
about twenty lines and it is the spine of the whole program.

## 2. What runs what

Apple gives you a stack of frameworks and the only real decision is how far
down you go:

| Layer | What it is | Use it when |
|---|---|---|
| **SwiftUI** | Declarative UI: buttons, lists, screens | Menus, settings, leaderboards, everything that isn't the game itself |
| **SpriteKit** | Apple's 2D game engine: sprites, a frame loop, physics, actions | 2D games. This one. |
| **SceneKit / RealityKit** | 3D scene graph, AR | 3D games, AR |
| **Metal** | Talking to the GPU directly | You have a specific reason and a lot of time |

This game uses **SwiftUI for the shell, SpriteKit for the game**, which is the
normal shape of a small iOS game in 2026. The join is three lines in
`GameView.swift`:

```swift
SpriteView(scene: scene)
```

`SpriteView` is a SwiftUI view that hosts a SpriteKit scene and drives its
render loop. That single call is the whole bridge between the two worlds.

Third-party engines (Unity, Godot) are the other path. They win on 3D, on
shipping to Android and iOS from one codebase, and on tooling. SpriteKit wins
on: nothing to install, no runtime to ship, tiny binaries, native performance,
and you learn Swift — which you need anyway for anything else on the platform.
For a first game, and for anything you want to sit next to other Swift work,
SpriteKit is the right call.

## 3. Frame time: the thing beginners get wrong

Write this and your game is broken:

```swift
ball.y += 5          // WRONG - 5 what? per frame?
```

A 60 Hz iPhone SE runs that 60 times a second. A 120 Hz iPhone Pro runs it 120
times. Same code, **double the speed**. Your game is now unplayable on half the
devices, and it changes speed whenever the phone thermally throttles.

The fix is to express everything **per second** and multiply by the elapsed
time:

```swift
let dt = currentTime - lastFrameTime     // seconds since the last frame
ball.y += velocity * dt                  // velocity is points per second
```

Now 200 points per second is 200 points per second on every device. Every
number in `Tuning.swift` is written this way and the units are in the comments.

One guard rail, in `Tuning.maxTimeStep`:

```swift
let dt = min(CGFloat(currentTime - lastFrameTime), Tuning.maxTimeStep)
```

If the app stalls — you hit a breakpoint, a call comes in, the phone sleeps —
the next `dt` is enormous. Without the clamp, the ball teleports through a
goalpost and the collision is never detected. Clamping the step is standard
practice in every engine; it trades a little slow-motion for never tunnelling
through geometry.

## 4. Coordinates

SpriteKit puts **(0, 0) at the bottom-left and y grows upward** — like a plot,
not like a web page. Positions are in *points*, the device-independent unit.
An iPhone 15 is 393 × 852 points; on the physical screen each point is 3 real
pixels, and you never have to care.

The scene here is set to `.resizeFill`, meaning the scene is exactly the size
of the screen and nothing is letterboxed. The cost is that you cannot hardcode
positions — you write `size.width * 0.30`, not `118`. Every position in this
game is expressed as a fraction of the screen or an offset from an edge, which
is why it looks right on an SE and on a Pro Max.

## 5. Physics: do it yourself, or let the engine?

Both, and knowing where to draw the line is the actual skill.

**We do the ball's vertical motion ourselves** (`stepBall`):

```swift
verticalVelocity = max(verticalVelocity + Tuning.gravity * dt, Tuning.maxFallSpeed)
ball.physicsBody?.velocity = CGVector(dx: 0, dy: verticalVelocity)
```

That is semi-implicit Euler integration: update velocity from acceleration,
then update position from the new velocity. It is one line, it is numerically
stable at these step sizes, and — the reason it matters here — it means
`gravity = -2400` in `Tuning.swift` means exactly −2400 points/s² and nothing
else. If you let SpriteKit's own gravity do it, the number goes through an
internal metres-to-points scaling and you end up tuning by superstition.

Note that a tap **replaces** the velocity rather than adding to it:

```swift
verticalVelocity = Tuning.flapVelocity   // not += 
```

That is the entire secret of the Flappy Bird feel. Every tap produces an
identical hop from any falling speed, so the player can always recover. Change
it to `+=` and play it — the game becomes unfair immediately, and you will
have learned more about game feel in ten seconds than from any article.

The physics is now simple enough to predict on paper, which is the point:

```
apex height of one flap = v² / (2g) = 700² / (2 × 2400) ≈ 102 points
time to apex            = v / g     = 700 / 2400        ≈ 0.29 seconds
```

Both numbers are things you can *design against*. The gap is 235 points, so a
gap is a little over two flap-heights tall — comfortable. Drop it toward the
155-point floor and it becomes about one and a half, which is the width of the
window where a mistimed tap kills you.

**We let the engine do collision detection**, because writing a correct
broadphase is a bad use of your evening.

## 6. Collisions are bitmasks

Every physics body declares what it *is* and what it wants to be *told about*:

```swift
enum Category {
    static let ball:     UInt32 = 0b0001
    static let obstacle: UInt32 = 0b0010
    static let scorer:   UInt32 = 0b0100
    static let ground:   UInt32 = 0b1000
}
```

Three masks, and they do different jobs:

- `categoryBitMask` — what this body is.
- `contactTestBitMask` — which categories should fire `didBegin(_:)` when
  touched. This is *notification*.
- `collisionBitMask` — which categories should physically push this body
  around. This is *response*.

The ball sets `collisionBitMask = 0`. It is never physically stopped or
bounced by anything; it passes straight through and we decide in code what a
touch means. That separation is worth internalising: **detection and response
are different decisions**, and games almost always want to make them
separately.

Bits rather than strings because the check runs for every body pair, every
frame. `a.category & b.contactTest != 0` is one instruction.

## 7. Scoring without bookkeeping

The obvious way to score is to track each gate and ask "has the ball passed it
yet?" — which means a `hasScored` flag per gate, and a bug the first time you
restart mid-flight.

Instead, `spawnGate()` puts an invisible 6-point-wide strip inside the gap:

```swift
scorer.physicsBody = SKPhysicsBody(rectangleOf: CGSize(width: 6, height: gap))
scorer.physicsBody?.categoryBitMask = Category.scorer
```

Touching it scores. `didBegin` fires once when an overlap starts, so there is
no double-counting, no flag, and no state to reset. The lesson generalises far
past this game: **when you find yourself tracking whether something has
happened yet, look for a trigger volume that can only be entered once.**

## 8. States

A game is never in one mode. This one has three:

```swift
enum GameState { case ready, playing, gameOver }
```

`update(_:)` switches on it and runs a different step function for each; so
does `touchesBegan`. Once you name the states explicitly, whole categories of
bug disappear — the ball cannot flap while dead, gates cannot spawn on the
title screen, the score cannot tick up during the death animation. Every one of
those is a bug you would otherwise ship.

Watch the small one in `.gameOver`:

```swift
if CACurrentMediaTime() - diedAt > Tuning.restartLockout {
```

Without that 0.65-second lockout, the tap that killed you also restarts the
game and you never see your score. Almost all "feel" bugs are this shape: a
transition that is technically correct and humanly wrong.

## 9. Difficulty is two straight lines

The entire difficulty curve:

```swift
scrollSpeed = min(200 + score × 3.5, 370)      // faster
currentGap  = max(235 - score × 3.0, 155)      // tighter
```

Two linear ramps, each with a saturation point. At score 0 the game is gentle;
by score 27 the gap has bottomed out; by score 49 the speed has too. After
that it is a pure endurance test at fixed difficulty, which is what a good
endless game wants — a skill ceiling, not an inevitable wall.

**This is the part of the game that most rewards your day job.** Those four
constants are the parameters of a model whose response variable is *how long a
player survives*, and you already know how to fit that properly:

- Log every run: score, duration, taps, and the tuning constants in force.
  Twenty lines of `Codable` written to a JSON file.
- The score distribution of an endless runner is roughly geometric — each gate
  is a near-independent survival trial. So median score is a much better
  summary than mean, which one lucky run will dominate.
- A/B the constants against yourself before you A/B them against users. Change
  one at a time; changing `gap` and `speed` together tells you nothing about
  either.
- The retention question is not "what is the average score" but "what fraction
  of players reach score 5 in their first three attempts". First-session
  success rate is what predicts whether anyone opens the app again.

Most indie developers tune this by vibes. You do not have to.

## 10. Feel

Mechanically the game is done by section 9. The difference between "works" and
"feels good" is a handful of small things, all of them in this code:

- **Rotation follows velocity.** The ball noses up as it rises and tips forward
  as it falls, easing toward the target angle rather than snapping. Nothing
  about the physics changes; it just looks like it has weight.
- **The score label punches.** Scale to 1.18 in 70 ms, back to 1.0 in 110 ms.
- **Haptics.** A light tap on flap, a lighter one on score, an error pattern on
  death. On a phone this does more work than the sound would.
- **A white flash on death,** then a 0.35 s beat before the score card fades
  in. The pause is what makes the death land.
- **Parallax clouds** drifting at 18% of the ground speed, which is what sells
  depth on a flat 2D screen.

Every one of those is three to five lines. Collectively they are most of the
difference between a prototype and something a person will play twice. Budget
real time for them — in a small game, feel is not polish applied at the end,
it is the product.

## 11. Change these, in this order

Do them in order; each one teaches the system you need for the next.

1. **Retune it.** Open `Tuning.swift`, set `gravity` to `-1200`, run. Then
   `-4000`. Then put it back and halve `flapVelocity`. You now know what those
   two numbers own.
2. **Break the flap on purpose.** Change `verticalVelocity = Tuning.flapVelocity`
   to `+=` and play three rounds. Change it back.
3. **Recolour it.** `Palette.swift` only. Make it a night match.
4. **Add a medal.** In `die()`, pick a label from the score — bronze at 10,
   silver at 20, gold at 30 — and show it on the game-over card. This is your
   first change that touches game state and UI together.
5. **Add a moving gate.** Give some gates a vertical oscillation:
   `gate.position.y = sin(elapsed × 2) * 40`. You will discover you need to
   store per-gate data, which means a small `Gate` class instead of a bare
   `SKNode` — a real refactor, at a size where it is still easy.
6. **Log every run to disk** and plot the score distribution. See section 9.
7. **Add sound.** Two `.wav` files in the bundle and `SKAction.playSoundFileNamed`.
   Left out here deliberately so there were no binary assets to chase.
8. **Add a pause button.** A SwiftUI overlay above the `SpriteView` that sets
   `scene.isPaused`. This is the exercise that teaches you how SwiftUI and
   SpriteKit share a screen — the pattern you will use for every menu,
   settings screen, and leaderboard from here on.

## 12. Where this goes

The skills in this 600-line file are the skills for any 2D iOS game: a fixed
loop, delta time, a state machine, trigger volumes, a tuning file, and a feel
pass. A match-3, a card game, an endless runner, a physics puzzler — same
spine, different rules.

Shipping is a separate skill from building, and a smaller one than people
expect: an Apple Developer account, an app icon in every required size,
screenshots, a privacy manifest (this game collects nothing, which makes that
form trivial), and App Store review. Worth doing once, on something small,
before you need it for something you care about.
