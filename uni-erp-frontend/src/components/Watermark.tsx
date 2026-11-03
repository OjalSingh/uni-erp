import { useEffect, useState } from 'react'

// Tiled institute watermark. Uses /branding/watermark.png (the AIECCE emblem) when it exists,
// otherwise a light text pattern so the printout is never plain.
const FALLBACK =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='90'><text x='60' y='50' text-anchor='middle' transform='rotate(-25 60 45)' font-family='serif' font-weight='700' font-size='15' fill='%231c4f9c'>A.I.E.C.C.E</text></svg>\")"

let cached: boolean | undefined
export default function Watermark({ className = '' }: { className?: string }) {
  const [hasImage, setHasImage] = useState(cached ?? false)
  useEffect(() => {
    if (cached !== undefined) return
    const img = new Image()
    img.onload = () => { cached = true; setHasImage(true) }
    img.onerror = () => { cached = false }
    img.src = '/branding/watermark.png'
  }, [])
  return (
    <div
      aria-hidden="true"
      className={`watermark ${className}`}
      style={{ backgroundImage: hasImage ? "url('/branding/watermark.png')" : FALLBACK }}
    />
  )
}
