"use client"

import { useEffect, useState } from "react"
import { type EventItem } from "@/components/EventCard"

export const ROTATE_MS = 9000
const DEFAULT_MAX_PHOTOS = 6

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const onChange = () => setReduced(mq.matches)
    onChange()
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  return reduced
}

/**
 * Shared crossfading-photo-hero data/rotation logic - originally built for
 * the homepage Hero (design.md "Four rooms, one house", 17 Aug), extracted
 * for GEN-2608-072 so the Artist landing page's hero reuses the exact same
 * fetch/rotate/pause/reduced-motion behavior instead of a parallel copy.
 * Same /api/events call + "still showing tonight" cutoff the homepage's
 * "Happening Soon" bento section also uses.
 */
export function usePhotoRotation(maxPhotos: number = DEFAULT_MAX_PHOTOS) {
  const reduced = usePrefersReducedMotion()
  const [photos, setPhotos] = useState<{ src: string; alt: string }[]>([])
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    fetch("/api/events")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: EventItem[]) => {
        const now = Date.now() - 24 * 60 * 60 * 1000
        const upcoming = data
          .filter((e) => e.posterImage && new Date(e.date).getTime() >= now)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .slice(0, maxPhotos)
        setPhotos(upcoming.map((e) => ({ src: e.posterImage as string, alt: e.title })))
      })
      .catch(() => {})
  }, [maxPhotos])

  useEffect(() => {
    if (reduced || paused || photos.length < 2) return
    const id = setInterval(() => setActive((a) => (a + 1) % photos.length), ROTATE_MS)
    return () => clearInterval(id)
  }, [reduced, paused, photos.length])

  return { photos, active, setActive, paused, setPaused, reduced }
}
