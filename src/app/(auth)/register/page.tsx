import RegisterForm from "./RegisterForm"

export default function RegisterPage({ searchParams }: { searchParams: { role?: string } }) {
  const initialRole = searchParams?.role?.toUpperCase() ?? ""
  return <RegisterForm initialRole={initialRole} />
}

