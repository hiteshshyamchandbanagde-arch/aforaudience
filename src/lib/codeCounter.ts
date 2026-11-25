import prisma from '@/lib/prisma'

// Generates human-readable sequential IDs like "BUG-2608-001" on top of
// the CodeCounter model (prefix + yearMonth + currentSeq). The model
// existed in the schema already (used for org codes like
// ORG2608000058) but had no shared helper - this is that helper,
// written for Feedback.displayId (session 63 workflow overhaul) but
// generic enough to reuse anywhere else that wants a per-prefix,
// per-month sequence instead of a raw cuid.
//
// Atomic via Prisma's upsert + increment - safe under concurrent
// requests hitting the same (prefix, yearMonth) pair.
export async function nextSequentialCode(prefix: string): Promise<string> {
  const now = new Date()
  const yearMonth = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`

  const counter = await prisma.codeCounter.upsert({
    where: { prefix_yearMonth: { prefix, yearMonth } },
    create: { prefix, yearMonth, currentSeq: 1 },
    update: { currentSeq: { increment: 1 } },
  })

  return `${prefix}-${yearMonth}-${String(counter.currentSeq).padStart(3, '0')}`
}
