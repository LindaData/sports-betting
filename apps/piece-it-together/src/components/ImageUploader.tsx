import { useRef, useState, type DragEvent } from 'react'
import { createSampleImage, ImageLoadError, loadImageFile } from '../lib/image'
import type { SourceImage } from '../lib/types'
import { Icon } from './Icon'

interface Props {
  onImage: (image: SourceImage) => void
}

export function ImageUploader({ onImage }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const handle = async (load: () => Promise<SourceImage>) => {
    setBusy(true)
    setError(null)
    try {
      onImage(await load())
    } catch (err) {
      setError(err instanceof ImageLoadError ? err.message : 'Something went wrong reading that image. Try another one.')
    } finally {
      setBusy(false)
    }
  }

  const onFiles = (files: FileList | null) => {
    const file = files?.[0]
    if (file) void handle(() => loadImageFile(file))
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    onFiles(e.dataTransfer.files)
  }

  return (
    <section className="screen uploader">
      <div className="hero">
        <div className="hero-mark" aria-hidden="true">
          <Icon name="puzzle" size={34} />
        </div>
        <h1>Piece It Together</h1>
        <p className="lead">Turn any photo into a jigsaw puzzle — right here in your browser.</p>
      </div>

      <div
        className={`dropzone card${dragOver ? ' is-over' : ''}${busy ? ' is-busy' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {busy ? (
          <div className="busy">
            <span className="spinner" aria-hidden="true" />
            <span>Preparing your photo…</span>
          </div>
        ) : (
          <>
            <Icon name="image" size={44} />
            <button type="button" className="btn btn-primary btn-lg" onClick={() => inputRef.current?.click()}>
              <Icon name="upload" size={20} />
              Choose a photo
            </button>
            <p className="muted small dz-desktop">or drop an image here · JPG, PNG, WEBP</p>
            <p className="muted small dz-mobile">JPG, PNG or WEBP from your camera roll</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          className="visually-hidden"
          aria-label="Choose a photo"
          data-testid="file-input"
          onChange={(e) => {
            onFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void handle(createSampleImage)}>
        <Icon name="sparkle" size={18} />
        No photo handy? Try a sample
      </button>

      <p className="privacy muted small">🔒 Your photo never leaves this device. No uploads, no accounts.</p>
    </section>
  )
}
