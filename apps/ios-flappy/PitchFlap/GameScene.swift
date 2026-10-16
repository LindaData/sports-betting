import SpriteKit
import UIKit
import QuartzCore

// MARK: - Physics categories
//
// A category is a single bit. Every body says which category it *is*
// (categoryBitMask) and which categories it wants to be *told about*
// (contactTestBitMask). Bitmasks are used instead of strings because the
// collision check runs for every body pair, every frame - an integer AND is
// about as cheap as a test can get.

private enum Category {
    static let ball:     UInt32 = 0b0001
    static let obstacle: UInt32 = 0b0010
    static let scorer:   UInt32 = 0b0100
    static let ground:   UInt32 = 0b1000
}

private enum GameState {
    case ready      // waiting for the first tap
    case playing    // simulation running
    case gameOver   // frozen, showing the score
}

final class GameScene: SKScene, SKPhysicsContactDelegate {

    // MARK: Stored state

    private var state: GameState = .ready

    private var score = 0
    private var best = UserDefaults.standard.integer(forKey: "PitchFlap.best")

    /// The ball's vertical speed, in points per second. We integrate this by
    /// hand rather than letting the engine apply gravity, so that `Tuning`
    /// numbers mean exactly what they say.
    private var verticalVelocity: CGFloat = 0

    private var lastFrameTime: TimeInterval = 0
    private var elapsed: CGFloat = 0
    private var diedAt: TimeInterval = 0

    /// Distance travelled since the last gate was spawned.
    private var distanceSinceGate: CGFloat = 0

    // MARK: Nodes

    private let hud = SKNode()            // fixed to the screen; never scrolls
    private var ball = SKNode()
    private var gates: [SKNode] = []
    private var groundTiles: [SKSpriteNode] = []
    private var clouds: [SKSpriteNode] = []

    private let scoreLabel = SKLabelNode(fontNamed: "AvenirNext-Bold")
    private var readyOverlay = SKNode()
    private var gameOverOverlay = SKNode()
    private var finalScoreLabel = SKLabelNode(fontNamed: "AvenirNext-Bold")
    private var finalBestLabel = SKLabelNode(fontNamed: "AvenirNext-DemiBold")

    private let haptics = UIImpactFeedbackGenerator(style: .medium)
    private let crashHaptic = UINotificationFeedbackGenerator()

    // MARK: Derived geometry

    private var groundTop: CGFloat { Tuning.groundHeight }
    private var ballX: CGFloat { size.width * Tuning.ballScreenFraction }
    private var topInset: CGFloat { max(view?.safeAreaInsets.top ?? 0, 44) }

    /// Speed and gap both ramp with the score. This is the entire difficulty
    /// curve - two straight lines with a floor and a ceiling.
    private var scrollSpeed: CGFloat {
        min(Tuning.baseScrollSpeed + CGFloat(score) * Tuning.scrollSpeedPerPoint,
            Tuning.maxScrollSpeed)
    }

    private var currentGap: CGFloat {
        max(Tuning.startingGap - CGFloat(score) * Tuning.gapShrinkPerPoint,
            Tuning.minimumGap)
    }

    // MARK: - Lifecycle

    override func didMove(to view: SKView) {
        backgroundColor = Palette.skyTop
        physicsWorld.gravity = .zero          // we do gravity ourselves
        physicsWorld.contactDelegate = self

        removeAllChildren()
        hud.removeAllChildren()
        addChild(hud)

        buildSky()
        buildClouds()
        buildGround()
        buildBall()
        buildHUD()
        buildOverlays()

        resetToReady()
        haptics.prepare()
    }

    // MARK: - Building the scene

    private func buildSky() {
        let sky = SKSpriteNode(texture: GameScene.verticalGradient(
            from: Palette.skyBottom, to: Palette.skyTop,
            size: CGSize(width: 8, height: max(size.height, 1))))
        sky.size = size
        sky.anchorPoint = .zero
        sky.position = .zero
        sky.zPosition = -100
        addChild(sky)
    }

    private func buildClouds() {
        clouds.removeAll()
        for i in 0..<5 {
            let w = CGFloat.random(in: 90...170)
            let cloud = SKSpriteNode(color: Palette.cloud,
                                     size: CGSize(width: w, height: w * 0.32))
            cloud.zPosition = -60
            cloud.alpha = CGFloat.random(in: 0.35...0.7)
            cloud.position = CGPoint(
                x: size.width * CGFloat(i) / 5 + CGFloat.random(in: 0...60),
                y: CGFloat.random(in: size.height * 0.55...size.height * 0.9))
            addChild(cloud)
            clouds.append(cloud)
        }
    }

