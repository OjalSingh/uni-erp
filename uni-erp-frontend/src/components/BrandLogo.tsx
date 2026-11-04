import { useState } from 'react'

// A logo from public/branding. If the file is missing the spot is simply left empty.
export default function BrandLogo({ src, className = '' }: { src: string; className?: string }) {
  const [ok, setOk] = useState(true)
  return ok ? <img className={className} src={src} alt="" onError={() => setOk(false)} /> : <span className={className} />
}
