import { useEffect, useState } from 'react'
import { GameScreen } from './components/GameScreen'
import { ImageUploader } from './components/ImageUploader'
import { PuzzleSetup } from './components/PuzzleSetup'
import { setSoundEnabled } from './lib/audio'
import { getSettings, saveSettings, type Settings } from './lib/storage'
import type { SourceImage } from './lib/types'

type Screen = 'upload' | 'setup' | 'play'

export default function App() {
  const [screen, setScreen] = useState<Screen>('upload')
  const [image, setImage] = useState<SourceImage | null>(null)
  const [settings, setSettings] = useState<Settings>(getSettings)

  useEffect(() => {
    saveSettings(settings)
    setSoundEnabled(settings.sound)
  }, [settings])

  // Release the old preview object URL whenever the image is replaced.
  const replaceImage = (next: SourceImage | null) => {
    if (image && image !== next) URL.revokeObjectURL(image.previewUrl)
    setImage(next)
  }

  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }))

  if (screen === 'play' && image) {
    return (
      <GameScreen
        image={image}
        preset={settings.preset}
        rotation={settings.rotation}
        sound={settings.sound}
        onSound={(sound) => update({ sound })}
        onRotation={(rotation) => update({ rotation })}
        onNewImage={() => {
          replaceImage(null)
          setScreen('upload')
        }}
      />
    )
  }

  return (
    <div className="shell">
      {screen === 'setup' && image ? (
        <PuzzleSetup
          image={image}
          preset={settings.preset}
          rotation={settings.rotation}
          onPreset={(preset) => update({ preset })}
          onRotation={(rotation) => update({ rotation })}
          onStart={() => setScreen('play')}
          onChangeImage={() => {
            replaceImage(null)
            setScreen('upload')
          }}
        />
      ) : (
        <ImageUploader
          onImage={(img) => {
            replaceImage(img)
            setScreen('setup')
          }}
        />
      )}
    </div>
  )
}