    private func buildGround() {
        groundTiles.removeAll()
        // Two tiles leapfrogging each other gives an endless scroll with
        // exactly two nodes instead of a growing list.
        for i in 0..<2 {
            let tile = SKSpriteNode(color: Palette.grass,
                                    size: CGSize(width: size.width, height: Tuning.groundHeight))
            tile.anchorPoint = .zero
            tile.position = CGPoint(x: CGFloat(i) * size.width, y: 0)
            tile.zPosition = 40

            let stripe = SKSpriteNode(color: Palette.grassDark,
                                      size: CGSize(width: size.width / 2, height: Tuning.groundHeight))
            stripe.anchorPoint = .zero
            stripe.position = .zero
            tile.addChild(stripe)

            let chalk = SKSpriteNode(color: Palette.grassLine,
                                     size: CGSize(width: size.width, height: 4))
            chalk.anchorPoint = .zero
            chalk.position = CGPoint(x: 0, y: Tuning.groundHeight - 12)
            tile.addChild(chalk)

            addChild(tile)
            groundTiles.append(tile)
        }

        // One invisible, immovable body across the top of the grass.
        let floor = SKNode()
        floor.physicsBody = SKPhysicsBody(edgeFrom: CGPoint(x: -size.width, y: groundTop),
                                          to: CGPoint(x: size.width * 2, y: groundTop))
        floor.physicsBody?.isDynamic = false
        floor.physicsBody?.categoryBitMask = Category.ground
        floor.physicsBody?.contactTestBitMask = Category.ball
        floor.physicsBody?.collisionBitMask = 0
        addChild(floor)
    }

    private func buildBall() {
        let r = Tuning.ballRadius
        let node = SKNode()
        node.zPosition = 50

        let body = SKShapeNode(circleOfRadius: r)
        body.fillColor = Palette.ball
        body.strokeColor = Palette.ballPanel
        body.lineWidth = 2
        node.addChild(body)

        // A centre pentagon and five satellites read as a football at 34pt.
        let pent = SKShapeNode(path: GameScene.pentagonPath(radius: r * 0.42))
        pent.fillColor = Palette.ballPanel
        pent.strokeColor = .clear
        node.addChild(pent)

        for i in 0..<5 {
            let angle = CGFloat(i) * (.pi * 2 / 5) - .pi / 2
            let dot = SKShapeNode(circleOfRadius: r * 0.17)
            dot.fillColor = Palette.ballPanel
            dot.strokeColor = .clear
            dot.position = CGPoint(x: cos(angle) * r * 0.75, y: sin(angle) * r * 0.75)
            node.addChild(dot)
        }

        node.physicsBody = SKPhysicsBody(circleOfRadius: r * 0.92)
        node.physicsBody?.isDynamic = true
        node.physicsBody?.affectedByGravity = false
        node.physicsBody?.allowsRotation = false
        node.physicsBody?.categoryBitMask = Category.ball
        node.physicsBody?.contactTestBitMask = Category.obstacle | Category.scorer | Category.ground
        node.physicsBody?.collisionBitMask = 0   // never bounce; we decide what a hit means

        addChild(node)
        ball = node
    }

    private func buildHUD() {
        scoreLabel.removeFromParent()
        scoreLabel.removeAllChildren()
        scoreLabel.fontSize = 62
        scoreLabel.fontColor = .white
        scoreLabel.horizontalAlignmentMode = .center
        scoreLabel.zPosition = 100
        scoreLabel.position = CGPoint(x: size.width / 2, y: size.height - topInset - 70)
        // A cheap drop shadow: the same label, dark, offset by a few points.
        let shadow = SKLabelNode(fontNamed: "AvenirNext-Bold")
        shadow.fontSize = 62
        shadow.fontColor = SKColor.black.withAlphaComponent(0.28)
        shadow.horizontalAlignmentMode = .center
        shadow.position = CGPoint(x: 3, y: -4)
        shadow.zPosition = -1
        shadow.name = "shadow"
        scoreLabel.addChild(shadow)
        hud.addChild(scoreLabel)
    }

