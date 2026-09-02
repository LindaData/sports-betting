import SwiftUI

/// The whole app. `@main` marks the entry point - there is no AppDelegate,
/// no storyboard, no window setup. SwiftUI builds the window for you.
@main
struct PitchFlapApp: App {
    var body: some Scene {
        WindowGroup {
            GameView()
        }
    }
}
