import "./globals.css"
import { Inter } from "next/font/google"
import Navbar from "./components/Navbar"
import { getServerSession } from "next-auth/next"
import SessionProvider from "./components/SessionProvider"

const inter = Inter({ subsets: ["latin"] })

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession()

  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider session={session}>
          {session && <Navbar />}
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}

