import RegisterForm from "./RegisterForm"

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const params = await searchParams
  const initialRole = params?.role?.toUpperCase() ?? ""
  return <RegisterForm initialRole={initialRole} />
}

