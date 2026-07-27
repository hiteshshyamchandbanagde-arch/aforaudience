// Single source of truth for the preset genre list - shared between
// GenrePicker (client UI) and the genre-moderation API routes (server),
// so the two never drift apart. Grounded in this platform's real acts
// (comedy, poetry, storytelling, spoken word, music, dance, etc.), not a
// generic taxonomy - see PR #219 for how this list was chosen.
export const PRESET_GENRES = [
  'Stand-up Comedy',
  'Poetry',
  'Storytelling',
  'Spoken Word',
  'Music - Acoustic',
  'Singing',
  'Rap / Hip-Hop',
  'Dance',
  'Theatre / Drama',
  'Improv',
  'Magic',
]
