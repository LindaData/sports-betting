import SwiftUI
import SpriteKit

/// SwiftUI owns the screen; SpriteKit owns the pixels inside it.
///
/// `SpriteView` is the bridge. It hosts an `SKScene` and drives the render
/// loop. Everything interesting happens in `GameScene`; this file exists to
/// hand SpriteKit a correctly sized rectangle and get out of the way.
struct GameView: View {

    // The scene is built once, lazily, after we know how big the screen is.
    // Rebuilding it on every SwiftUI redraw would restart the game constantly.
    @State private var scene: GameScene?

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Color.black
                if let scene {
                    SpriteView(scene: scene)
                }
            }
            .onAppear {
                guard scene == nil, proxy.size.width > 0 else { return }
                let created = GameScene(size: proxy.size)
                created.scaleMode = .resizeFill
                scene = created
            }
        }
        .ignoresSafeArea()
        .statusBarHidden(true)
        .persistentSystemOverlays(.hidden)
    }
}

#Preview {
    GameView()
}
