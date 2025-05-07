import { supabase } from "@/lib/supabase"
import type { Device, ApiKey, Widget, Profile } from "@/lib/supabase"

export class StorageService {
  static async getDevices(userId: string): Promise<Device[]> {
    try {
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .eq("user_id", userId)
        .order("is_favorite", { ascending: false })
        .order("created_at", { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error("Error fetching devices:", error)
      return []
    }
  }

  static async getDevice(userId: string, deviceId: string): Promise<Device | null> {
    try {
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .eq("user_id", userId)
        .eq("id", deviceId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error("Error fetching device:", error)
      return null
    }
  }

  static async createDevice(device: Partial<Device>): Promise<Device | null> {
    try {
      console.log("Creating device with data:", device)

      // Ensure we have created_at and updated_at fields
      const deviceWithTimestamps = {
        ...device,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase.from("devices").insert([deviceWithTimestamps]).select()

      if (error) {
        console.error("Supabase error creating device:", error)
        throw error
      }

      if (!data || data.length === 0) {
        throw new Error("No data returned from device creation")
      }

      console.log("Device created successfully:", data[0])
      return data[0]
    } catch (error) {
      console.error("Error creating device:", error)
      throw error // Re-throw to allow proper error handling in the component
    }
  }

  static async updateDevice(deviceId: string, updates: Partial<Device>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("devices")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", deviceId)

      if (error) throw error
      return true
    } catch (error) {
      console.error("Error updating device:", error)
      return false
    }
  }

  static async deleteDevice(deviceId: string): Promise<boolean> {
    try {
      const { error } = await supabase.from("devices").delete().eq("id", deviceId)

      if (error) throw error
      return true
    } catch (error) {
      console.error("Error deleting device:", error)
      return false
    }
  }

  static async updateDeviceConnection(deviceId: string, macAddress?: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("devices")
        .update({
          last_connected: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(macAddress ? { mac_address: macAddress } : {}),
        })
        .eq("id", deviceId)

      if (error) throw error
      return true
    } catch (error) {
      console.error("Error updating device connection:", error)
      return false
    }
  }

  // API KEY OPERATIONS

  static async getApiKeyForDevice(userId: string, deviceMac: string): Promise<ApiKey | null> {
    try {
      const { data, error } = await supabase
        .from("api_keys")
        .select("*")
        .eq("user_id", userId)
        .eq("device_mac", deviceMac)
        .eq("service", "amazon")
        .single()

      if (error && error.code !== "PGRST116") throw error
      return data || null
    } catch (error) {
      console.error("Error fetching API key for device:", error)
      return null
    }
  }

  static async saveApiKeyForDevice(userId: string, deviceMac: string, key: string): Promise<ApiKey | null> {
    try {
      const existingKey = await this.getApiKeyForDevice(userId, deviceMac)

      if (existingKey) {
        const { data, error } = await supabase
          .from("api_keys")
          .update({
            key: key,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingKey.id)
          .select()

        if (error) throw error
        return data?.[0] || null
      } else {
        // Create new key
        const { data, error } = await supabase
          .from("api_keys")
          .insert([
            {
              user_id: userId,
              device_mac: deviceMac,
              name: `API Key for ${deviceMac}`,
              key: key,
              service: "amazon",
            },
          ])
          .select()

        if (error) throw error
        return data?.[0] || null
      }
    } catch (error) {
      console.error("Error saving API key for device:", error)
      return null
    }
  }

  static async deleteApiKey(keyId: string): Promise<boolean> {
    try {
      const { error } = await supabase.from("api_keys").delete().eq("id", keyId)

      if (error) throw error
      return true
    } catch (error) {
      console.error("Error deleting API key:", error)
      return false
    }
  }

  // WIDGET stuffff

  static async getWidgetsForDevice(userId: string, deviceMac: string): Promise<Widget[]> {
    try {
      const { data, error } = await supabase
        .from("widgets")
        .select("*")
        .eq("user_id", userId)
        .eq("device_mac", deviceMac)
        .order("created_at", { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error("Error fetching widgets:", error)
      return []
    }
  }

  static async createWidget(widget: Partial<Widget>): Promise<Widget | null> {
    try {
      const { data, error } = await supabase.from("widgets").insert([widget]).select()

      if (error) throw error
      return data?.[0] || null
    } catch (error) {
      console.error("Error creating widget:", error)
      return null
    }
  }

  static async updateWidget(widgetId: string, updates: Partial<Widget>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("widgets")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", widgetId)

      if (error) throw error
      return true
    } catch (error) {
      console.error("Error updating widget:", error)
      return false
    }
  }

  static async deleteWidget(widgetId: string): Promise<boolean> {
    try {
      const { error } = await supabase.from("widgets").delete().eq("id", widgetId)

      if (error) throw error
      return true
    } catch (error) {
      console.error("Error deleting widget:", error)
      return false
    }
  }

  static async updateWidgetConfiguration(widgetId: string, configuration: Record<string, any>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("widgets")
        .update({
          configuration: configuration,
          updated_at: new Date().toISOString(),
        })
        .eq("id", widgetId)

      if (error) throw error
      return true
    } catch (error) {
      console.error("Error updating widget configuration:", error)
      return false
    }
  }

  // USER stufff

  static async getUserProfile(userId: string): Promise<Profile | null> {
    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).single()

      if (error) throw error
      return data
    } catch (error) {
      console.error("Error fetching user profile:", error)
      return null
    }
  }

  static async updateUserProfile(userId: string, updates: Partial<Profile>): Promise<boolean> {
    try {
      const { error } = await supabase.from("profiles").update(updates).eq("user_id", userId)

      if (error) throw error
      return true
    } catch (error) {
      console.error("Error updating user profile:", error)
      return false
    }
  }
}
