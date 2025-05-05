"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, Send, Eye, EyeOff, Trash2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface DatabaseConnectionManagerProps {
  esp32Devices?: string[];
}

export default function DatabaseConnectionManager({ esp32Devices = [] }: DatabaseConnectionManagerProps) {
  const [loading, setIsLoading] = useState(false)
  const [sendingToEsp32, setSendingToEsp32] = useState(false)
  const [clearingConfig, setClearingConfig] = useState(false)
  const [selectedEsp32Ip, setSelectedEsp32Ip] = useState<string | null>(null)
  const [supabaseUrl, setSupabaseUrl] = useState("")
  const [supabaseApiKey, setSupabaseApiKey] = useState("")
  const [showApiKey, setShowApiKey] = useState(false)
  const [sendTemperature, setSendTemperature] = useState(true)
  const [sendHumidity, setSendHumidity] = useState(true)
  const [sendSoilMoisture, setSendSoilMoisture] = useState(true)
  const [sendLightLevel, setSendLightLevel] = useState(true)
  const [sendLedState, setSendLedState] = useState(true)
  const [sendRelayState, setSendRelayState] = useState(true)
  const [sendLightRelayState, setSendLightRelayState] = useState(true)
  const [sendLightAutoMode, setSendLightAutoMode] = useState(true)
  
  // Initialize with 1 hour as default
  const [temperatureHours, setTemperatureHours] = useState("1")
  const [humidityHours, setHumidityHours] = useState("1")
  const [soilMoistureHours, setSoilMoistureHours] = useState("1")
  const [lightLevelHours, setLightLevelHours] = useState("1")
  
  // For confirmation message
  const [lastSuccess, setLastSuccess] = useState<string | null>(null)

  // Convert milliseconds to hours, rounding to 1 decimal place
  const convertMsToHours = (ms: number) => {
    return (Math.round(ms / 3600000 * 10) / 10).toString()
  }

  // Convert hours to milliseconds
  const convertHoursToMs = (hours: string) => {
    return Math.round(parseFloat(hours) * 3600000)
  }

  const fetchSettings = async (ip: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`http://${ip}/get-supabase-config`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch settings from ESP32 at ${ip}: ${response.statusText}`)
      }

      const data = await response.json()
      setSupabaseUrl(data.supabaseUrl || "")
      setSupabaseApiKey(data.supabaseApiKey || "")
      setSendTemperature(data.dataConfig?.sendTemperature ?? true)
      setSendHumidity(data.dataConfig?.sendHumidity ?? true)
      setSendSoilMoisture(data.dataConfig?.sendSoilMoisture ?? true)
      setSendLightLevel(data.dataConfig?.sendLightLevel ?? true)
      setSendLedState(data.dataConfig?.sendLedState ?? true)
      setSendRelayState(data.dataConfig?.sendRelayState ?? true)
      setSendLightRelayState(data.dataConfig?.sendLightRelayState ?? true)
      setSendLightAutoMode(data.dataConfig?.sendLightAutoMode ?? true)
      
      // Just set everything to 1
      setTemperatureHours("1")
      setHumidityHours("1")
      setSoilMoistureHours("1")
      setLightLevelHours("1")

      toast({
        title: "Success",
        description: `Loaded settings from ESP32 at ${ip}.`,
      })
    } catch (error: any) {
      console.error(`Error fetching settings from ESP32 at ${ip}:`, error)
      let errorMessage = error.message
      if (error.message.includes("Failed to fetch")) {
        errorMessage = `Cannot reach ESP32 at ${ip}. Ensure it is online and accessible.`
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEsp32Selection = (ip: string) => {
    setSelectedEsp32Ip(ip)
    if (ip) {
      fetchSettings(ip)
    } else {
      setSupabaseUrl("")
      setSupabaseApiKey("")
      setSendTemperature(true)
      setSendHumidity(true)
      setSendSoilMoisture(true)
      setSendLightLevel(true)
      setSendLedState(true)
      setSendRelayState(true)
      setSendLightRelayState(true)
      setSendLightAutoMode(true)
      setTemperatureHours("1")
      setHumidityHours("1")
      setSoilMoistureHours("1")
      setLightLevelHours("1")
    }
  }

  useEffect(() => {
    if (esp32Devices.length > 0) {
      if (!selectedEsp32Ip || !esp32Devices.includes(selectedEsp32Ip)) {
        setSelectedEsp32Ip(esp32Devices[0])
        fetchSettings(esp32Devices[0])
      }
    } else {
      setSelectedEsp32Ip(null)
      handleEsp32Selection("")
    }
  }, [esp32Devices])

  const sendSettingsToEsp32 = async () => {
    if (!selectedEsp32Ip) {
      toast({
        title: "Error",
        description: "No ESP32 device selected. Please select a device from the dropdown.",
        variant: "destructive",
      })
      return
    }

    if (!supabaseUrl || !supabaseApiKey) {
      toast({
        title: "Error",
        description: "Supabase URL and API Key are required to configure the ESP32.",
        variant: "destructive",
      })
      return
    }

    if (!supabaseUrl.startsWith("https://")) {
      toast({
        title: "Error",
        description: "Supabase URL must start with 'https://'.",
        variant: "destructive",
      })
      return
    }

    if (supabaseApiKey.length < 32) {
      toast({
        title: "Error",
        description: "Supabase API Key appears too short. Please verify the key.",
        variant: "destructive",
      })
      return
    }

    // Convert all hours values to milliseconds
    const intervals = {
      temperature: convertHoursToMs(temperatureHours),
      humidity: convertHoursToMs(humidityHours),
      soilMoisture: convertHoursToMs(soilMoistureHours),
      lightLevel: convertHoursToMs(lightLevelHours),
    }

    if (
      intervals.temperature < 3600000 ||
      intervals.humidity < 3600000 ||
      intervals.soilMoisture < 3600000 ||
      intervals.lightLevel < 3600000
    ) {
      toast({
        title: "Error",
        description: "All upload intervals must be at least 1 hour.",
        variant: "destructive",
      })
      return
    }

    setSendingToEsp32(true)

    try {
      const payload = {
        supabaseUrl,
        supabaseApiKey,
        dataConfig: {
          sendTemperature,
          sendHumidity,
          sendSoilMoisture,
          sendLightLevel,
          sendLedState,
          sendRelayState,
          sendLightRelayState,
          sendLightAutoMode,
        },
        intervals,
      }

      const response = await fetch(`http://${selectedEsp32Ip}/set-supabase-config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Failed to update ESP32 configuration at ${selectedEsp32Ip}: ${response.statusText}`)
      }

      setLastSuccess(`ESP32 at ${selectedEsp32Ip} configured successfully!!`)
      
      toast({
        title: "Success",
        description: `ESP32 at ${selectedEsp32Ip} configured successfully!!!.`,
      })
    } catch (error: any) {
      console.error(`Error updating ESP32 configuration at ${selectedEsp32Ip}:`, error)
      let errorMessage = error.message
      if (error.message.includes("Failed to fetch")) {
        errorMessage = `Cannot reach ESP32 at ${selectedEsp32Ip}. Ensure it is online and accessible.`
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setSendingToEsp32(false)
    }
  }

  const clearSupabaseConfig = async () => {
    if (!selectedEsp32Ip) {
      toast({
        title: "Error",
        description: "No ESP32 device selected. Please select a device from the dropdown.",
        variant: "destructive",
      })
      return
    }

    setClearingConfig(true)

    try {
      const response = await fetch(`http://${selectedEsp32Ip}/clear-supabase-config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to clear Supabase configuration on ESP32 at ${selectedEsp32Ip}: ${response.statusText}`)
      }

      const data = await response.json()
      if (data.success) {
        setSupabaseUrl("")
        setSupabaseApiKey("")
        setLastSuccess(`Supabase config cleared on ESP32 at ${selectedEsp32Ip}!!!!`)
        toast({
          title: "Success",
          description: `Supabase URL and API Key cleared on ESP32 at ${selectedEsp32Ip}!!!!.`,
        })
      } else {
        throw new Error("Failed to clear Supabase configuration: " + (data.error || "Unknown error"))
      }
    } catch (error: any) {
      console.error(`Error clearing Supabase configuration on ESP32 at ${selectedEsp32Ip}:`, error)
      let errorMessage = error.message
      if (error.message.includes("Failed to fetch")) {
        errorMessage = `Cannot reach ESP32 at ${selectedEsp32Ip}. Ensure it is online and accessible.`
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setClearingConfig(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Database Connection Manager</CardTitle>
        <CardDescription>Configure Supabase connection settings for ESP32 devices.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* ESP32 Device Selection */}
          <div>
            <Label htmlFor="esp32-select">Select ESP32 Device</Label>
            <Select onValueChange={handleEsp32Selection} value={selectedEsp32Ip || ""}>
              <SelectTrigger id="esp32-select">
                <SelectValue placeholder="Select an ESP32 device" />
              </SelectTrigger>
              <SelectContent>
                {esp32Devices.length === 0 ? (
                  <SelectItem value="none">No ESP32 devices found</SelectItem>
                ) : (
                  esp32Devices.map((ip) => (
                    <SelectItem key={ip} value={ip}>
                      {ip}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="supabase-url">Supabase URL</Label>
              <Input
                id="supabase-url"
                type="text"
                placeholder="https://your-supabase-url.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                disabled={loading || sendingToEsp32 || clearingConfig}
              />
            </div>

            <div className="relative">
              <Label htmlFor="supabase-api-key">Supabase API Key</Label>
              <Input
                id="supabase-api-key"
                type={showApiKey ? "text" : "password"}
                placeholder="Your Supabase API Key"
                value={supabaseApiKey}
                onChange={(e) => setSupabaseApiKey(e.target.value)}
                disabled={loading || sendingToEsp32 || clearingConfig}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-9"
                onClick={() => setShowApiKey(!showApiKey)}
                disabled={loading || sendingToEsp32 || clearingConfig}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Select Data to Send to Supabase</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send-temperature"
                  checked={sendTemperature}
                  onCheckedChange={(checked) => setSendTemperature(checked as boolean)}
                  disabled={loading || sendingToEsp32 || clearingConfig}
                />
                <Label htmlFor="send-temperature">Temperature</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send-humidity"
                  checked={sendHumidity}
                  onCheckedChange={(checked) => setSendHumidity(checked as boolean)}
                  disabled={loading || sendingToEsp32 || clearingConfig}
                />
                <Label htmlFor="send-humidity">Humidity</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send-soil-moisture"
                  checked={sendSoilMoisture}
                  onCheckedChange={(checked) => setSendSoilMoisture(checked as boolean)}
                  disabled={loading || sendingToEsp32 || clearingConfig}
                />
                <Label htmlFor="send-soil-moisture">Soil Moisture</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send-light-level"
                  checked={sendLightLevel}
                  onCheckedChange={(checked) => setSendLightLevel(checked as boolean)}
                  disabled={loading || sendingToEsp32 || clearingConfig}
                />
                <Label htmlFor="send-light-level">Light Level</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send-led-state"
                  checked={sendLedState}
                  onCheckedChange={(checked) => setSendLedState(checked as boolean)}
                  disabled={loading || sendingToEsp32 || clearingConfig}
                />
                <Label htmlFor="send-led-state">LED State</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send-relay-state"
                  checked={sendRelayState}
                  onCheckedChange={(checked) => setSendRelayState(checked as boolean)}
                  disabled={loading || sendingToEsp32 || clearingConfig}
                />
                <Label htmlFor="send-relay-state">Relay State</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send-light-relay-state"
                  checked={sendLightRelayState}
                  onCheckedChange={(checked) => setSendLightRelayState(checked as boolean)}
                  disabled={loading || sendingToEsp32 || clearingConfig}
                />
                <Label htmlFor="send-light-relay-state">Light Relay State</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send-light-auto-mode"
                  checked={sendLightAutoMode}
                  onCheckedChange={(checked) => setSendLightAutoMode(checked as boolean)}
                  disabled={loading || sendingToEsp32 || clearingConfig}
                />
                <Label htmlFor="send-light-auto-mode">Light Auto Mode</Label>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <Label>Upload Intervals (hours)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="temperature-interval">Temperature</Label>
                <Input
                  id="temperature-interval"
                  type="text"
                  value={temperatureHours}
                  onChange={(e) => setTemperatureHours(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="humidity-interval">Humidity</Label>
                <Input
                  id="humidity-interval"  
                  type="text"
                  value={humidityHours}
                  onChange={(e) => setHumidityHours(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="soil-moisture-interval">Soil Moisture</Label>
                <Input
                  id="soil-moisture-interval"
                  type="text"
                  value={soilMoistureHours}
                  onChange={(e) => setSoilMoistureHours(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="light-level-interval">Light Level</Label>
                <Input
                  id="light-level-interval"
                  type="text"
                  value={lightLevelHours}
                  onChange={(e) => setLightLevelHours(e.target.value)}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Minimum interval: 1 hour.
            </p>
          </div>
          <div className="flex space-x-4">
            <Button
              onClick={sendSettingsToEsp32}
              disabled={loading || sendingToEsp32 || clearingConfig}
              className="flex-1"
            >
              {sendingToEsp32 ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send to ESP32
                </>
              )}
            </Button>
            <Button
              onClick={clearSupabaseConfig}
              disabled={loading || sendingToEsp32 || clearingConfig}
              variant="destructive"
              className="flex-1"
            >
              {clearingConfig ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear Supabase Config
                </>
              )}
            </Button>
          </div>
          {lastSuccess && (
            <div className="text-sm text-green-600 mt-4 text-center">
              {lastSuccess}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}