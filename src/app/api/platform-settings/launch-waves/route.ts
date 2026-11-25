import { NextResponse } from 'next/server'
import { getLaunchWaves } from '@/lib/platform-settings'

// S1b-a (9 Nov) - public, read-only UX hint for S1b-b (holding page,
// disabled CTAs): { W1, W2, W3, W4 } booleans. Not the enforcement - every
// gated route checks the switch itself via launchWaveBlock().
export async function GET() {
  return NextResponse.json(await getLaunchWaves())
}
