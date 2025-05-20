"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Plus, Info, ChevronDown, ChevronRight } from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Widget, Device } from "@/lib/supabase"
import { StorageService } from "@/lib/storage-service"
import LedControlWidget from "@/components/widgets/led-control-widget"
import MoistureSensorWidget from "@/components/widgets/moisture-sensor-widget"
import TempHumidityWidget from "@/components/widgets/temp-humidity-widget"
import WaterPumpWidget from "@/components/widgets/water-pump-widget"
import LightSensorWidget from "@/components/widgets/light-sensor-widget"
import LightControlWidget from "@/components/widgets/light-control-widget"
import WebcamWidget from "@/components/widgets/webcam-widget"

type WidgetType =
  | "led_controller"
  | "moisture_sensor"
  | "temp_humidity_sensor"
  | "water_pump"
  | "light_sensor"
  | "light_control"
  | "webcam"

const DEFAULT_PINS = {
  led_controller: "2",
  moisture_sensor: "34",
  temp_humidity_sensor: "4",
  water_pump: "5",
  light_sensor: "32",
  light_control: "0",
  webcam: "1",
}

const DEFAULT_NAMES = {
  led_controller: "LED Control",
  moisture_sensor: "Soil Moisture",
  temp_humidity_sensor: "Temperature & Humidity",
  water_pump: "Water Pump",
  light_sensor: "Light Sensor",
  light_control: "Light Control",
  webcam: "ESP32 Camera",
}

const PIN_DESCRIPTIONS = {
  led_controller: "Built-in LED: Pin 2 (controls the onboard LED)",
  moisture_sensor: "Soil Moisture Sensor: Pin 34",
  temp_humidity_sensor: "DHT Temperature & Humidity Sensor: Pin 4",
  water_pump: "Water Pump Relay: Pin 5",
  light_sensor: "Light Sensor (LDR): Pin 32",
  light_control: "Light Control Relay: Pin 0",
  webcam: "ESP32-CAM Module",
}

const DEFAULT_REFRESH_RATES = {
  moisture_sensor: 10,
  temp_humidity_sensor: 30,
  light_sensor: 5,
}

interface WidgetManagerProps {
  connectedDeviceIds: Set<string>
}

