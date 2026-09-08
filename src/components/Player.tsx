'use client'
import { useEffect, useRef } from 'react'

// Same [data-seconds] -> audio.currentTime seek convention as EpisodeBody's
// SEEK_SCRIPT (deliberately duplicated: this is a hydrated component, that is
// an inline script for the static episode document).
export function Player({ audioUrl, title }: { audioUrl?: string; title: string }) {
  const ref = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-seconds]')
      const audio = ref.current
      if (!target || !audio) return
      const seconds = Number(target.dataset.seconds)
      if (!Number.isFinite(seconds)) return
      event.preventDefault()
      audio.currentTime = seconds
      void audio.play()
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  if (!audioUrl) return null
  return (
    <div className="player" data-pagefind-ignore="">
      <audio ref={ref} controls preload="none" src={audioUrl} aria-label={`Play ${title}`} />
    </div>
  )
}
