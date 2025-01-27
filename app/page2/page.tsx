import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"

export default async function Page2() {
  const session = await getServerSession()

  if (!session) {
    redirect("/login")
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold">Page 2</h1>
    </div>
  )
}

