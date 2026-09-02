import CoreGraphics

/// Every number that decides how the game *feels* lives here.
///
/// Units are explicit on purpose:
///   - distances are in points (a point is ~1/3 of a mm on a modern iPhone)
///   - velocities are points per second
///   - accelerations are points per second squared
///
/// Nothing in this file is sacred. Changing one value and replaying is the
/// fastest way to learn what each system actually controls.
enum Tuning {

    // MARK: - Vertical motion (the "flap")

    /// Downward acceleration applied every frame. More negative = heavier ball.
    static let gravity: CGFloat = -2400

    /// A tap *replaces* the ball's vertical speed with this value.
    /// (Replacing rather than adding is what makes the classic arc feel crisp
    /// and repeatable: every tap from any state produces the same hop.)
    static let flapVelocity: CGFloat = 700

    /// Terminal velocity, so a long fall stays readable instead of blurring.
    static let maxFallSpeed: CGFloat = -1500

    /// Apex height of a single flap = flapVelocity^2 / (2 * |gravity|)
    /// = 700^2 / 4800 ≈ 102 points. Keep that in mind when sizing the gap.

    // MARK: - Horizontal motion (the world scrolling past)

    static let baseScrollSpeed: CGFloat = 200
    static let scrollSpeedPerPoint: CGFloat = 3.5
    static let maxScrollSpeed: CGFloat = 370

    // MARK: - Goal gates (the "pipes")

    /// Horizontal distance between one gate and the next.
    static let gateSpacing: CGFloat = 260
    static let postWidth: CGFloat = 76
    static let startingGap: CGFloat = 235
    static let minimumGap: CGFloat = 155
    static let gapShrinkPerPoint: CGFloat = 3

    /// Keep gate centres away from the very top and the grass.
    static let gateVerticalMargin: CGFloat = 70

    // MARK: - The ball

    static let ballRadius: CGFloat = 17
    /// Ball sits this fraction across the screen. 0 = left edge, 1 = right edge.
    static let ballScreenFraction: CGFloat = 0.30
    /// Bob animation shown on the "ready" screen.
    static let readyBobAmplitude: CGFloat = 9
    static let readyBobSpeed: CGFloat = 3.4

    // MARK: - Pitch

    static let groundHeight: CGFloat = 110

    // MARK: - Feel

    /// Ignore taps for this long after dying, so the death tap doesn't restart.
    static let restartLockout: TimeInterval = 0.65
    /// Largest frame step we will simulate. Protects the physics if the app
    /// stalls (a breakpoint, a phone call) and `dt` suddenly becomes huge.
    static let maxTimeStep: CGFloat = 1.0 / 30.0
}
