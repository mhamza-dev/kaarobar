import { useState } from 'react'
import { cn } from '../../lib/cn'
import { assetSrc } from '../../lib/assets'

type Props = {
  path: string | null | undefined
  alt?: string
  className?: string
}

/** Renders a Kaarobar asset image; hides itself if the file fails to load. */
export function AssetImage({ path, alt = '', className }: Props) {
  const [failed, setFailed] = useState(false)
  const src = assetSrc(path)
  if (!src || failed) return null
  return (
    <img
      src={src}
      alt={alt}
      className={cn(className)}
      onError={() => setFailed(true)}
    />
  )
}
