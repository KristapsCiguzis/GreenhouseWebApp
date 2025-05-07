"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { setupMockFetch } from "@/lib/mock-fetch-middleware"
import { useSession } from "next-auth/react"
import { StorageService } from "@/lib/storage-service"

interface DummyDeviceButtonProps {
  onDeviceAdded: (deviceId: string) => void
}

export default function DummyDeviceButton({ onDeviceAdded }: DummyDeviceButtonProps) {
  const { data: session } = useSession()
  const [adding, setAdding] = useState(false)

  const addDummyDevice = async () => {
    if (!session?.user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to add a device",
        variant: "destructive",
      })
      return
    }

    setAdding(true)

    try {
      console.log("Setting up mock fetch...")
      if (typeof window !== "undefined") {
        setupMockFetch()
      }

      console.log("Creating dummy device...")
      const uniqueMac = `DUMMY-ESP32-${Date.now().toString(16)}`

      const dummyDevice = await StorageService.createDevice({
        user_id: session.user.id,
        name: "Dummy ESP32",
        mac_address: uniqueMac,
        ip_address: "192.168.1.200", 
        is_favorite: false,
      })

      console.log("Dummy device created:", dummyDevice)

      if (!dummyDevice) {
        throw new Error("Failed to create dummy device - no device returned")
      }

      toast({
        title: "Success",
        description: "Dummy ESP32 device added successfully",
      })

      onDeviceAdded(dummyDevice.id)
    } catch (error: any) {
      console.error("Error adding dummy device:", error)

      let errorMessage = "Unknown error"

      if (error && error.message) {
        errorMessage = error.message
      } else if (error && error.code === "23505") {
        errorMessage = "A dummy device already exists in your account"
      } else if (error && typeof error === "object") {
        errorMessage = JSON.stringify(error)
      }

      toast({
        title: "Error",
        description: "Failed to add dummy device: " + errorMessage,
        variant: "destructive",
      })
    } finally {
      setAdding(false)
    }
  }

  return (
    <Button variant="default" size="sm" onClick={addDummyDevice} disabled={adding}>
      {adding ? "Adding..." : "Add Dummy Device"}
    </Button>
  )
}
