import { Suspense } from "react"
import RegisterForm from "./RegisterForm"
import BrandLoader from "@/components/BrandLoader"
import AuthLayout from "@/components/AuthLayout"

export default function RegisterPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<BrandLoader />}>
        <RegisterForm />
      </Suspense>
    </AuthLayout>
  )
}
