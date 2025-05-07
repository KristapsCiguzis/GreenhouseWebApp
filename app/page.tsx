// app/page.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { signOut } from "next-auth/react"
import DeviceManager from "@/components/device-manager"
import WidgetManager from "@/components/widgets/widget-manager"
import { supabase } from "@/lib/supabase"
import DatabaseConnectionManager from "@/components/database-connection-manager"
import { MockESP32Api } from "@/lib/mock-esp32-api"
import { setupMockFetch } from "@/lib/mock-fetch-middleware"

interface Device {
  id: string
  user_id: string
  name: string
  ip_address: string
}

function ESP32Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [currentTab, setActiveTab] = useState<string>("widgets") // Changed default tab to widgets
  const [connectedDeviceIds, setConnectedDeviceIds] = useState<Set<string>>(new Set())
  const [connectedDevices, setConnectedDevices] = useState<Map<string, any>>(new Map())
  const [hasConnections, setHasConnections] = useState<boolean>(false)
  const [reconnecting, setIsReconnecting] = useState<boolean>(false)
  const [showSettings, setShowSettings] = useState<boolean>(false)
  const [manualDisconnect, setManualDisconnect] = useState<boolean>(false)
  const initialLoadRef = useRef(true)
  const [devices, setDevices] = useState<Device[]>([])
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    if (status === "authenticated" && initialLoadRef.current) {
      initialLoadRef.current = false

      try {
        const storedDevices = localStorage.getItem("connectedDevices")
        if (storedDevices) {
          const parsedDevices = JSON.parse(storedDevices)
          if (Array.isArray(parsedDevices) && parsedDevices.length > 0) {
            setConnectedDeviceIds(new Set(parsedDevices))
            setHasConnections(true)
            console.log("Loaded connected devices from localStorage:", parsedDevices)
          }
        }

        // Check if there was a manual disconnect
        const wasManualDisconnect = localStorage.getItem("manualDisconnect") === "true"
        setManualDisconnect(wasManualDisconnect)
      } catch (error) {
        console.error("Error loading connected devices from localStorage:", error)
      }
    }
  }, [status])

  useEffect(() => {
    if (initialLoadRef.current) return

    if (connectedDeviceIds.size > 0) {
      const deviceArray = Array.from(connectedDeviceIds)
      localStorage.setItem("connectedDevices", JSON.stringify(deviceArray))
      console.log("Saved connected devices to localStorage:", deviceArray)
    } else {
      localStorage.removeItem("connectedDevices")
      setConnectedDevices(new Map())
    }
  }, [connectedDeviceIds])

  useEffect(() => {
    const fetchConnectedDevices = async () => {
      if (!session?.user?.id || connectedDeviceIds.size === 0) {
        setConnectedDevices(new Map())
        return
      }

      const newConnectedDevices = new Map()
      for (const deviceId of connectedDeviceIds) {
        try {
          const { count, error: countError } = await supabase
            .from("devices")
            .select("*", { count: "exact", head: true })
            .eq("id", deviceId)
            .eq("user_id", session.user.id)

          if (countError) {
            console.error("Error checking device existence:", countError.message)
            continue
          }

          if (count === 0) {
            console.log("Device no longer exists")
            handleDeviceConnect(deviceId, "disconnect")
            continue
          }
          const { data, error } = await supabase
            .from("devices")
            .select("*")
            .eq("id", deviceId)
            .eq("user_id", session.user.id)
            .single()

          if (error) {
            console.error("Error fetching connected device:", error.message)
            continue
          }

          newConnectedDevices.set(deviceId, data)
        } catch (error: any) {
          console.error("Ugh, something went wrong:", error?.message || "Unknown error")
        }
      }

      setConnectedDevices(newConnectedDevices)
    }

    fetchConnectedDevices()
  }, [connectedDeviceIds, session?.user?.id])

  useEffect(() => {
    if (typeof window === "undefined") return

    const handleBeforeUnload = () => {
      if (connectedDeviceIds.size > 0) {
        const deviceArray = Array.from(connectedDeviceIds)
        localStorage.setItem("connectedDevices", JSON.stringify(deviceArray))
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [connectedDeviceIds])

  useEffect(() => {
    const mockApi = MockESP32Api.getInstance()

    if (typeof window !== "undefined") {
      const cleanup = setupMockFetch()
      if (cleanup) {
        cleanupRef.current = cleanup
      }
    }

    return () => {
      mockApi.cleanup()
      if (cleanupRef.current) {
        cleanupRef.current()
      }
    }
  }, [])

  useEffect(() => {
    const fetchAllDevices = async () => {
      if (!session?.user?.id) return

      try {
        const { data, error } = await supabase.from("devices").select("*").eq("user_id", session.user.id)

        if (error) throw error
        setDevices(data || [])
      } catch (error) {
        console.error("Error fetching devices:", error)
      }
    }

    fetchAllDevices()
  }, [session?.user?.id])

  const handleDeviceConnect = (deviceId: string | null, action: "connect" | "disconnect") => {
    if (!deviceId) return

    const newConnectedIds = new Set(connectedDeviceIds)

    if (action === "connect") {
      newConnectedIds.add(deviceId)
      // Always clear manual disconnect flag when connecting to any device
      localStorage.removeItem("manualDisconnect")
      setManualDisconnect(false)

      // If this is the dummy device, ensure the mock fetch middleware is set up
      const dummyDevice = devices.find((d) => d.id === deviceId && d.ip_address === "192.168.1.200")
      if (dummyDevice) {
        console.log("Setting up mock fetch for dummy device in handleDeviceConnect")
        setupMockFetch()
      }
    } else {
      newConnectedIds.delete(deviceId)
    }

    setConnectedDeviceIds(newConnectedIds)
    setHasConnections(newConnectedIds.size > 0)
    localStorage.setItem("connectedDevices", JSON.stringify(Array.from(newConnectedIds)))
  }

  if (status === "loading" || status === "unauthenticated") {
    return null
  }

  const esp32Devices = Array.from(connectedDevices.values())
    .filter((device) => device?.ip_address)
    .map((device) => device.ip_address)

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">GreenhouseWebApp</h1>
        <div className="flex items-center gap-4">
          {session?.user?.name && (
            <span className="text-sm text-muted-foreground">Signed in as {session.user.name}</span>
          )}
          <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="widgets">Widgets</TabsTrigger>
          <TabsTrigger value="database">Database Connections</TabsTrigger>
        </TabsList>

        <TabsContent value="devices">
          <DeviceManager
            onDeviceConnect={handleDeviceConnect}
            connectedDeviceIds={connectedDeviceIds}
            hasConnections={hasConnections}
            isReconnecting={reconnecting}
            setManualDisconnect={setManualDisconnect}
          />
        </TabsContent>

        <TabsContent value="widgets">
          <WidgetManager connectedDeviceIds={connectedDeviceIds} />
        </TabsContent>

        <TabsContent value="database">
          <DatabaseConnectionManager esp32Devices={esp32Devices} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ESP32Dashboard
