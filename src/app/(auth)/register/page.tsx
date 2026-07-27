import { Suspense } from "react"
import RegisterForm from "./RegisterForm"
import BrandLoader from "@/components/BrandLoader"

export default function RegisterPage() {
  return (
    <Suspense fallback={<BrandLoader />}>
      <RegisterForm />
    </Suspense>
  )
}
