"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Thermometer, Droplets, Trash2, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { Widget } from "@/lib/supabase"

interface TempHumidityWidgetProps {
  widget: Widget
  deviceIp: string | null
  onDelete: (id: string) => Promise<any>
}

export default function TempHumidityWidget({ widget, deviceIp, onDelete }: TempHumidityWidgetProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [temperature, setTemperature] = useState<number | null>(null)
  const [humidity, setHumidity] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const isRefreshing = useRef(false)
  const refreshInterval = 5000

  const fetchSensorData = async () => {
    if (!deviceIp) {
      setError("No device IP address available")
      return
    }

    if (!isRefreshing.current) {
      setLoading(true)
    }
    setError(null)

    try {
      console.log("Fetching sensor data from:", `http://${deviceIp}/sensors`)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const timestamp = new Date().getTime()
      const response = await fetch(`http://${deviceIp}/sensors?t=${timestamp}`, {
        cache: "no-store",
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId))

      if (response.ok) {
        const data = await response.json()
        const tempSensor = data.sensors.find((s: any) => s.type === "temperature")
        const humiditySensor = data.sensors.find((s: any) => s.type === "humidity")

        if (tempSensor && humiditySensor) {
          setTemperature(tempSensor.value || 0)
          setHumidity(humiditySensor.value || 0)
          setError(null)
        } else {
          setError("Temperature or humidity sensor data not found")
        }
      } else {
        setError(`Error: ${response.status} ${response.statusText}`)
      }
      setLastUpdated(new Date())
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.error("Timeout fetching sensor data")
        setError("Connection timeout. Please try again.")
      } else {
        console.error("Error fetching sensor data:", err)
        setError(`Failed to read sensors: ${err.message || "Unknown error"}`)
      }
    } finally {
      if (!isRefreshing.current) {
        setLoading(false)
      }
      isRefreshing.current = false
    }
  }

  useEffect(() => {
    if (deviceIp) {
      fetchSensorData()

      const interval = setInterval(() => {
        isRefreshing.current = true
        fetchSensorData()
      }, refreshInterval)

      return () => clearInterval(interval)
    }
  }, [deviceIp])

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

  const getTemperatureColor = () => {
    if (temperature === null) return "text-gray-500"
    if (temperature < 10) return "text-blue-500"
    if (temperature < 25) return "text-green-500"
    return "text-red-500"
  }

  const getHumidityColor = () => {
    if (humidity === null) return "text-gray-500"
    if (humidity < 30) return "text-orange-500"
    if (humidity < 70) return "text-green-500"
    return "text-blue-500"
  }

  const tempDisplay = temperature !== null ? `${temperature.toFixed(1)}°C` : "N/A"
  const humidityDisplay = humidity !== null ? `${humidity.toFixed(1)}%` : "N/A"
  const lastUpdatedDisplay = lastUpdated ? lastUpdated.toLocaleTimeString() : ""

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-red-500" />
            {widget.name}
          </CardTitle>
          <Badge>sensor</Badge>
        </div>
        <CardDescription>Temperature & Humidity Sensor</CardDescription>
        {widget.pin !== null && <CardDescription>Pin: {widget.pin}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center items-center h-32 text-sm text-muted-foreground">Loading...</div>
          ) : error ? (
            <div className="flex justify-center items-center h-32 text-sm text-destructive">{error}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col items-center p-3 border rounded-md h-24 justify-center">
                  <Thermometer className={`h-5 w-5 mb-1 ${getTemperatureColor()}`} />
                  <span className="text-sm font-medium">Temperature</span>
                  <div className="h-7"> 
                    <span className={`text-lg font-bold ${getTemperatureColor()}`} id="temp-value">
                      {tempDisplay}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-center p-3 border rounded-md h-24 justify-center">
                  <Droplets className={`h-5 w-5 mb-1 ${getHumidityColor()}`} />
                  <span className="text-sm font-medium">Humidity</span>
                  <div className="h-7"> 
                    <span className={`text-lg font-bold ${getHumidityColor()}`} id="humidity-value">
                      {humidityDisplay}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Auto-updates every {refreshInterval / 1000} seconds</span>
              </div>

              <div className="h-4"> 
                {lastUpdated && (
                  <div className="text-xs text-muted-foreground text-center" id="last-updated">
                    Last updated: {lastUpdatedDisplay}
                  </div>
                )}
              </div>
            </>
          )}
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
