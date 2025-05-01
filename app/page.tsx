"use client"

import { useState, useEffect } from "react"
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

function ESP32Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [currentTab, setActiveTab] = useState<string>("devices")
  const [connectedDeviceIds, setConnectedDeviceIds] = useState<Set<string>>(new Set())
  const [connectedDevices, setConnectedDevices] = useState<Map<string, any>>(new Map())
  const [hasConnections, setHasConnections] = useState<boolean>(false)
  const [reconnecting, setIsReconnecting] = useState<boolean>(false)
  const [showSettings, setShowSettings] = useState<boolean>(false)
  const [manualDisconnect, setManualDisconnect] = useState<boolean>(false)


  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    if (connectedDeviceIds.size > 0) {
      localStorage.setItem("lastConnectedDevice", JSON.stringify(Array.from(connectedDeviceIds)))
    } else {
      localStorage.removeItem("lastConnectedDevice")
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
    const attemptReconnect = async () => {
      if (status === "authenticated" && session?.user?.id) {
        const lastConnectedDeviceStr = localStorage.getItem("lastConnectedDevice")
        let lastConnectedDevices = new Set<string>()

        if (lastConnectedDeviceStr) {
          try {
            const parsed = JSON.parse(lastConnectedDeviceStr)
            if (Array.isArray(parsed)) {
              lastConnectedDevices = new Set(parsed.filter((id) => typeof id === "string"))
            }
          } catch (error) {
            console.error("Error parsing stored device IDs:", error)
          }
        }

        const wasManuallyDisconnected = localStorage.getItem("manualDisconnect") === "true"
        setManualDisconnect(wasManuallyDisconnected)

        if (lastConnectedDevices.size > 0 && !wasManuallyDisconnected) {
          for (const deviceId of lastConnectedDevices) {
            await reconnectToDevice(deviceId)
          }
        }
      }
    }

    attemptReconnect()
  }, [status, session])

  const reconnectToDevice = async (deviceId: string) => {
    if (!session?.user?.id || reconnecting || manualDisconnect) return

    setIsReconnecting(true)

    try {
      const { count, error: countError } = await supabase
        .from("devices")
        .select("*", { count: "exact", head: true })
        .eq("id", deviceId)
        .eq("user_id", session.user.id)

      if (countError || count === 0) {
        console.log("Device no longer exists or error checking:", countError?.message)
        throw new Error("Device not found")
      }

      const { data: device, error } = await supabase
        .from("devices")
        .select("*")
        .eq("id", deviceId)
        .eq("user_id", session.user.id)
        .single()

      if (error || !device || !device.ip_address) {
        throw new Error("Device not found or no IP address")
      }

      const response = await fetch(`http://${device.ip_address}/info`)

      if (!response.ok) {
        throw new Error("Failed to connect to ESP32")
      }

      await supabase
        .from("devices")
        .update({
          last_connected: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", deviceId)

      handleDeviceConnect(deviceId, "connect")
    } catch (error) {
      console.error("Auto-reconnect failed:", error)
      const lastConnectedDeviceStr = localStorage.getItem("lastConnectedDevice")
      let lastConnectedDevices = new Set<string>()

      if (lastConnectedDeviceStr) {
        try {
          const parsed = JSON.parse(lastConnectedDeviceStr)
          if (Array.isArray(parsed)) {
            lastConnectedDevices = new Set(parsed.filter((id) => typeof id === "string"))
          }
        } catch (error) {
          console.error("Error parsing stored device IDs:", error)
        }
      }

      lastConnectedDevices.delete(deviceId)
      localStorage.setItem("lastConnectedDevice", JSON.stringify(Array.from(lastConnectedDevices)))
      handleDeviceConnect(deviceId, "disconnect")
    } finally {
      setIsReconnecting(false)
    }
  }

  const handleDeviceConnect = (deviceId: string | null, action: "connect" | "disconnect") => {
    if (!deviceId) return

    const newConnectedIds = new Set(connectedDeviceIds)

    if (action === "connect") {
      newConnectedIds.add(deviceId)
    } else {
      newConnectedIds.delete(deviceId)
    }

    setConnectedDeviceIds(newConnectedIds)
    setHasConnections(newConnectedIds.size > 0)
  }

  if (status === "loading" || status === "unauthenticated") {
    return null
  }

  const esp32Devices = Array.from(connectedDevices.values())
    .filter((device) => device?.ip_address)
    .map((device) => device.ip_address);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">ESP32 Dashboard</h1>
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
