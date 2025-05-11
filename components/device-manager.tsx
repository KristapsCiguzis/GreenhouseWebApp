"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle, Wifi, Trash2, Save, Plus, Loader2, Server, Clock, Calendar } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import type { Device } from "@/lib/supabase"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/use-toast"
import DummyDeviceButton from "@/components/dummy-device-button"
import { supabase } from "@/lib/supabase"
import { Separator } from "@/components/ui/separator"
import { setupMockFetch } from "@/lib/mock-fetch-middleware"

interface DeviceManagerProps {
  onDeviceConnect?: (deviceId: string, action: "connect" | "disconnect") => void
  connectedDeviceIds: Set<string>
  hasConnections: boolean
  isReconnecting?: boolean
  setManualDisconnect: (manual: boolean) => void
}

export default function DeviceManager({
  onDeviceConnect,
  connectedDeviceIds,
  hasConnections,
  isReconnecting = false,
  setManualDisconnect,
}: DeviceManagerProps) {
  const { data: session } = useSession()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setIsLoading] = useState(false)
  const [addingDevice, setIsAddingDevice] = useState(false)
  const [editingDeviceId, setIsEditingDevice] = useState<string | null>(null)
  const [deviceName, setNewDeviceName] = useState("")
  const [deviceIp, setNewDeviceIp] = useState("")
  const [multipleIps, setMultipleIps] = useState("")
  const [addingMultiple, setAddingMultiple] = useState(false)
  const [connectingDevices, setConnectingDevices] = useState<Set<string>>(new Set())
  const [errorMsg, setError] = useState("")
  const [connectAllMode, setConnectAllMode] = useState(false)
  const initialLoadRef = useRef(true)

  const fetchDevices = async () => {
    if (!session?.user?.id) return

    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .eq("user_id", session.user.id)
        .order("is_favorite", { ascending: false })
        .order("created_at", { ascending: false })

      if (error) throw error
      setDevices(data || [])

      if (initialLoadRef.current && data && data.length > 0 && connectedDeviceIds.size > 0) {
        initialLoadRef.current = false

        const devicesToConnect = data.filter((device) => connectedDeviceIds.has(device.id) && device.ip_address)

        if (devicesToConnect.length > 0) {
          console.log(
            "Attempting to reconnect to devices:",
            devicesToConnect.map((d) => d.name),
          )
          for (const device of devicesToConnect) {
            try {
              await connectToESP32(device, true)
            } catch (error) {
              console.error(`Failed to reconnect to ${device.name}:`, error)
            }
          }
        }
      }

      const newConnectedIds = new Set(connectedDeviceIds)
      let changed = false

      for (const id of connectedDeviceIds) {
        if (!data || !data.some((d) => d.id === id)) {
          console.log(`Connected device ${id} no longer exists, disconnecting`)
          newConnectedIds.delete(id)
          changed = true
        }
      }

      if (changed && onDeviceConnect) {
      }
    } catch (error) {
      console.error("Couldn't fetch devices:", error)
      toast({
        title: "Error",
        description: "Failed to fetch devices. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.id) {
      fetchDevices()
    }
  }, [session?.user?.id])

  const addDevice = async () => {
    if (!session?.user?.id) return

    if (addingMultiple) {
      if (!multipleIps) {
        setError("Please enter at least one IP address")
        return
      }
      const ipList = multipleIps
        .split(/[\n,]/)
        .map((ip) => ip.trim())
        .filter((ip) => ip.length > 0)

      if (ipList.length === 0) {
        setError("Please enter at least one valid IP address")
        return
      }
      const ipRegex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
      const invalidIps = ipList.filter((ip) => !ipRegex.test(ip))

      if (invalidIps.length > 0) {
        setError(`Invalid IP address format: ${invalidIps.join(", ")}`)
        return
      }

      try {
        const baseName = deviceName || `ESP32 Device`
        const newDevices = []

        for (let i = 0; i < ipList.length; i++) {
          const ip = ipList[i]
          const macAddress = `ESP32-${Math.random().toString(16).substring(2, 8).toUpperCase()}`
          const name = deviceName ? `${baseName} ${i + 1}` : `ESP32 Device ${devices.length + i + 1}`
          const { data, error } = await supabase
            .from("devices")
            .insert([
              {
                user_id: session.user.id,
                name: name,
                mac_address: macAddress,
                ip_address: ip,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ])
            .select()

          if (error) throw error
          if (!data || data.length === 0) {
            throw new Error(`Failed to create device with IP ${ip}`)
          }

          newDevices.push(data[0])
        }

        setNewDeviceName("")
        setNewDeviceIp("")
        setMultipleIps("")
        setError("")
        setIsAddingDevice(false)
        setAddingMultiple(false)

        await fetchDevices()

        if (connectAllMode && newDevices.length > 0) {
          for (const device of newDevices) {
            await connectToESP32(device)
          }
        } else if (newDevices.length > 0) {
          await connectToESP32(newDevices[0])
        }

        toast({
          title: "Success",
          description: `Added ${newDevices.length} devices successfully`,
        })
      } catch (error: any) {
        console.error("Oops! Couldn't add the devices:", error)
        if (error.code === "23505") {
          setError("A device with this MAC address already exists")
        } else {
          setError("Failed to add devices. Please try again.")
        }
      }
    } else {
      if (!deviceIp) {
        setError("Hey, you need to enter an IP address!")
        return
      }

      const ipRegex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
      if (!ipRegex.test(deviceIp)) {
        setError("That doesn't look like a valid IP address...")
        return
      }

      try {
        const macAddress = `ESP32-${Math.random().toString(16).substring(2, 8).toUpperCase()}`
        const name = deviceName || `ESP32 Device ${devices.length + 1}`

        const { data, error } = await supabase
          .from("devices")
          .insert([
            {
              user_id: session.user.id,
              name: name,
              mac_address: macAddress,
              ip_address: deviceIp,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ])
          .select()

        if (error) throw error
        if (!data || data.length === 0) {
          throw new Error("Failed to create device")
        }

        const newDevice = data[0]

        setNewDeviceName("")
        setNewDeviceIp("")
        setError("")
        setIsAddingDevice(false)

        await fetchDevices()
        await connectToESP32(newDevice)

        toast({
          title: "Success",
          description: `Device "${name}" added successfully`,
        })
      } catch (error: any) {
        console.error("Oops! Couldn't add the device:", error)
        if (error.code === "23505") {
          setError("A device with this MAC address already exists")
        } else {
          setError("Failed to add device. Please try again.")
        }
      }
    }
  }

  function updateDevice(device: Device) {
    return new Promise(async (resolve, reject) => {
      try {
        const { error } = await supabase
          .from("devices")
          .update({
            name: device.name,
            ip_address: device.ip_address,
            updated_at: new Date().toISOString(),
          })
          .eq("id", device.id)

        if (error) throw error

        setIsEditingDevice(null)
        fetchDevices()
        if (connectedDeviceIds.has(device.id)) {
          await connectToESP32(device)
        }

        toast({
          title: "Success",
          description: `Device "${device.name}" updated successfully`,
        })

        resolve(true)
      } catch (error) {
        console.error("Error updating device:", error)
        toast({
          title: "Error",
          description: "Failed to update device. Please try again.",
          variant: "destructive",
        })
        reject(error)
      }
    })
  }

  const deleteDevice = async (id: string) => {
    if (connectedDeviceIds.has(id)) {
      disconnectFromESP32(id, true)
    }

    try {
      const { error } = await supabase.from("devices").delete().eq("id", id)

      if (error) throw error

      fetchDevices()

      toast({
        title: "Success",
        description: "Device deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting device:", error)
      toast({
        title: "Error",
        description: "Failed to delete device. Please try again.",
        variant: "destructive",
      })
    }
  }

  const connectToESP32 = async (device: Device, isReconnect = false): Promise<void> => {
    if (!device || typeof device.id !== "string") {
      console.warn("Invalid device object received")
      return
    }

    if (!device.ip_address) {
      if (!isReconnect) setError("Please enter an IP address")
      return
    }

    const ipRegex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    if (!ipRegex.test(device.ip_address)) {
      if (!isReconnect) setError("Please enter a valid IP address")
      return
    }

    if (!isReconnect) {
      setConnectingDevices((prev) => new Set(prev).add(device.id))
      setError("")
    }

    setManualDisconnect(false)
    localStorage.removeItem("manualDisconnect")

    const isDummyDevice = device.ip_address === "192.168.1.200"

    if (isDummyDevice) {
      console.log("Setting up mock fetch for dummy device connection")
      setupMockFetch()
    }

    try {
      let data
      let macVerified = false

      try {
        const response = await fetch(`http://${device.ip_address}/info`, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(3000),
        })

        if (!response.ok) {
          throw new Error("Failed to connect to ESP32")
        }

        data = await response.json()
        console.log("Connected to device, received data:", data)
        if (data.mac && typeof data.mac === "string" && data.mac.length > 0) {
          macVerified = true
        }
      } catch (fetchError) {
        console.log("Could not connect to actual device, using simulated response")
        data = { mac: device.mac_address || "SIMULATED-MAC" }

        if (isDummyDevice) {
          macVerified = true
        }
      }
      if (!isDummyDevice && !macVerified) {
        throw new Error("Could not verify device MAC address")
      }

      if (session?.user?.id) {
        const { error } = await supabase
          .from("devices")
          .update({
            last_connected: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...(data.mac ? { mac_address: data.mac } : {}),
          })
          .eq("id", device.id)

        if (error) throw error
      }

      if (onDeviceConnect) {
        onDeviceConnect(device.id, "connect")
      }

      if (!isReconnect) {
        toast({
          title: "Connected",
          description: `Successfully connected to ${device.name}`,
        })
      }

      fetchDevices()
    } catch (err: any) {
      console.error("Connection error:", err)
      if (!isReconnect) {
        const errorMessage =
          err.message === "Could not verify device MAC address"
            ? `Couldn't connect to ${device.name}. MAC address verification failed.`
            : `Couldn't connect to ${device.name}. Check the IP and make sure it's powered on.`

        setError(errorMessage)
        toast({
          title: "Connection Failed",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } finally {
      if (!isReconnect) {
        setConnectingDevices((prev) => {
          const newSet = new Set(prev)
          newSet.delete(device.id)
          return newSet
        })
      }
    }
  }

  function disconnectFromESP32(deviceId: string, manual = true) {
    console.log(`Disconnecting from ESP32 ${deviceId}`, manual ? "(manual disconnect)" : "(automatic disconnect)")

    if (onDeviceConnect) {
      onDeviceConnect(deviceId, "disconnect")
    }

    if (manual) {
      const updatedIds = Array.from(connectedDeviceIds).filter((id) => id !== deviceId)

      if (updatedIds.length === 0) {
        setManualDisconnect(true)
        localStorage.setItem("manualDisconnect", "true")
      }
    }
  }

  const connectToAllDevices = async () => {
    if (!devices.length) return

    setError("")

    for (const device of devices) {
      if (!connectedDeviceIds.has(device.id) && device.ip_address) {
        await connectToESP32(device)
      }
    }
  }

  const disconnectFromAllDevices = () => {
    for (const deviceId of connectedDeviceIds) {
      disconnectFromESP32(deviceId, true)
    }
  }

  const handleIpChange = (id: string, value: string) =>
    setDevices(devices.map((d) => (d.id === id ? { ...d, ip_address: value } : d)))

  const formatDate = (dateString: string) => {
    if (!dateString) return "Never"
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  return (
    <div className="space-y-6">
      {isReconnecting && (
        <div className="bg-muted p-4 rounded-md flex items-center justify-center gap-2 mb-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Reconnecting to your devices...</span>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>ESP32 Devices</CardTitle>
            <CardDescription>Manage your ESP32 devices</CardDescription>
          </div>
          <div className="flex gap-2">
            {devices.length > 0 && (
              <Button size="sm" variant="default" onClick={connectToAllDevices}>
                <Wifi className="mr-2 h-4 w-4" />
                Connect All
              </Button>
            )}
            <DummyDeviceButton
              onDeviceAdded={(deviceId) => {
                fetchDevices().then(() => {
                  if (onDeviceConnect) {
                    onDeviceConnect(deviceId, "connect")
                  }
                })
              }}
            />
            <Dialog open={addingDevice} onOpenChange={setIsAddingDevice}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Device
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New ESP32 Device</DialogTitle>
                  <DialogDescription>Register a new ESP32 device to your account</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="device-name" className="text-right">
                      Name (optional)
                    </Label>
                    <Input
                      id="device-name"
                      value={deviceName}
                      onChange={(e) => setNewDeviceName(e.target.value)}
                      className="col-span-3"
                      placeholder={addingMultiple ? "Base name for devices" : "Living Room ESP32"}
                    />
                  </div>

                  <div className="flex items-center gap-2 col-span-4">
                    <Switch id="multiple-devices" checked={addingMultiple} onCheckedChange={setAddingMultiple} />
                    <Label htmlFor="multiple-devices">Add multiple devices</Label>
                  </div>

                  {addingMultiple && (
                    <div className="flex items-center gap-2 col-span-4">
                      <Switch id="connect-all" checked={connectAllMode} onCheckedChange={setConnectAllMode} />
                      <Label htmlFor="connect-all">Connect to all devices after adding</Label>
                    </div>
                  )}

                  {addingMultiple ? (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="multiple-ips" className="text-right">
                        IP Addresses
                      </Label>
                      <div className="col-span-3">
                        <textarea
                          id="multiple-ips"
                          value={multipleIps}
                          onChange={(e) => setMultipleIps(e.target.value)}
                          className="w-full min-h-[100px] p-2 border rounded-md"
                          placeholder="Enter IP addresses (one per line or comma-separated)&#10;192.168.1.100&#10;192.168.1.101&#10;192.168.1.102"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Enter multiple IP addresses, one per line or comma-separated
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="device-ip" className="text-right">
                        IP Address
                      </Label>
                      <Input
                        id="device-ip"
                        value={deviceIp}
                        onChange={(e) => setNewDeviceIp(e.target.value)}
                        className="col-span-3"
                        placeholder="192.168.1.100"
                      />
                    </div>
                  )}

                  {errorMsg && (
                    <div className="flex items-center text-destructive gap-2 col-span-4">
                      <AlertCircle className="h-4 w-4" />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAddingDevice(false)
                      setNewDeviceName("")
                      setNewDeviceIp("")
                      setMultipleIps("")
                      setAddingMultiple(false)
                      setConnectAllMode(false)
                      setError("")
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={addDevice}>{addingMultiple ? "Add Devices" : "Add Device"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center p-4">Loading devices...</div>
          ) : devices.length === 0 ? (
            <div className="text-center p-6 text-muted-foreground">
              No devices registered. Add your first ESP32 device to get started.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {devices.map((device) => (
                <Card
                  key={device.id}
                  className={`overflow-hidden transition-all ${
                    connectedDeviceIds.has(device.id) ? "border-primary shadow-md" : ""
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      {editingDeviceId === device.id ? (
                        <Input
                          value={device.name}
                          onChange={(e) =>
                            setDevices(devices.map((d) => (d.id === device.id ? { ...d, name: e.target.value } : d)))
                          }
                          className="w-full max-w-xs"
                          placeholder="Device name"
                        />
                      ) : (
                        <CardTitle className="text-lg">{device.name}</CardTitle>
                      )}
                      <div className="flex items-center gap-2">
                        {editingDeviceId === device.id ? (
                          <Button variant="ghost" size="sm" onClick={() => updateDevice(device)}>
                            <Save className="h-4 w-4" />
                          </Button>
                        ) : (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => setIsEditingDevice(device.id)}>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                              </svg>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive/90"
                              onClick={() => deleteDevice(device.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {device.mac_address && (
                      <CardDescription className="flex items-center gap-1">
                        <Server className="h-3 w-3" /> {device.mac_address}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="space-y-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`ip-${device.id}`}>IP Address</Label>
                        <div className="flex gap-2">
                          <Input
                            id={`ip-${device.id}`}
                            value={device.ip_address || ""}
                            onChange={(e) => handleIpChange(device.id, e.target.value)}
                            placeholder="192.168.1.100"
                            disabled={connectedDeviceIds.has(device.id)}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col items-start gap-2 pt-0">
                    {device.last_connected && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> Last connected: {formatDate(device.last_connected)}
                      </div>
                    )}
                    {device.created_at && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" /> Added: {formatDate(device.created_at)}
                      </div>
                    )}
                    <Separator className="my-2" />
                    <div className="w-full flex justify-between items-center">
                      {connectedDeviceIds.has(device.id) ? (
                        <>
                          <Badge variant="success" className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Connected
                          </Badge>
                          <Button variant="destructive" size="sm" onClick={() => disconnectFromESP32(device.id, true)}>
                            Disconnect
                          </Button>
                        </>
                      ) : (
                        <>
                          <Badge variant="outline" className="flex items-center gap-1">
                            Disconnected
                          </Badge>
                          <Button
                            size="sm"
                            onClick={() => connectToESP32(device)}
                            disabled={connectingDevices.has(device.id) || isReconnecting || !device.ip_address}
                          >
                            {connectingDevices.has(device.id) ? (
                              <>
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                Connecting...
                              </>
                            ) : (
                              <>
                                <Wifi className="mr-2 h-3 w-3" />
                                Connect
                              </>
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
