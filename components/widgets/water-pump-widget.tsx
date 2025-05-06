"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Droplet, Trash2, Settings } from "lucide-react"
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
import { StorageService } from "@/lib/storage-service"

interface WaterPumpWidgetProps {
  widget: Widget
  deviceIp: string | null
  onDelete: (id: string) => Promise<any>
}

export default function WaterPumpWidget({ widget, deviceIp, onDelete }: WaterPumpWidgetProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [pumpState, setPumpState] = useState(widget.configuration?.state || false)
  const [manualPumpState, setManualPumpState] = useState(false)
  const [autoPumpState, setAutoPumpState] = useState(false)
  const [isToggling, setIsToggling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pinNumber, setPinNumber] = useState(widget.pin?.toString() || "5")
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  // Initialize activeTab based on saved autoMode configuration
  const [activeTab, setActiveTab] = useState(widget.configuration?.autoMode ? "auto" : "manual")
  const [autoMode, setAutoMode] = useState(widget.configuration?.autoMode || false)
  const [minMoistureLevel, setMinMoistureLevel] = useState(widget.configuration?.minMoistureLevel || 30)
  const [checkInterval, setCheckInterval] = useState(widget.configuration?.checkInterval || 15)
  const [pumpDuration, setPumpDuration] = useState(widget.configuration?.pumpDuration || 30)
  const [currentMoisture, setCurrentMoisture] = useState<number | null>(null)
  const [lastAutoRun, setLastAutoRun] = useState<Date | null>(null)
  const [nextAutoRun, setNextAutoRun] = useState<Date | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [countdownActive, setCountdownActive] = useState(false)
  const [pumpRuntime, setPumpRuntime] = useState<number>(0)
  const [pumpStartTime, setPumpStartTime] = useState<Date | null>(null)

  const autoTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pumpTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Initialize state based on current mode and saved configuration
    if (widget.configuration?.state) {
      if (autoMode) {
        setAutoPumpState(widget.configuration.state)
      } else {
        setManualPumpState(widget.configuration.state)
      }
    }
  }, [widget.configuration?.state, autoMode])

  useEffect(() => {
    if (activeTab === "manual") {
      setPumpState(manualPumpState)
    } else {
      setPumpState(autoPumpState)
    }
  }, [activeTab, manualPumpState, autoPumpState])

  useEffect(() => {
    setActiveTab(autoMode ? "auto" : "manual")
  }, [autoMode])

  const fetchMoistureLevel = async () => {
    if (!deviceIp) return null
    try {
      const timestamp = new Date().getTime()
      const response = await fetch(`http://${deviceIp}/sensors?t=${timestamp}`, { cache: "no-store" })
      if (!response.ok) throw new Error("Failed to fetch sensor data")
      const data = await response.json()
      let moistureValue = null
      if (data.sensors && Array.isArray(data.sensors)) {
        const moistureSensor = data.sensors.find(
          (sensor: any) => sensor.type === "soil" || sensor.id === "soil_moisture",
        )
        if (moistureSensor) {
          moistureValue =
            moistureSensor.percentage ||
            (moistureSensor.value !== undefined
              ? Math.max(0, Math.min(100, 100 - (moistureSensor.value / 4095) * 100))
              : null)
        }
      }
      return moistureValue
    } catch (error) {
      console.error("Error fetching moisture level:", error)
      return null
    }
  }

  const updateRelayPin = async (newPin: number) => {
    if (!deviceIp) return false
    try {
      const response = await fetch(`http://${deviceIp}/set-relay-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: newPin }),
      })
      if (!response.ok) throw new Error(`Failed to update pin: ${response.status}`)
      const data = await response.json()
      if (!data.success) throw new Error(data.error || "Failed to update pin")
      return true
    } catch (err: any) {
      console.error("Error updating relay pin:", err)
      setError(`Failed to update pin: ${err.message}`)
      return false
    }
  }

  const updateCheckInterval = async (minutes: number) => {
    if (!deviceIp) return false
    try {
      const response = await fetch(`http://${deviceIp}/set-pump-check-interval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval: minutes * 60 * 1000 }),
      })
      if (!response.ok) throw new Error(`Failed to update check interval: ${response.status}`)
      const data = await response.json()
      if (!data.success) throw new Error(data.error || "Failed to update check interval")
      return true
    } catch (err: any) {
      console.error("Error updating check interval:", err)
      setError(`Failed to update check interval: ${err.message}`)
      return false
    }
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    setSettingsSaved(false)
    setError(null)
    try {
      const intervalSuccess = await updateCheckInterval(checkInterval)
      if (!intervalSuccess) throw new Error("Failed to update check interval")

      if (widget.id) {
        await StorageService.updateWidgetConfiguration(widget.id, {
          ...widget.configuration,
          checkInterval,
        })
      }

      setSettingsSaved(true)
      setTimeout(() => {
        setSettingsOpen(false)
        setSettingsSaved(false)
      }, 1500)
    } catch (err: any) {
      console.error("Error saving settings:", err)
      setError(err.message || "Failed to save settings")
    } finally {
      setSavingSettings(false)
    }
  }

  const togglePump = async (forcedState?: boolean, autoShutdown = false, isAutoMode = false) => {
    if (!deviceIp) return
    setIsToggling(true)
    setError(null)
    const newState = forcedState !== undefined ? forcedState : !pumpState
    try {
      const response = await fetch(`http://${deviceIp}/relay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: newState }),
      })
      if (!response.ok) throw new Error(`Failed to control water pump: ${response.status}`)
      const data = await response.json()
      if (data.success) {
        if (isAutoMode) {
          setAutoPumpState(newState)
          if (activeTab === "auto") setPumpState(newState)
        } else {
          setManualPumpState(newState)
          if (activeTab === "manual") setPumpState(newState)
        }
        if (widget.id) {
          await StorageService.updateWidgetConfiguration(widget.id, {
            ...widget.configuration,
            state: activeTab === "manual" ? newState : widget.configuration?.state,
            autoMode,
          })
        }
        if (newState && autoShutdown) {
          if (pumpTimerRef.current) clearTimeout(pumpTimerRef.current)
          setPumpStartTime(new Date())
          setPumpRuntime(0)
          pumpTimerRef.current = setTimeout(() => {
            togglePump(false, false, isAutoMode)
            setPumpStartTime(null)
          }, pumpDuration * 1000)
          const runtimeTimer = setInterval(() => {
            if (pumpStartTime) {
              const elapsed = Math.floor((Date.now() - pumpStartTime.getTime()) / 1000)
              setPumpRuntime(elapsed)
              if (elapsed >= pumpDuration) clearInterval(runtimeTimer)
            }
          }, 1000)
          return () => clearInterval(runtimeTimer)
        } else if (!newState) {
          if (pumpTimerRef.current) {
            clearTimeout(pumpTimerRef.current)
            pumpTimerRef.current = null
          }
          setPumpStartTime(null)
          setPumpRuntime(0)
        }
      } else {
        throw new Error(data.error || "Failed to control water pump")
      }
    } catch (err: any) {
      console.error("Error toggling water pump:", err)
      setError(err.message || "Failed to control water pump")
    } finally {
      setIsToggling(false)
    }
  }

  const checkAndControlPump = async () => {
    if (!autoMode || !deviceIp) return
    try {
      const moisture = await fetchMoistureLevel()
      setCurrentMoisture(moisture)
      if (moisture === null) return
      setLastAutoRun(new Date())
      if (moisture < minMoistureLevel && !autoPumpState) {
        await togglePump(true, true, true)
      } else if (moisture > minMoistureLevel + 10 && autoPumpState) {
        await togglePump(false, false, true)
      }
      const nextRunDate = new Date(Date.now() + checkInterval * 60 * 1000)
      setNextAutoRun(nextRunDate)
      setTimeRemaining(checkInterval * 60)
    } catch (error) {
      console.error("Error in automation check:", error)
    }
  }

  const handleAutoModeToggle = async (newAutoMode: boolean) => {
    if (newAutoMode) {
      if (manualPumpState) {
        await togglePump(false, false, false)
      }
      setManualPumpState(false)
    } else {
      if (autoPumpState) {
        await togglePump(false, false, true)
      }
      setAutoPumpState(false)
    }
    setAutoMode(newAutoMode)
  }

  useEffect(() => {
    if (autoTimerRef.current) clearInterval(autoTimerRef.current)
    if (autoMode && deviceIp) {
      checkAndControlPump()
      const intervalMs = checkInterval * 60 * 1000
      const nextRunDate = new Date(Date.now() + intervalMs)
      setNextAutoRun(nextRunDate)
      setTimeRemaining(checkInterval * 60)
      setCountdownActive(true)
      const countdownTimer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setTimeout(() => checkAndControlPump(), 0)
            return checkInterval * 60
          }
          return prev - 1
        })
      }, 1000)
      autoTimerRef.current = countdownTimer
      return () => clearInterval(countdownTimer)
    } else {
      setCountdownActive(false)
      setTimeRemaining(0)
    }
  }, [autoMode, checkInterval, deviceIp, minMoistureLevel])

  useEffect(() => {
    return () => {
      if (autoTimerRef.current) clearInterval(autoTimerRef.current)
      if (pumpTimerRef.current) clearTimeout(pumpTimerRef.current)
    }
  }, [])

  const saveAutomationSettings = async () => {
    if (!widget.id) return
    try {
      await StorageService.updateWidgetConfiguration(widget.id, {
        ...widget.configuration,
        autoMode,
        minMoistureLevel,
        checkInterval,
        pumpDuration,
      })
    } catch (error) {
      console.error("Failed to save automation settings:", error)
    }
  }

  useEffect(() => {
    if (
      widget.id &&
      (autoMode !== widget.configuration?.autoMode ||
        minMoistureLevel !== widget.configuration?.minMoistureLevel ||
        checkInterval !== widget.configuration?.checkInterval ||
        pumpDuration !== widget.configuration?.pumpDuration)
    ) {
      saveAutomationSettings()
    }
  }, [autoMode, minMoistureLevel, checkInterval, pumpDuration])

  useEffect(() => {
    const fetchPumpState = async () => {
      if (!deviceIp) return
      try {
        const response = await fetch(`http://${deviceIp}/relay`)
        if (response.ok) {
          const data = await response.json()
          // Only update the state that corresponds to the current mode
          if (autoMode) {
            setAutoPumpState(data.state)
            if (activeTab === "auto") setPumpState(data.state)
          } else {
            setManualPumpState(data.state)
            if (activeTab === "manual") setPumpState(data.state)
          }
          if (widget.id && data.state !== widget.configuration?.state) {
            await StorageService.updateWidgetConfiguration(widget.id, {
              ...widget.configuration,
              state: data.state,
            })
          }
        }
      } catch (err) {
        console.error("Error fetching pump state:", err)
      }
    }
    fetchPumpState()
  }, [deviceIp, autoMode])

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    if (value === "manual") {
      setPumpState(manualPumpState)
    } else {
      setPumpState(autoPumpState)
    }
  }

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
    const minutes = Math.floor(Math.max(0, timeRemaining) / 60)
    const seconds = Math.floor(Math.max(0, timeRemaining) % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const formatPumpRuntime = () => {
    if (!pumpState || !pumpStartTime) return "00:00"
    const runtime = pumpRuntime
    const minutes = Math.floor(runtime / 60)
    const seconds = runtime % 60
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  const handleManualPumpToggle = () => {
    togglePump(!manualPumpState, false, false)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center gap-2">
            <Droplet className={`h-4 w-4 ${pumpState ? "text-red-500" : ""}`} />
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
                  <DialogTitle>Water Pump Settings</DialogTitle>
                  <DialogDescription>Configure the water pump relay</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="check-interval">Check Interval</Label>
                      <span className="text-sm text-muted-foreground">{checkInterval} minutes</span>
                    </div>
                    <Slider
                      id="check-interval"
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
                  <div className="text-sm text-muted-foreground">
                    Default pin for water pump relay is 5. Check interval determines how often the system checks
                    moisture levels in auto mode.
                  </div>
                  {error && <div className="text-sm text-destructive">{error}</div>}
                  {settingsSaved && <div className="text-sm text-green-600 font-medium">Settings saved!</div>}
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
        <CardDescription>Water Pump Relay Control</CardDescription>
        {widget.pin !== null && <CardDescription>Pin: {widget.pin}</CardDescription>}
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} className="w-full" onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Manual Control</TabsTrigger>
            <TabsTrigger value="auto">Auto Irrigation</TabsTrigger>
          </TabsList>
          <TabsContent value="manual" className=" awful space-y-4">
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                <span>Water Pump</span>
                {manualPumpState && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>}
              </div>
              <Switch
                checked={manualPumpState}
                onCheckedChange={handleManualPumpToggle}
                disabled={!deviceIp || isToggling || autoMode}
              />
            </div>
            {manualPumpState && pumpStartTime && (
              <div className="text-sm mt-2">
                Runtime: <span className="font-medium">{formatPumpRuntime()}</span>
              </div>
            )}
            {!deviceIp && (
              <p className="text-xs text-muted-foreground mt-2">Connect to a device to control water pump</p>
            )}
            {isToggling && <p className="text-xs text-muted-foreground mt-2">Updating pump state...</p>}
            {autoMode && (
              <p className="text-xs text-muted-foreground mt-2">
                Manual control is disabled while Auto Irrigation is active.
              </p>
            )}
            {error && <p className="text-xs text-destructive mt-2">{error}</p>}
          </TabsContent>
          <TabsContent value="auto" className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-mode" className="font-medium">
                Automatic Irrigation
              </Label>
              <Switch id="auto-mode" checked={autoMode} onCheckedChange={handleAutoModeToggle} disabled={!deviceIp} />
            </div>
            <div className="space-y-6 mt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Minimum Moisture Level</Label>
                  <span className="text-sm text-muted-foreground">{minMoistureLevel}%</span>
                </div>
                <Slider
                  min={10}
                  max={90}
                  step={5}
                  value={[minMoistureLevel]}
                  onValueChange={(value) => setMinMoistureLevel(value[0])}
                  disabled={!deviceIp}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Dry (10%)</span>
                  <span>Moist (50%)</span>
                  <span>Wet (90%)</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Pump will turn on when moisture falls below {minMoistureLevel}% and turn off when it rises above{" "}
                  {minMoistureLevel + 10}%
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Check Interval</Label>
                  <span className="text-sm text-muted-foreground">{checkInterval} minutes</span>
                </div>
                <Slider
                  min={1}
                  max={60}
                  step={1}
                  value={[checkInterval]}
                  onValueChange={(value) => setCheckInterval(value[0])}
                  disabled={!deviceIp}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 min</span>
                  <span>30 min</span>
                  <span>60 min</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Pump Duration</Label>
                  <span className="text-sm text-muted-foreground">{pumpDuration} seconds</span>
                </div>
                <Slider
                  min={5}
                  max={120}
                  step={5}
                  value={[pumpDuration]}
                  onValueChange={(value) => setPumpDuration(value[0])}
                  disabled={!deviceIp}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>5 sec</span>
                  <span>60 sec</span>
                  <span>120 sec</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Pump will automatically turn off after {pumpDuration} seconds of operation
                </p>
              </div>
              {autoMode && (
                <div className="bg-red-50 dark:bg-red-950 p-3 rounded-md space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">Automation Status</span>
                  </div>
                  {currentMoisture !== null && (
                    <div className="flex justify-between text-sm">
                      <span>Current Moisture:</span>
                      <span className="font-medium">{Math.round(currentMoisture)}%</span>
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
                      <span className="font-medium">
                        {timeRemaining <= 0 ? `${formatTimeRemaining()} (Running...)` : formatTimeRemaining()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span>Pump Status:</span>
                    <span className={`font-medium ${autoPumpState ? "text-green-600" : "text-gray-600"}`}>
                      {autoPumpState ? "RUNNING" : "OFF"}
                    </span>
                  </div>
                  {autoPumpState && pumpStartTime && (
                    <div className="flex justify-between text-sm">
                      <span>Runtime:</span>
                      <span className="font-medium">
                        {formatPumpRuntime()} / {Math.floor(pumpDuration / 60)}:
                        {(pumpDuration % 60).toString().padStart(2, "0")}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 rounded-md">
          <p className="text-xs text-red-700 dark:text-red-300">
            <strong>Warning:</strong> Water can cause damage!!!!.
          </p>
        </div>
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