    private func buildOverlays() {
        // ---- Ready ----
        readyOverlay = SKNode()
        readyOverlay.zPosition = 120

        let title = SKLabelNode(fontNamed: "AvenirNext-Heavy")
        title.text = "PITCH FLAP"
        title.fontSize = 40
        title.fontColor = .white
        title.position = CGPoint(x: size.width / 2, y: size.height * 0.66)
        readyOverlay.addChild(title)

        let hint = SKLabelNode(fontNamed: "AvenirNext-DemiBold")
        hint.text = "Tap to keep the ball up"
        hint.fontSize = 19
        hint.fontColor = SKColor.white.withAlphaComponent(0.9)
        hint.position = CGPoint(x: size.width / 2, y: size.height * 0.66 - 34)
        readyOverlay.addChild(hint)

        hud.addChild(readyOverlay)

        // ---- Game over ----
        finalScoreLabel.removeFromParent()
        finalBestLabel.removeFromParent()
        gameOverOverlay = SKNode()
        gameOverOverlay.zPosition = 120
        gameOverOverlay.alpha = 0

        let card = SKShapeNode(rectOf: CGSize(width: 260, height: 190), cornerRadius: 22)
        card.fillColor = Palette.panel
        card.strokeColor = .clear
        card.position = CGPoint(x: size.width / 2, y: size.height * 0.56)
        gameOverOverlay.addChild(card)

        let over = SKLabelNode(fontNamed: "AvenirNext-Heavy")
        over.text = "FULL TIME"
        over.fontSize = 26
        over.fontColor = Palette.ink
        over.position = CGPoint(x: 0, y: 56)
        card.addChild(over)

        finalScoreLabel.fontSize = 56
        finalScoreLabel.fontColor = Palette.ink
        finalScoreLabel.position = CGPoint(x: 0, y: -10)
        card.addChild(finalScoreLabel)

        finalBestLabel.fontSize = 17
        finalBestLabel.fontColor = Palette.ink.withAlphaComponent(0.6)
        finalBestLabel.position = CGPoint(x: 0, y: -52)
        card.addChild(finalBestLabel)

        let again = SKLabelNode(fontNamed: "AvenirNext-DemiBold")
        again.text = "Tap to play again"
        again.fontSize = 18
        again.fontColor = .white
        again.position = CGPoint(x: size.width / 2, y: size.height * 0.56 - 130)
        gameOverOverlay.addChild(again)

        hud.addChild(gameOverOverlay)
    }

    // MARK: - State transitions

    private func resetToReady() {
        state = .ready
        score = 0
        verticalVelocity = 0
        elapsed = 0
        distanceSinceGate = 0
        lastFrameTime = 0

        gates.forEach { $0.removeFromParent() }
        gates.removeAll()

        ball.removeAllActions()
        scoreLabel.removeAllActions()
        scoreLabel.setScale(1.0)
        readyOverlay.removeAllActions()
        gameOverOverlay.removeAllActions()

        ball.position = CGPoint(x: ballX, y: size.height * 0.62)
        ball.zRotation = 0
        ball.physicsBody?.velocity = .zero

        updateScoreLabel()
        scoreLabel.alpha = 0
        readyOverlay.alpha = 1
        gameOverOverlay.alpha = 0
    }

    private func startPlaying() {
        state = .playing
        readyOverlay.run(.fadeOut(withDuration: 0.15))
        scoreLabel.run(.fadeIn(withDuration: 0.15))
        // Spawn the first gate just off the right edge so there is a beat of
        // breathing room before the first real decision.
        distanceSinceGate = Tuning.gateSpacing - 120
        flap()
    }

    private func flap() {
        verticalVelocity = Tuning.flapVelocity
        haptics.impactOccurred(intensity: 0.55)
    }

    private func die(at time: TimeInterval) {
        guard state == .playing else { return }
        state = .gameOver
        diedAt = time

        if score > best {
            best = score
            UserDefaults.standard.set(best, forKey: "PitchFlap.best")
        }

        finalScoreLabel.text = "\(score)"
        finalBestLabel.text = "Best \(best)"
        gameOverOverlay.run(.sequence([.wait(forDuration: 0.35),
                                       .fadeIn(withDuration: 0.2)]))
        scoreLabel.run(.fadeOut(withDuration: 0.2))

        crashHaptic.notificationOccurred(.error)

        // White flash, then let the ball drop out of the world.
        let flash = SKSpriteNode(color: .white, size: size)
        flash.anchorPoint = .zero
        flash.zPosition = 110
        flash.alpha = 0.85
        addChild(flash)
        flash.run(.sequence([.fadeOut(withDuration: 0.28), .removeFromParent()]))

        ball.run(.rotate(byAngle: -.pi * 1.2, duration: 0.7))
    }

