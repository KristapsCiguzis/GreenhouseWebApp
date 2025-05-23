import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import GithubProvider from "next-auth/providers/github"
import { supabase } from "@/lib/supabase"

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
    GithubProvider({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login", 
  },
  debug: process.env.NODE_ENV === "development", 
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false

      try {
        const { data: existingUser, error: fetchError } = await supabase
          .from("profiles")
          .select("*")
          .eq("email", user.email)
          .single()

        if (fetchError && fetchError.code !== "PGRST116") {
          console.error("Error checking for existing user:", fetchError)
          return false
        }

        if (!existingUser) {
          const { error: insertError } = await supabase.from("profiles").insert([
            {
              user_id: user.id,
              email: user.email,
              name: user.name,
            },
          ])

          if (insertError) {
            console.error("Failed to create user profile:", insertError)
            return false
          }
        }

        return true
      } catch (error) {
        console.error("Something went wrong in signIn callback:", error)
        return false
      }
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
  },
})

export { handler as GET, handler as POST }
