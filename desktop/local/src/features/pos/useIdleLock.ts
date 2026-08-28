import { useEffect, useRef, useState } from 'react'

export function useIdleLock(enabled: boolean, minutes = 10) {
  const [locked, setLocked] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  const schedule = (idleMs: number) => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => setLocked(true), idleMs)
  }

  const unlock = () => {
    setLocked(false)
    schedule(minutes * 60 * 1000)
  }

  useEffect(() => {
    if (!enabled) return
    const idleMs = minutes * 60 * 1000

    const reset = () => {
      schedule(idleMs)
    }

    reset()
    window.addEventListener('mousemove', reset)
    window.addEventListener('keydown', reset)
    window.addEventListener('click', reset)

    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
      window.removeEventListener('mousemove', reset)
      window.removeEventListener('keydown', reset)
      window.removeEventListener('click', reset)
    }
  }, [enabled, minutes])

  return { locked, unlock }
}
