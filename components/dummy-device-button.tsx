"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PlusCircle, Loader2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"
import { useSession } from "next-auth/react"
import { setupMockFetch } from "@/lib/mock-fetch-middleware"

interface DummyDeviceButtonProps {
  onDeviceAdded: (deviceId: string) => void
}

export default function DummyDeviceButton({ onDeviceAdded }: DummyDeviceButtonProps) {
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)

  const addDummyDevice = async () => {
    if (!session?.user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to add a device",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      console.log("Setting up mock fetch middleware for dummy device")
      setupMockFetch()

      localStorage.removeItem("manualDisconnect")
      const { data: existingDevices, error: fetchError } = await supabase
        .from("devices")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("ip_address", "192.168.1.200")
        .limit(1)

      if (fetchError) throw fetchError

      let deviceId

      if (existingDevices && existingDevices.length > 0) {
        deviceId = existingDevices[0].id
        console.log("Dummy device already exists, using existing device:", deviceId)
        const { error: updateError } = await supabase
          .from("devices")
          .update({
            last_connected: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", deviceId)

        if (updateError) throw updateError
      } else {
        const macAddress = `DUMMY-${Math.random().toString(16).substring(2, 8).toUpperCase()}`

        const { data, error } = await supabase
          .from("devices")
          .insert([
            {
              user_id: session.user.id,
              name: "Dummy ESP32",
              mac_address: macAddress,
              ip_address: "192.168.1.200",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              last_connected: new Date().toISOString(),
            },
          ])
          .select()

        if (error) throw error
        if (!data || data.length === 0) {
          throw new Error("Failed to create dummy device")
        }

        deviceId = data[0].id
        console.log("Created new dummy device:", deviceId)
      }

      onDeviceAdded(deviceId)

      toast({
        title: "Success",
        description: "Dummy device added and connected successfully",
      })
    } catch (error: any) {
      console.error("Error adding dummy device:", error)
      toast({
        title: "Error",
        description: `Failed to add dummy device: ${error.message || "Unknown error"}`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={addDummyDevice} disabled={isLoading}>
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Adding...
        </>
      ) : (
        <>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Dummy Device
        </>
      )}
    </Button>
  )
}
