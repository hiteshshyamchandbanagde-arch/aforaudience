"use client"

import Link from "next/link"
import { signOut, useSession } from "next-auth/react"

export default function UserHeader() {
  const { data: session } = useSession()
  const name = session?.user?.name || session?.user?.email || "Guest"
  const userName = name.split(" ")[0]
  const role = (session?.user as any)?.role as string | undefined

  return (
    <header className="w-full sticky top-0 z-50 px-4 py-4 sm:px-10 bg-[#F7F3EE] border-b border-[rgba(14,12,10,0.08)]">
      <div className="mx-auto flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="font-serif text-[22px] font-bold text-[#0E0C0A] no-underline">
          <span className="text-[#C8441A]">A</span>forAudience
        </Link>

        {session?.user ? (
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex flex-col items-start gap-1 text-left sm:items-end">
              <span className="text-sm text-[#0E0C0A]">Hi, {userName}</span>
              {role && (
                <span className="text-[11px] text-[#4A5568] bg-[#F7E9E5] px-2 py-1 rounded-full capitalize">
                  {role.toLowerCase().replace("_", " ")}
                </span>
              )}
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded-[8px] bg-[#C8441A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#a63716]"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/login" className="text-sm font-semibold text-[#0E0C0A] no-underline">
              Sign in
            </Link>
            <Link href="/register" className="rounded-[8px] bg-[#C8441A] px-4 py-2 text-sm font-semibold text-white no-underline text-center">
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
