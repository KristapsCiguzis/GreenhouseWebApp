import { createClient } from "@supabase/supabase-js"


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string


// const options = {
//   auth: {
//     autoRefreshToken: true,
//     persistSession: true,
//   }
// }

export const supabase = createClient(supabaseUrl, supabaseAnonKey)


export type Profile = {
  id: string
  user_id: string
  email: string
  name: string | null
  avatar_url: string | null
  created_at: string
}


export type Device = {
  id: string
  user_id: string
  name: string
  mac_address: string
  ip_address: string | null
  last_connected: string | null
  is_favorite: boolean
  created_at: string
  updated_at: string
}

export type ApiKey = {
  id: string
  user_id: string
  name: string
  key: string
  service: string
  created_at: string
}

export type Widget = {
  id: string
  user_id: string
  device_mac: string
  widget_type: string
  name: string
  pin: number | null
  sensor_type: string | null
  configuration: Record<string, any>
  position: { x: number; y: number }
  is_active: boolean
  created_at: string
  updated_at: string
}
