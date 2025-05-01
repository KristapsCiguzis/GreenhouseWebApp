"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Lightbulb, Trash2, Settings, Sun } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import type { Widget } from "@/lib/supabase"
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
import { Input } from "@/components/ui/input"
import { StorageService } from "@/lib/storage-service"

interface LightControlWidgetProps {
  widget: Widget
  deviceIp: string | null
  onDelete: (id: string) => Promise<any>
}

export default function LightControlWidget({ widget, deviceIp, onDelete }: LightControlWidgetProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [lightState, setLightState] = useState(widget.configuration?.state || false)
  const [isToggling, setIsToggling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pinNumber, setPinNumber] = useState(widget.pin?.toString() || "0")
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [autoMode, setAutoMode] = useState(widget.configuration?.autoMode || false)
  const [lightThreshold, setLightThreshold] = useState(widget.configuration?.lightThreshold || 30)
  const [checkInterval, setCheckInterval] = useState(widget.configuration?.checkInterval || 15)
  const [currentLight, setCurrentLight] = useState<number | null>(null)
  const [lastAutoRun, setLastAutoRun] = useState<Date | null>(null)
  const [nextAutoRun, setNextAutoRun] = useState<Date | null>(null)
  const autoTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [countdownActive, setCountdownActive] = useState(false)

  const fetchLightLevel = async () => {
    if (!deviceIp) return null

    try {
      const response = await fetch(`http://${deviceIp}/sensors`)
      if (!response.ok) {
        throw new Error("Failed to fetch sensor data")
      }

      const data = await response.json()
      let lightValue = null

      if (data.sensors && Array.isArray(data.sensors)) {
        const lightSensor = data.sensors.find((sensor: any) => sensor.type === "light" || sensor.id === "light")
        if (lightSensor) {
          lightValue =
            lightSensor.percentage ||
            (lightSensor.value !== undefined ? Math.max(0, Math.min(100, (lightSensor.value / 4095) * 100)) : null)
        }
      } else if (data.light !== undefined) {
        lightValue = Math.max(0, Math.min(100, (data.light / 4095) * 100))
      }

      return lightValue
    } catch (error) {
      console.error("Error fetching light level:", error)
      return null
    }
  }

  const saveSettings = async () => {
    if (!deviceIp) return

    setSavingSettings(true)
    setSettingsSaved(false)
    setError(null)

    try {
      const response = await fetch(`http://${deviceIp}/set-relay-pin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pin: Number.parseInt(pinNumber) }),
      })

      if (!response.ok) {
        throw new Error("Failed to update relay pin")
      }

      const data = await response.json()

      if (data.success) {
        if (widget.id) {
          await StorageService.updateWidget(widget.id, {
            pin: Number.parseInt(pinNumber),
          })
        }

        setSettingsSaved(true)
        setTimeout(() => {
          setSettingsOpen(false)
          setSettingsSaved(false)
        }, 1500)
      } else {
        throw new Error(data.error || "Failed to update relay pin")
      }
    } catch (err: any) {
      console.error("Error saving settings:", err)
      setError(err?.message || "Failed to save settings. Check your connection.")
    } finally {
      setSavingSettings(false)
    }
  }

  const toggleLight = async (forcedState?: boolean) => {
    if (!deviceIp) return

    setIsToggling(true)
    setError(null)

    const newState = forcedState !== undefined ? forcedState : !lightState
    console.log(`Light toggle ${lightState ? "ON" : "OFF"} -> ${newState ? "ON" : "OFF"}`)

    try {
      const response = await fetch(`http://${deviceIp}/relay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          state: newState,
          pin: widget.pin, 
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to control light")
      }

      const data = await response.json()
      console.log("Light toggle response:", data)

      if (data.success) {
        setLightState(data.state)

        if (widget.id) {
          await StorageService.updateWidgetConfiguration(widget.id, {
            ...widget.configuration,
            state: data.state,
          })
        }
      } else {
        throw new Error(data.error || "Failed to control light")
      }
    } catch (err: any) {
      console.error("Error toggling light:", err)
      setError(err?.message || "Failed to control light. Check your connection.")
    } finally {
      setIsToggling(false)
    }
  }

  const checkAndControlLight = async () => {
    if (!autoMode || !deviceIp) return

    try {
      const light = await fetchLightLevel()
      setCurrentLight(light)

      if (light === null) {
        console.log("Could not get light reading, skipping automation check")
        return
      }

      console.log(`Auto check: Current light: ${light}%, Threshold: ${lightThreshold}%`)
      setLastAutoRun(new Date())

      if (light < lightThreshold && !lightState) {
        console.log("Light below threshold, turning light ON")
        await toggleLight(true)
      }
      else if (light > lightThreshold + 10 && lightState) {
        console.log("Light above threshold + 10%, turning light OFF")
        await toggleLight(false)
      }
    } catch (error) {
      console.error("Error in automation check:", error)
    }
  }

  useEffect(() => {
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current)
      autoTimerRef.current = null
    }

    if (autoMode && deviceIp) {
      checkAndControlLight()

      const intervalMs = checkInterval * 60 * 1000 
      autoTimerRef.current = setInterval(() => {
        checkAndControlLight()
      }, intervalMs)

      setNextAutoRun(new Date(Date.now() + intervalMs))
      setCountdownActive(true)

      const countdownTimer = setInterval(() => {
        const remaining = Math.max(0, (nextAutoRun?.getTime() || 0) - Date.now()) / 1000
        setTimeRemaining(Math.floor(remaining))
      }, 1000)

      return () => {
        clearInterval(autoTimerRef.current as NodeJS.Timeout)
        clearInterval(countdownTimer)
      }
    } else {
      setCountdownActive(false)
      setTimeRemaining(0)
    }
  }, [autoMode, checkInterval, deviceIp, lightThreshold])

  const saveAutomationSettings = async () => {
    if (!widget.id) return

    try {
      await StorageService.updateWidgetConfiguration(widget.id, {
        ...widget.configuration,
        autoMode,
        lightThreshold,
        checkInterval,
      })

      console.log("Saved automation settings to database")
    } catch (error) {
      console.error("Failed to save automation settings:", error)
    }
  }

  useEffect(() => {
    if (
      widget.id &&
      (autoMode !== widget.configuration?.autoMode ||
        lightThreshold !== widget.configuration?.lightThreshold ||
        checkInterval !== widget.configuration?.checkInterval)
    ) {
      saveAutomationSettings()
    }
  }, [autoMode, lightThreshold, checkInterval])

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onDelete(widget.id)
    } catch (error) {
      console.error("Error deleting widget:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  const formatTimeRemaining = () => {
    if (timeRemaining <= 0) return "Running now..."

    const minutes = Math.floor(timeRemaining / 60)
    const seconds = Math.floor(timeRemaining % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className={`h-4 w-4 ${lightState ? "text-yellow-500" : ""}`} />
            {widget.name}
          </CardTitle>
          <div className="flex gap-2">
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Light Control Settings</DialogTitle>
                  <DialogDescription>Configure light control parameters</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="pin-number" className="text-right">
                      Relay Pin
                    </Label>
                    <Input
                      id="pin-number"
                      value={pinNumber}
                      onChange={(e) => setPinNumber(e.target.value)}
                      className="col-span-3"
                      type="number"
                      placeholder="0"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Check interval determines how often the system checks light levels in auto mode.
                  </div>
                  {error && <div className="text-sm text-destructive">{error}</div>}
                  {settingsSaved && (
                    <div className="text-sm text-green-600 font-medium">Settings updated successfully!</div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSettingsOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={saveSettings} disabled={savingSettings}>
                    {savingSettings ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Badge>control</Badge>
          </div>
        </div>
        <CardDescription>Light Control Relay</CardDescription>
        {widget.pin !== null && <CardDescription>Pin: {widget.pin}</CardDescription>}
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Manual Control</TabsTrigger>
            <TabsTrigger value="auto">Auto Lighting</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4">
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                <span>Light</span>
                {lightState && <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>}
              </div>
              <Switch checked={lightState} onCheckedChange={() => toggleLight()} disabled={!deviceIp || isToggling} />
            </div>
            {!deviceIp && <p className="text-xs text-muted-foreground mt-2">Connect to a device to control light</p>}
            {isToggling && <p className="text-xs text-muted-foreground mt-2">Updating light state...</p>}
            {error && <p className="text-xs text-destructive mt-2">{error}</p>}
          </TabsContent>

          <TabsContent value="auto" className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-mode" className="font-medium">
                Automatic Lighting
              </Label>
              <Switch id="auto-mode" checked={autoMode} onCheckedChange={setAutoMode} disabled={!deviceIp} />
            </div>

            <div className="space-y-6 mt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Light Threshold</Label>
                  <span className="text-sm text-muted-foreground">{lightThreshold}%</span>
                </div>
                <Slider
                  disabled={!autoMode}
                  min={10}
                  max={90}
                  step={5}
                  value={[lightThreshold]}
                  onValueChange={(value) => setLightThreshold(value[0])}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Dark (10%)</span>
                  <span>Medium (50%)</span>
                  <span>Bright (90%)</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Light will turn on when light level falls below {lightThreshold}% and turn off when it rises above{" "}
                  {lightThreshold + 10}%
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Check Interval</Label>
                  <span className="text-sm text-muted-foreground">{checkInterval} minutes</span>
                </div>
                <Slider
                  disabled={!autoMode}
                  min={1}
                  max={60}
                  step={1}
                  value={[checkInterval]}
                  onValueChange={(value) => setCheckInterval(value[0])}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 min</span>
                  <span>30 min</span>
                  <span>60 min</span>
                </div>
              </div>

              {autoMode && (
                <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-md space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Sun className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium">Automation Status</span>
                  </div>

                  {currentLight !== null && (
                    <div className="flex justify-between text-sm">
                      <span>Current Light Level:</span>
                      <span className="font-medium">{Math.round(currentLight)}%</span>
                    </div>
                  )}

                  {lastAutoRun && (
                    <div className="flex justify-between text-sm">
                      <span>Last Check:</span>
                      <span>{lastAutoRun.toLocaleTimeString()}</span>
                    </div>
                  )}

                  {countdownActive && (
                    <div className="flex justify-between text-sm">
                      <span>Next Check:</span>
                      <span className="font-medium">{formatTimeRemaining()}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span>Light Status:</span>
                    <span className={`font-medium ${lightState ? "text-green-600" : "text-gray-600"}`}>
                      {lightState ? "ON" : "OFF"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto text-destructive"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          {isDeleting ? "Removing..." : "Remove"}
        </Button>
      </CardFooter>
    </Card>
  )
}
