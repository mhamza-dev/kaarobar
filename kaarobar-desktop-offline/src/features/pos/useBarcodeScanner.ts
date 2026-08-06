import { useEffect, useRef } from 'react'

type Options = {
  enabled: boolean
  onScan: (code: string) => void
  maxGapMs?: number
}

export function useBarcodeScanner({ enabled, onScan, maxGapMs = 50 }: Options) {
  const bufferRef = useRef('')
  const lastTimeRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    const handler = (event: KeyboardEvent) => {
      const now = Date.now()
      if (now - lastTimeRef.current > maxGapMs) {
        bufferRef.current = ''
      }
      lastTimeRef.current = now

      if (event.key === 'Enter' || event.key === 'Tab') {
        const code = bufferRef.current.trim()
        if (code.length >= 3) onScan(code)
        bufferRef.current = ''
        return
      }

      if (event.key.length === 1) {
        bufferRef.current += event.key
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled, maxGapMs, onScan])
}
