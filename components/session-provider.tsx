"use client"

import type React from "react"
import { SessionProvider } from "next-auth/react"

// This is a simple wrapper around SessionProvider
// Maybe add some context or state here later?
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  // Could add some auth state management here in the future
  return <SessionProvider>{children}</SessionProvider>
}
