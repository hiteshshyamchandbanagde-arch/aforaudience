import { Suspense } from "react"
import RegisterForm from "./RegisterForm"
import SignupsSoon from "./SignupsSoon"
import BrandLoader from "@/components/BrandLoader"
import AuthLayout from "@/components/AuthLayout"
import { signupsClosedForViewer } from "@/lib/launch-waves.server"

// S1b-b1 - while launch wave W1 is closed, non-admins get "New sign-ups
// open soon" instead of the form (the register API refuses anyway).
export default async function RegisterPage() {
  const closed = await signupsClosedForViewer()
  return (
    <AuthLayout compact>
      {closed ? (
        <SignupsSoon />
      ) : (
        <Suspense fallback={<BrandLoader />}>
          <RegisterForm />
        </Suspense>
      )}
    </AuthLayout>
  )
}
