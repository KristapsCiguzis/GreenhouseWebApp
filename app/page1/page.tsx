import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"

export default async function Page1() {
  const session = await getServerSession()

  if (!session) {
    redirect("/login")
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold">Page 1</h1>
    </div>
  )
}

