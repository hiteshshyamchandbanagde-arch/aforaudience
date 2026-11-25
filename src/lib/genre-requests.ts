import prisma from '@/lib/prisma'
import { PRESET_GENRES } from '@/lib/genres'

// Session 39 (PR #224) - called from both POST /api/artists/apply and
// PATCH /api/artists/me whenever genre is being written. For every value
// that isn't one of the preset genres, upsert a PENDING GenreRequest if
// one doesn't already exist (unique on `value`, so repeated submissions
// of the same string across many artists don't spam duplicate rows).
// Never blocks or throws - this is a fire-and-forget side effect, not a
// gate on saving the artist's own profile.
export async function logNewGenreRequests(genres: string[]) {
  const newOnes = genres.filter((g) => g && !PRESET_GENRES.includes(g))
  if (newOnes.length === 0) return
  for (const value of newOnes) {
    try {
      await prisma.genreRequest.upsert({
        where: { value },
        update: {},
        create: { value, status: 'PENDING' },
      })
    } catch {
      // Best-effort - a submission race or unexpected constraint issue
      // here should never block the artist's actual profile save.
    }
  }
}
