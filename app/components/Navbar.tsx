"use client"

import Link from "next/link"
import { useSession, signOut } from "next-auth/react"

export default function Navbar() {
  const { data: session } = useSession()

  return (
    <nav className="bg-gray-800 p-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="text-white font-bold text-xl">My App</div>
        {session && (
          <div className="flex items-center">
            <Link href="/" className="text-white mr-4 hover:text-gray-300">
              Home
            </Link>
            <Link href="/page1" className="text-white mr-4 hover:text-gray-300">
              Page 1
            </Link>
            <Link href="/page2" className="text-white mr-4 hover:text-gray-300">
              Page 2
            </Link>
            <button
              onClick={() => signOut()}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}

