import LaunchHoldingPage from "@/components/LaunchHoldingPage"
import AuthLayout from "@/components/AuthLayout"
import SignupsSoon from "@/app/(auth)/register/SignupsSoon"

// S1b-b1 - preview of the W1-closed screens without flipping the shared QA
// switch (specs run in parallel; W1 off would hold every public page for
// everyone). /dev/** is 404 on production (src/app/dev/layout.tsx).
//   /dev/launch-holding/               - the "opening soon" holding page
//   /dev/launch-holding/?view=signups  - /register's "sign-ups open soon"
export default async function LaunchHoldingPreview({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { view } = await searchParams
  if (view === "signups") {
    return (
      <AuthLayout compact>
        <SignupsSoon />
      </AuthLayout>
    )
  }
  return <LaunchHoldingPage />
}
