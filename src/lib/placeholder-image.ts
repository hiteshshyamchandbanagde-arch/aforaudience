// FEAT-2608-044 follow-up (11 Aug) - the venue/artist photo-card redesign
// surfaced that most QA seed "photos" aren't real: 1118/1132 approved
// venues have a picsum.photos random-seed stock image (a Pune convention
// centre rendering as a New York taxi street or a desert highway), and
// 100/401 artists have their avatar set to a GitHub avatars URL (dev/test
// filler, not a photo of the artist - confirmed live by Hitesh: Sai
// Jain's "portrait" was literally the GitHub mascot). This was invisible
// at the old small/no-photo treatment and became actively misleading
// once promoted to a full card photograph - same category of problem as
// GEN-2608-035 (AI-watermarked hero video, mismatched hero stills).
//
// Rather than deleting/touching seed data (out of scope, and QA seed
// data is intentionally excluded from destructive review), treat known
// placeholder domains as "no photo" at render time so they fall back to
// the grain-textured monogram card instead of standing in as if genuine.
// Add further domains here if more placeholder sources turn up.
const PLACEHOLDER_IMAGE_HOST_FRAGMENTS = ["picsum.photos", "avatars.githubusercontent.com"]

export function isPlaceholderImageUrl(url: string | null | undefined): boolean {
  if (!url) return false
  return PLACEHOLDER_IMAGE_HOST_FRAGMENTS.some((fragment) => url.includes(fragment))
}
