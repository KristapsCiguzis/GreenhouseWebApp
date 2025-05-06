"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { setupMockFetch } from "@/lib/mock-fetch-middleware"
import { StorageService } from "@/lib/storage-service"
import { useSession } from "next-auth/react"

interface DummyDeviceButtonProps {
  onDeviceAdded: (deviceId: string) => void
}

export default function DummyDeviceButton({ onDeviceAdded }: DummyDeviceButtonProps) {
  const { data: session } = useSession()
  const [adding, setAdding] = useState(false)
  const [cleanup, setCleanup] = useState<(() => void) | null>(null)
  useEffect(() => {
    return () => {
      if (cleanup) {
        cleanup()
      }
    }
  }, [cleanup])

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
      if (typeof window !== "undefined") {
        const cleanupFn = setupMockFetch()
        if (cleanupFn) {
          setCleanup(() => cleanupFn)
        }
      }

      const dummyDevice = await StorageService.createDevice({
        user_id: session.user.id,
        name: "Dummy ESP32",
        mac_address: "DUMMY-ESP32-MAC",
        ip_address: "192.168.1.200",
        is_favorite: false,
      })

      if (!dummyDevice) {
        throw new Error("Failed to create dummy device")
      }

      toast({
        title: "Success",
        description: "Dummy ESP32 device added successfully",
      })
      onDeviceAdded(dummyDevice.id)
    } catch (error: any) {
      console.error("Error adding dummy device:", error)

      if (error.code === "23505") {
        toast({
          title: "Device Already Exists",
          description: "A dummy device already exists in your account",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to add dummy device: " + (error.message || "Unknown error"),
          variant: "destructive",
        })
      }
      if (cleanup) {
        cleanup()
        setCleanup(null)
      }
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
