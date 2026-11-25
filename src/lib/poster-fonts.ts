import { readFile } from 'fs/promises'
import path from 'path'

// Session 39 (Feedback ec6e4adf follow-up) - next/og's ImageResponse
// (Satori under the hood) can't access system/OS fonts like the
// "Georgia, serif" used elsewhere on the site - it silently falls back
// to a generic sans-serif if no font is explicitly loaded and passed
// in. This is why the first poster design looked flat/generic instead
// of matching the site's actual editorial branding. Playfair Display
// (an open, freely-licensed serif with real display-weight character)
// stands in for Georgia here - same editorial spirit, and its .woff
// files ship in the @fontsource npm package, extracted once into
// public/fonts/ rather than keeping the whole package as a runtime
// dependency for 3 static files.
export async function loadPosterFonts() {
  const dir = path.join(process.cwd(), 'public', 'fonts')
  const [black, bold, regular] = await Promise.all([
    readFile(path.join(dir, 'PlayfairDisplay-Black.woff')),
    readFile(path.join(dir, 'PlayfairDisplay-Bold.woff')),
    readFile(path.join(dir, 'PlayfairDisplay-Regular.woff')),
  ])
  return [
    { name: 'Poster Serif', data: black, weight: 900 as const, style: 'normal' as const },
    { name: 'Poster Serif', data: bold, weight: 700 as const, style: 'normal' as const },
    { name: 'Poster Serif', data: regular, weight: 400 as const, style: 'normal' as const },
  ]
}
