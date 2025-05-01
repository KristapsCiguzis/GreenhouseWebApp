"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle, Wifi, Star, Trash2, Save, Plus, Loader2 } from "lucide-react"
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
import { StorageService } from "@/lib/storage-service"
import { Switch } from "@/components/ui/switch"

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

  const fetchDevices = async () => {
    if (!session?.user?.id) return

    setIsLoading(true)
    try {
      const devices = await StorageService.getDevices(session.user.id)
      setDevices(devices)
      const newConnectedIds = new Set(connectedDeviceIds)
      let changed = false

      for (const id of connectedDeviceIds) {
        if (!devices.some((d) => d.id === id)) {
          console.log(`Connected device ${id} no longer exists, disconnecting`)
          newConnectedIds.delete(id)
          changed = true
        }
      }

      if (changed && onDeviceConnect) {
      }
    } catch (error) {
      console.error("Couldn't fetch devices:", error)
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

          const newDevice = await StorageService.createDevice({
            user_id: session.user.id,
            name: name,
            mac_address: macAddress,
            ip_address: ip,
          })

          if (!newDevice) {
            throw new Error(`Failed to create device with IP ${ip}`)
          }

          newDevices.push(newDevice)
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

        const newDevice = await StorageService.createDevice({
          user_id: session.user.id,
          name: name,
          mac_address: macAddress,
          ip_address: deviceIp,
        })

        if (!newDevice) {
          throw new Error("Failed to create device")
        }

        setNewDeviceName("")
        setNewDeviceIp("")
        setError("")
        setIsAddingDevice(false)

        await fetchDevices()

        await connectToESP32(newDevice)
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
        const success = await StorageService.updateDevice(device.id, {
          name: device.name,
          ip_address: device.ip_address,
        })

        if (!success) throw new Error("Failed to update device")

        setIsEditingDevice(null)
        fetchDevices()
        if (connectedDeviceIds.has(device.id)) {
          await connectToESP32(device)
        }
        resolve(true)
      } catch (error) {
        console.error("Error updating device:", error)
        reject(error)
      }
    })
  }

  const deleteDevice = async (id: string) => {

    if (connectedDeviceIds.has(id)) {
      disconnectFromESP32(id, true)
    }

    try {
      const success = await StorageService.deleteDevice(id)
      if (!success) throw new Error("Failed to delete device")

      fetchDevices()
    } catch (error) {
      console.error("Error deleting device:", error)
    }
  }
  const toggleFavorite = async (device: Device) => {
    try {
      const isFav = !device.is_favorite
      const success = await StorageService.updateDevice(device.id, {
        is_favorite: isFav,
      })

      if (!success) throw new Error("Failed to update favorite status")

      fetchDevices()
    } catch (error) {
      console.error("Error toggling favorite:", error)
    }
  }

  const connectToESP32 = async (device: Device): Promise<void> => {
    if (!device || typeof device.id !== "string") {
      console.warn("Invalid device object received")
      return
    }

    if (!device.ip_address) {
      setError("Please enter an IP address")
      return
    }

    const ipRegex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    if (!ipRegex.test(device.ip_address)) {
      setError("Please enter a valid IP address")
      return
    }

    setConnectingDevices((prev) => new Set(prev).add(device.id))
    setError("")

    try {
      const response = await fetch(`http://${device.ip_address}/info`)

      if (!response.ok) {
        throw new Error("Failed to connect to ESP32")
      }

      const data = await response.json()
      if (session?.user?.id) {
        await StorageService.updateDeviceConnection(device.id, data.mac || device.mac_address)
      }
      if (onDeviceConnect) {
        onDeviceConnect(device.id, "connect")
      }
      const connectedIds = JSON.parse(localStorage.getItem("connectedDeviceIds") || "[]")
      if (!connectedIds.includes(device.id)) {
        connectedIds.push(device.id)
        localStorage.setItem("connectedDeviceIds", JSON.stringify(connectedIds))
      }
      setManualDisconnect(false)
      localStorage.removeItem("manualDisconnect")

      fetchDevices()
    } catch (err) {
      setError(`Couldn't connect to ${device.name}. Check the IP and make sure it's powered on.`)
    } finally {
      setConnectingDevices((prev) => {
        const newSet = new Set(prev)
        newSet.delete(device.id)
        return newSet
      })
    }
  }
  function disconnectFromESP32(deviceId: string, manual = true) {
    console.log(`Disconnecting from ESP32 ${deviceId}`, manual ? "(manual disconnect)" : "(automatic disconnect)")
    if (onDeviceConnect) {
      onDeviceConnect(deviceId, "disconnect")
    }


    const connectedIds = JSON.parse(localStorage.getItem("connectedDeviceIds") || "[]")
    const updatedIds = connectedIds.filter((id: string) => id !== deviceId)
    localStorage.setItem("connectedDeviceIds", JSON.stringify(updatedIds))


    if (manual) {
      setManualDisconnect(true)
      localStorage.setItem("manualDisconnect", "true")
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
            <div className="space-y-4">
              {devices.map((device) => (
                <Card
                  key={device.id}
                  className={`overflow-hidden ${connectedDeviceIds.has(device.id) ? "border-primary" : ""}`}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
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
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{device.name}</h3>
                          {device.is_favorite && <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        {editingDeviceId === device.id ? (
                          <Button variant="ghost" size="sm" onClick={() => updateDevice(device)}>
                            <Save className="h-4 w-4" />
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => deleteDevice(device.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      {device.mac_address && <p className="text-sm text-muted-foreground">MAC: {device.mac_address}</p>}

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
                          <div className="flex gap-2">
                            {connectedDeviceIds.has(device.id) ? (
                              <Button variant="destructive" onClick={() => disconnectFromESP32(device.id, true)}>
                                Disconnect
                              </Button>
                            ) : (
                              <Button
                                onClick={() => connectToESP32(device)}
                                disabled={connectingDevices.has(device.id) || isReconnecting || !device.ip_address}
                              >
                                {connectingDevices.has(device.id) ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Connecting...
                                  </>
                                ) : (
                                  <>
                                    <Wifi className="mr-2 h-4 w-4" />
                                    Connect
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      {connectedDeviceIds.has(device.id) && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="success" className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Connected
                            </Badge>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
