import "next-auth"

// Extend the built-in session types
// TODO: Add more user fields as needed
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      // Might add these later:
      // role?: string
      // permissions?: string[]
    }
  }
}