export default function WidgetManager({ connectedDeviceIds }: WidgetManagerProps) {
  const { data: session } = useSession()
  const [widgetList, setWidgets] = useState<Widget[]>([])
  const [deviceInfo, setConnectedDevice] = useState<Map<string, Device>>(new Map())
  const [loading, setIsLoading] = useState(false)
  const [addingWidget, setIsAddingWidget] = useState(false)
  const [widgetName, setNewWidgetName] = useState(DEFAULT_NAMES.led_controller)
  const [widgetType, setWidgetType] = useState<WidgetType>("led_controller")
  const [pinNumber, setNewWidgetPin] = useState<string>(DEFAULT_PINS.led_controller)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("")
  const [errorMsg, setError] = useState("")
  const [ledStatus, setLedStates] = useState<Record<string, boolean>>({})
  const [collapsedDevices, setCollapsedDevices] = useState<Set<string>>(new Set())

  const toggleDeviceCollapse = (deviceId: string) => {
    setCollapsedDevices((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(deviceId)) {
        newSet.delete(deviceId)
      } else {
        newSet.add(deviceId)
      }
      return newSet
    })
  }

  const handleWidgetTypeChange = (type: WidgetType) => {
    setWidgetType(type)
    setNewWidgetPin(DEFAULT_PINS[type])
    setNewWidgetName(DEFAULT_NAMES[type])
  }

  useEffect(() => {
    if (addingWidget) {
      setWidgetType("led_controller")
      setNewWidgetName(DEFAULT_NAMES.led_controller)
      setNewWidgetPin(DEFAULT_PINS.led_controller)
      setError("")

      if (connectedDeviceIds.size > 0 && deviceInfo.size > 0) {
        const firstId = Array.from(connectedDeviceIds)[0]
        setSelectedDeviceId(firstId)
      } else {
        setSelectedDeviceId("")
      }
    }
  }, [addingWidget, connectedDeviceIds, deviceInfo])

  const fetchConnectedDevices = async () => {
    if (!session?.user?.id || connectedDeviceIds.size === 0) {
      setConnectedDevice(new Map())
      return
    }

    try {
      const deviceMap = new Map<string, Device>()

      for (const deviceId of connectedDeviceIds) {
        const device = await StorageService.getDevice(session.user.id, deviceId)
        if (device) {
          deviceMap.set(deviceId, device)
        }
      }

      setConnectedDevice(deviceMap)
    } catch (error: any) {
      console.error("Couldn't get device info:", error?.message || "Unknown error")
      setConnectedDevice(new Map())
    }
  }

  const checkLedStatus = async () => {
    for (const [deviceId, device] of deviceInfo.entries()) {
      if (!device.ip_address) continue

      try {
        console.log(`Checking LED status from device ${device.name}`)

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const response = await fetch(`http://${device.ip_address}/led`, {
          signal: controller.signal,
          cache: "no-store",
        }).catch((err) => {
          clearTimeout(timeoutId)
          throw err
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          console.warn(`Failed to get LED state from ${device.name}`)
          continue
        }

        const data = await response.json()
        console.log(`LED status response from ${device.name}:`, data)

        const newLedStates = { ...ledStatus }
        widgetList.forEach((widget) => {
          if (widget.sensor_type === "led_control" && widget.device_mac === device.mac_address) {
            newLedStates[widget.id] = data.state
          }
        })

        setLedStates(newLedStates)
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          console.error(`Timeout checking LED status for ${device.name}`)
        } else {
          console.error(`Error checking LED status for ${device.name}:`, error)
        }
      }
    }
  }

  function fetchWidgets() {
    if (!session?.user?.id || deviceInfo.size === 0) return Promise.resolve()

    setIsLoading(true)

    return new Promise(async (resolve, reject) => {
      try {
        const allWidgets: Widget[] = []

        for (const device of deviceInfo.values()) {
          if (device.mac_address) {
            const deviceWidgets = await StorageService.getWidgetsForDevice(session.user.id, device.mac_address)
            allWidgets.push(...deviceWidgets)
          }
        }

        setWidgets(allWidgets)

        const ledStateObj: Record<string, boolean> = {}
        allWidgets?.forEach((widget) => {
          if (widget.sensor_type === "led_control" || widget.sensor_type === "digital_output") {
            ledStateObj[widget.id] = widget.configuration?.state || false
          }
        })
        setLedStates(ledStateObj)

        if (allWidgets.some((w) => w.sensor_type === "led_control")) {
          setTimeout(checkLedStatus, 500)
        }

        resolve(allWidgets)
      } catch (error) {
        console.error("Error fetching widgets:", error)
        reject(error)
      } finally {
        setIsLoading(false)
      }
    })
  }

  useEffect(() => {
    fetchConnectedDevices()
  }, [connectedDeviceIds, session?.user?.id])

  useEffect(() => {
    if (deviceInfo.size > 0) {
      fetchWidgets()
    } else {
      setWidgets([])
    }
  }, [deviceInfo, session?.user?.id])

  const addWidget = async () => {
    if (!session?.user?.id || !selectedDeviceId) {
      setError("No device selected")
      return
    }

    const selectedDevice = deviceInfo.get(selectedDeviceId)
    if (!selectedDevice || !selectedDevice.mac_address) {
      setError("Invalid device selected")
      return
    }

    if (!widgetName) {
      setError("Widget name is required")
      return
    }

    if (!pinNumber) {
      setError("Pin number is required")
      return
    }

    try {
      const pin = Number.parseInt(pinNumber)
      if (isNaN(pin)) {
        setError("Pin must be a valid number")
        return
      }

      let widgetConfig: {
        widget_type: string
        sensor_type: string
        configuration: Record<string, any>
      } = {
        widget_type: "control",
        sensor_type: "led_control",
        configuration: { state: false },
      }

      switch (widgetType) {
        case "led_controller":
          widgetConfig = {
            widget_type: "control",
            sensor_type: "led_control",
            configuration: { state: false },
          }
          break
        case "moisture_sensor":
          widgetConfig = {
            widget_type: "sensor",
            sensor_type: "moisture",
            configuration: { refresh_rate: DEFAULT_REFRESH_RATES.moisture_sensor },
          }
          break
        case "temp_humidity_sensor":
          widgetConfig = {
            widget_type: "sensor",
            sensor_type: "temperature_humidity",
            configuration: { refresh_rate: DEFAULT_REFRESH_RATES.temp_humidity_sensor },
          }
          break
        case "water_pump":
          widgetConfig = {
            widget_type: "control",
            sensor_type: "water_pump",
            configuration: {
              state: false,
              autoMode: false,
              minMoistureLevel: 30,
              checkInterval: 15,
            },
          }
          break
        case "light_sensor":
          widgetConfig = {
            widget_type: "sensor",
            sensor_type: "light",
            configuration: { refresh_rate: DEFAULT_REFRESH_RATES.light_sensor },
          }
          break
        case "light_control":
          widgetConfig = {
            widget_type: "control",
            sensor_type: "light_control",
            configuration: {
              state: false,
              autoMode: false,
              lightThreshold: 30,
              checkInterval: 15,
            },
          }
          break
        case "webcam":
          widgetConfig = {
            widget_type: "sensor",
            sensor_type: "webcam",
            configuration: {
              resolution: "VGA",
              quality: 10,
              brightness: 0,
              contrast: 0,
              recognitionEnabled: false,
            },
          }
          break
      }

      const newWidget = await StorageService.createWidget({
        user_id: session.user.id,
        device_mac: selectedDevice.mac_address,
        widget_type: widgetConfig.widget_type,
        name: widgetName,
        pin: pin,
        sensor_type: widgetConfig.sensor_type,
        configuration: widgetConfig.configuration,
        position: { x: 0, y: 0 },
        is_active: true,
      })

      if (!newWidget) throw new Error("Failed to create widget")

      if (selectedDevice.ip_address) {
        try {
          let endpoint = ""
          switch (widgetType) {
            case "led_controller":
              endpoint = "/set-led-pin"
              break
            case "moisture_sensor":
              endpoint = "/set-moisture-pin"
              break
            case "temp_humidity_sensor":
              endpoint = "/set-dht-pin"
              break
            case "water_pump":
              endpoint = "/set-relay-pin"
              break
            case "light_sensor":
              endpoint = "/set-light-pin"
              break
            case "light_control":
              endpoint = "/set-relay-pin"
              break
          }

          if (endpoint) {
            const response = await fetch(`http://${selectedDevice.ip_address}${endpoint}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ pin: pin }),
            })

            if (!response.ok) {
              console.warn(`Warning: Failed to configure pin on ESP32 for ${widgetType}`)
            }
          }
        } catch (error) {
          console.warn("Error configuring pin on ESP32:", error)
        }
      }

      setNewWidgetName(DEFAULT_NAMES.led_controller)
      setWidgetType("led_controller")
      setNewWidgetPin(DEFAULT_PINS.led_controller)
      setError("")
      setIsAddingWidget(false)
      fetchWidgets()
    } catch (error) {
      console.error("Widget creation failed:", error)
      setError("Couldn't add widget. Please try again.")
    }
  }

  function deleteWidget(id: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const success = await StorageService.deleteWidget(id)
        if (!success) throw new Error("Failed to delete widget")

        fetchWidgets()
        resolve()
      } catch (error) {
        console.error("Error deleting widget:", error)
        reject(error)
      }
    })
  }

  const toggleLed = async (widget: Widget) => {
    if (!widget || typeof widget.id !== "string") {
      console.warn("Invalid widget object received")
      return
    }

    let deviceIp: string | null = null
    for (const device of deviceInfo.values()) {
      if (device.mac_address === widget.device_mac) {
        deviceIp = device.ip_address
        break
      }
    }

    if (!deviceIp) return

    const currentState = ledStatus[widget.id] || false

    try {
      console.log(`Toggling LED from ${currentState} to ${!currentState}`)

      const response = await fetch(`http://${deviceIp}/led`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          state: !currentState,
          pin: widget.pin,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to control ${widget.name}`)
      }

      const data = await response.json()
      console.log("LED toggle response:", data)

      if (!data.success) {
        throw new Error(data.error || `Failed to control ${widget.name}`)
      }

      await StorageService.updateWidgetConfiguration(widget.id, {
        ...widget.configuration,
        state: data.state,
      })

      setLedStates((prev) => ({ ...prev, [widget.id]: data.state }))

      setTimeout(checkLedStatus, 500)
    } catch (error) {
      console.error(`Couldn't toggle ${widget.name}:`, error)
      checkLedStatus()
    }
  }

  // Render the component
  if (connectedDeviceIds.size === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Widgets</CardTitle>
          <CardDescription>Connect to an ESP32 device first to manage widgets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center p-6 text-muted-foreground">
            No device connected. Please connect to an ESP32 device in the Devices tab.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Widgets</CardTitle>
            <CardDescription>Manage widgets for your ESP32 devices</CardDescription>
          </div>
          <Dialog open={addingWidget} onOpenChange={setIsAddingWidget}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={connectedDeviceIds.size === 0}>
                <Plus className="h-4 w-4 mr-2" />
                Add Widget
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Widget</DialogTitle>
                <DialogDescription>Configure a new widget for your ESP32 device</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="device-select" className="text-right">
                    Device
                  </Label>
                  <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select device" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(deviceInfo.entries()).map(([id, device]) => (
                        <SelectItem key={id} value={id}>
                          {device.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="widget-type" className="text-right">
                    Widget Type
                  </Label>
                  <Select value={widgetType} onValueChange={handleWidgetTypeChange}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select widget type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="led_controller">LED Controller</SelectItem>
                      <SelectItem value="moisture_sensor">Moisture Sensor</SelectItem>
                      <SelectItem value="temp_humidity_sensor">Temperature & Humidity</SelectItem>
                      <SelectItem value="water_pump">Water Pump</SelectItem>
                      <SelectItem value="light_sensor">Light Sensor</SelectItem>
                      <SelectItem value="light_control">Light Control</SelectItem>
                      <SelectItem value="webcam">ESP32 Camera</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="widget-name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="widget-name"
                    value={widgetName}
                    onChange={(e) => setNewWidgetName(e.target.value)}
                    className="col-span-3"
                    placeholder={DEFAULT_NAMES[widgetType]}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="widget-pin" className="text-right">
                    Pin
                  </Label>
                  <div className="col-span-3 space-y-1">
                    <Input
                      id="widget-pin"
                      value={pinNumber}
                      onChange={(e) => setNewWidgetPin(e.target.value)}
                      placeholder={DEFAULT_PINS[widgetType]}
                      type="number"
                    />
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Info className="h-3 w-3 mr-1" />
                      <span>{PIN_DESCRIPTIONS[widgetType]}</span>
                    </div>
                  </div>
                </div>
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
                    setIsAddingWidget(false)
                    setError("")
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={addWidget}>Add Widget</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center p-4">Loading widgets...</div>
          ) : (
            <div className="space-y-8">
              {Array.from(deviceInfo.entries()).map(([deviceId, device], index) => {
                const deviceWidgets = widgetList.filter((widget) => widget.device_mac === device.mac_address)
                const isCollapsed = collapsedDevices.has(deviceId)

                return (
                  <div key={deviceId}>
                    {/* Add separator between devices, but not before the first one */}
                    {index > 0 && <div className="my-8 border-t border-border" />}

                    <div className="space-y-4">
                      <div className="flex items-center justify-between bg-muted/30 p-3 rounded-md">
                        <h3 className="text-lg font-semibold">{device.name}</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleDeviceCollapse(deviceId)}
                          className="h-8 w-8 p-0"
                        >
                          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>

                      {!isCollapsed && (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {/* Display widgets first */}
                          {deviceWidgets.map((widget) => {
                            if (widget.sensor_type === "led_control") {
                              return (
                                <LedControlWidget
                                  key={widget.id}
                                  widget={widget}
                                  deviceIp={device.ip_address}
                                  onDelete={deleteWidget}
                                  ledStatus={ledStatus[widget.id] || false}
                                  onToggle={toggleLed}
                                />
                              )
                            } else if (widget.sensor_type === "moisture") {
                              return (
                                <MoistureSensorWidget
                                  key={widget.id}
                                  widget={widget}
                                  deviceIp={device.ip_address}
                                  onDelete={deleteWidget}
                                />
                              )
                            } else if (widget.sensor_type === "temperature_humidity") {
                              return (
                                <TempHumidityWidget
                                  key={widget.id}
                                  widget={widget}
                                  deviceIp={device.ip_address}
                                  onDelete={deleteWidget}
                                />
                              )
                            } else if (widget.sensor_type === "water_pump") {
                              return (
                                <WaterPumpWidget
                                  key={widget.id}
                                  widget={widget}
                                  deviceIp={device.ip_address}
                                  onDelete={deleteWidget}
                                />
                              )
                            } else if (widget.sensor_type === "light") {
                              return (
                                <LightSensorWidget
                                  key={widget.id}
                                  widget={widget}
                                  deviceIp={device.ip_address}
                                  onDelete={deleteWidget}
                                />
                              )
                            } else if (widget.sensor_type === "light_control") {
                              return (
                                <LightControlWidget
                                  key={widget.id}
                                  widget={widget}
                                  deviceIp={device.ip_address}
                                  onDelete={deleteWidget}
                                />
                              )
                            } else if (widget.sensor_type === "webcam") {
                              return (
                                <WebcamWidget
                                  key={widget.id}
                                  widget={widget}
                                  deviceIp={device.ip_address}
                                  onDelete={deleteWidget}
                                />
                              )
                            }
                            return null
                          })}

                          {/* Add Widget box at the end */}
                          <Card
                            className="flex flex-col items-center justify-center h-[300px] border-dashed cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => {
                              // Pre-select this device in the dialog
                              setSelectedDeviceId(deviceId)
                              setIsAddingWidget(true)
                            }}
                          >
                            <div className="flex flex-col items-center justify-center p-6 text-muted-foreground">
                              <Plus className="h-12 w-12 mb-2" />
                              <p className="text-sm font-medium">Add Widget</p>
                            </div>
                          </Card>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {deviceInfo.size === 0 && connectedDeviceIds.size > 0 && (
                <div className="text-center p-6 text-muted-foreground">
                  <p>Connected devices found, but device information is still loading...</p>
                </div>
              )}

              {deviceInfo.size === 0 && connectedDeviceIds.size === 0 && (
                <div className="text-center p-6 text-muted-foreground">
                  No devices connected. Please connect to an ESP32 device in the Devices tab.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