    // MARK: - Input

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        switch state {
        case .ready:
            startPlaying()
        case .playing:
            flap()
        case .gameOver:
            // Swallow taps briefly, or the tap that killed you also restarts.
            if CACurrentMediaTime() - diedAt > Tuning.restartLockout {
                resetToReady()
            }
        }
    }

    // MARK: - The game loop
    //
    // SpriteKit calls this once per rendered frame and hands us a timestamp,
    // not a step count. Everything below is expressed per *second* and then
    // multiplied by `dt`, so the game runs identically on a 60Hz iPhone SE and
    // a 120Hz ProMotion iPhone Pro.

    override func update(_ currentTime: TimeInterval) {
        if lastFrameTime == 0 { lastFrameTime = currentTime }
        let dt = min(CGFloat(currentTime - lastFrameTime), Tuning.maxTimeStep)
        lastFrameTime = currentTime
        elapsed += dt

        switch state {
        case .ready:
            stepReady(dt)
        case .playing:
            stepBall(dt)
            stepGates(dt)
            stepScenery(dt)
        case .gameOver:
            stepFalling(dt)
        }
    }

    private func stepReady(_ dt: CGFloat) {
        ball.position.y = size.height * 0.62
            + sin(elapsed * Tuning.readyBobSpeed) * Tuning.readyBobAmplitude
        stepScenery(dt * 0.4)
    }

    private func stepBall(_ dt: CGFloat) {
        // Semi-implicit Euler: update velocity first, then let the engine move
        // the body with it. Stable, cheap, and plenty accurate at 60Hz.
        verticalVelocity = max(verticalVelocity + Tuning.gravity * dt, Tuning.maxFallSpeed)

        // Ceiling: stop dead rather than bouncing, and keep x pinned. This has
        // to happen *before* the velocity reaches the body - hand the engine a
        // stale upward velocity and it pushes the ball back out of bounds on
        // the same frame we just clamped it.
        let ceiling = size.height - Tuning.ballRadius
        if ball.position.y > ceiling {
            ball.position.y = ceiling
            verticalVelocity = min(verticalVelocity, 0)
        }
        ball.position.x = ballX
        ball.physicsBody?.velocity = CGVector(dx: 0, dy: verticalVelocity)

        // Nose up when rising, tip forward when falling. Mapping speed onto
        // angle is what makes the ball look like it has weight.
        let t = max(-1, min(1, verticalVelocity / Tuning.flapVelocity))
        let target = t >= 0 ? t * 0.45 : t * 1.05
        ball.zRotation += (target - ball.zRotation) * min(1, 12 * dt)

        if ball.position.y - Tuning.ballRadius <= groundTop {
            die(at: CACurrentMediaTime())
        }
    }

    private func stepFalling(_ dt: CGFloat) {
        guard ball.position.y - Tuning.ballRadius > groundTop else {
            // Landed. Snap it flush to the grass so it doesn't sit half-buried.
            ball.position.y = groundTop + Tuning.ballRadius
            ball.physicsBody?.velocity = .zero
            verticalVelocity = 0
            return
        }
        verticalVelocity = max(verticalVelocity + Tuning.gravity * dt, Tuning.maxFallSpeed)
        ball.physicsBody?.velocity = CGVector(dx: 0, dy: verticalVelocity)
    }

    private func stepGates(_ dt: CGFloat) {
        let dx = scrollSpeed * dt

        distanceSinceGate += dx
        if distanceSinceGate >= Tuning.gateSpacing {
            distanceSinceGate -= Tuning.gateSpacing
            spawnGate()
        }

        for gate in gates {
            gate.position.x -= dx
        }
        // Recycle: anything fully past the left edge is gone for good.
        gates.removeAll { gate in
            if gate.position.x < -Tuning.postWidth {
                gate.removeFromParent()
                return true
            }
            return false
        }
    }

    private func stepScenery(_ dt: CGFloat) {
        let dx = scrollSpeed * dt
        for tile in groundTiles {
            tile.position.x -= dx
            if tile.position.x <= -size.width { tile.position.x += size.width * 2 }
        }
        for cloud in clouds {
            cloud.position.x -= dx * 0.18   // parallax: far things move slower
            if cloud.position.x < -cloud.size.width {
                cloud.position.x = size.width + cloud.size.width
                cloud.position.y = CGFloat.random(in: size.height * 0.55...size.height * 0.9)
            }
        }
    }

    // MARK: - Gates

    private func spawnGate() {
        let gap = currentGap
        let lowest = groundTop + gap / 2 + Tuning.gateVerticalMargin
        let highest = size.height - gap / 2 - Tuning.gateVerticalMargin
        guard highest > lowest else { return }
        let centre = CGFloat.random(in: lowest...highest)

        let gate = SKNode()
        gate.position = CGPoint(x: size.width + Tuning.postWidth, y: 0)
        gate.zPosition = 30

        let bottomHeight = centre - gap / 2 - groundTop
        let topHeight = size.height - (centre + gap / 2)

        gate.addChild(makePost(height: bottomHeight, y: groundTop, capOnTop: true))
        gate.addChild(makePost(height: topHeight, y: centre + gap / 2, capOnTop: false))

        // The scorer is an invisible strip filling the gap. Touching it is the
        // only thing that increments the score - no distance bookkeeping, no
        // "have I passed this one yet" flags to get wrong.
        let scorer = SKNode()
        scorer.position = CGPoint(x: 0, y: centre)
        scorer.physicsBody = SKPhysicsBody(rectangleOf: CGSize(width: 6, height: gap))
        scorer.physicsBody?.isDynamic = false
        scorer.physicsBody?.categoryBitMask = Category.scorer
        scorer.physicsBody?.contactTestBitMask = Category.ball
        scorer.physicsBody?.collisionBitMask = 0
        gate.addChild(scorer)

        addChild(gate)
        gates.append(gate)
    }

    private func makePost(height: CGFloat, y: CGFloat, capOnTop: Bool) -> SKNode {
        let post = SKNode()
        let w = Tuning.postWidth
        let h = max(height, 1)

        let shaft = SKSpriteNode(color: Palette.post, size: CGSize(width: w, height: h))
        shaft.anchorPoint = CGPoint(x: 0.5, y: 0)
        shaft.position = CGPoint(x: 0, y: y)
        post.addChild(shaft)

        let shade = SKSpriteNode(color: Palette.postShade, size: CGSize(width: w * 0.28, height: h))
        shade.anchorPoint = CGPoint(x: 0.5, y: 0)
        shade.position = CGPoint(x: w * 0.32, y: y)
        post.addChild(shade)

        // The lip at the mouth of the gap - purely cosmetic, but it is what
        // makes the gap read as a target instead of a hole.
        let cap = SKSpriteNode(color: Palette.postTrim, size: CGSize(width: w + 12, height: 16))
        cap.anchorPoint = CGPoint(x: 0.5, y: capOnTop ? 1 : 0)
        cap.position = CGPoint(x: 0, y: capOnTop ? y + h : y)
        post.addChild(cap)

        // One body for the whole post, sized to the visible shaft.
        let body = SKNode()
        body.position = CGPoint(x: 0, y: y + h / 2)
        body.physicsBody = SKPhysicsBody(rectangleOf: CGSize(width: w, height: h))
        body.physicsBody?.isDynamic = false
        body.physicsBody?.categoryBitMask = Category.obstacle
        body.physicsBody?.contactTestBitMask = Category.ball
        body.physicsBody?.collisionBitMask = 0
        post.addChild(body)

        return post
    }

    // MARK: - Contacts

    func didBegin(_ contact: SKPhysicsContact) {
        guard state == .playing else { return }
        let mask = contact.bodyA.categoryBitMask | contact.bodyB.categoryBitMask

        if (mask & Category.scorer) != 0 {
            score += 1
            updateScoreLabel()
            haptics.impactOccurred(intensity: 0.3)
            scoreLabel.run(.sequence([.scale(to: 1.18, duration: 0.07),
                                      .scale(to: 1.0, duration: 0.11)]))
        }

        if (mask & (Category.obstacle | Category.ground)) != 0 {
            die(at: CACurrentMediaTime())
        }
    }

    private func updateScoreLabel() {
        scoreLabel.text = "\(score)"
        (scoreLabel.childNode(withName: "shadow") as? SKLabelNode)?.text = "\(score)"
    }

    // MARK: - Small drawing helpers

    private static func pentagonPath(radius: CGFloat) -> CGPath {
        let path = CGMutablePath()
        for i in 0..<5 {
            let a = CGFloat(i) * (.pi * 2 / 5) + .pi / 2
            let p = CGPoint(x: cos(a) * radius, y: sin(a) * radius)
            if i == 0 { path.move(to: p) } else { path.addLine(to: p) }
        }
        path.closeSubpath()
        return path
    }

    private static func verticalGradient(from bottom: SKColor, to top: SKColor,
                                         size: CGSize) -> SKTexture {
        let renderer = UIGraphicsImageRenderer(size: size)
        let image = renderer.image { ctx in
            let colors = [bottom.cgColor, top.cgColor] as CFArray
            guard let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                                            colors: colors,
                                            locations: [0, 1]) else { return }
            ctx.cgContext.drawLinearGradient(
                gradient,
                start: CGPoint(x: 0, y: size.height),
                end: CGPoint(x: 0, y: 0),
                options: [])
        }
        return SKTexture(image: image)
    }
}
