import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { put } from '@vercel/blob'

// Feedback 36e97c82, Hitesh's decision (26 Jul, session 36): "build it
// properly via Vercel Blob or equivalent" - replacing the URL-paste-only
// Profile Picture field that had been in place since PR #179.
//
// Simple server-upload route (not the client-token flow) - profile
// pictures are small (few MB max), so there's no need for the added
// complexity of generating client upload tokens, which exists mainly for
// very large files or bypassing serverless body-size limits.
//
// REQUIRES a Vercel Blob store to be created and linked to this project
// (Vercel dashboard -> Storage -> Create -> Blob) - this populates
// BLOB_READ_WRITE_TOKEN automatically. Not something this code or Claude
// can provision from the sandbox; a manual one-time step for Hitesh.
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'File upload isn\'t configured on this environment yet - a Vercel Blob store needs to be created and linked to the project first.' },
      { status: 503 }
    )
  }

  const formData = await req.formData().catch(() => null)
  const file = formData?.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Please upload a JPEG, PNG, or WebP image.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'Image must be under 5MB.' }, { status: 400 })
  }

  const userId = (session.user as any).id
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'

  try {
    const blob = await put(`avatars/${userId}-${Date.now()}.${extension}`, file, {
      access: 'public',
      addRandomSuffix: true,
    })
    return NextResponse.json({ url: blob.url })
  } catch (err) {
    console.error('Avatar upload failed:', err)
    return NextResponse.json({ error: 'Upload failed - please try again.' }, { status: 500 })
  }
}
