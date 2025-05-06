"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2, Sun, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { Widget } from "@/lib/supabase"

import { Progress } from "@/components/ui/progress"

interface LightSensorWidgetProps {
  widget: Widget
  deviceIp: string | null
  onDelete: (id: string) => Promise<any>
}

export default function LightSensorWidget({ widget, deviceIp, onDelete }: LightSensorWidgetProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [lightValue, setLightValue] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshInterval, setRefreshInterval] = useState(5000)

  const isRefreshing = useRef(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchLightData = async () => {
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

      const timestamp = new Date().getTime()
      const response = await fetch(`http://${deviceIp}/sensors?t=${timestamp}`, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch sensor data: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log("Received sensor data:", data)
      setLastUpdated(new Date())
      if (data.percentage !== undefined) {
        setLightValue(data.percentage)
      } else if (data.value !== undefined) {
        const lightPercent = Math.max(0, Math.min(100, (data.value / 4095) * 100))
        setLightValue(lightPercent)
      } else if (data.sensors && Array.isArray(data.sensors)) {
        const lightSensor = data.sensors.find((sensor: any) => sensor.type === "light" || sensor.id === "light")
        if (lightSensor) {
          if (lightSensor.percentage !== undefined) {
            setLightValue(lightSensor.percentage)
          } else if (lightSensor.value !== undefined) {
            const lightPercent = Math.max(0, Math.min(100, (lightSensor.value / 4095) * 100))
            setLightValue(lightPercent)
          } else {
            setError("Light sensor data format not recognized")
          }
        } else {
          setError("Light sensor not found in response")
        }
      } else {
        setError("Could not find valid light sensor data in response")
      }
    } catch (err: unknown) {
      console.error("Error fetching light data:", err)
      setError(`Failed to read sensor: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      if (!isRefreshing.current) {
        setLoading(false)
      }
      isRefreshing.current = false
    }
  }

  const backgroundRefresh = () => {
    isRefreshing.current = true
    fetchLightData()
  }

  useEffect(() => {
    if (deviceIp) {
      fetchLightData()
      intervalRef.current = setInterval(backgroundRefresh, refreshInterval)
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    }
  }, [deviceIp, widget.pin, refreshInterval])

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

  const getLightStatus = () => {
    if (lightValue === null) return "Unknown"
    if (lightValue < 30) return "Dark"
    if (lightValue < 70) return "Medium"
    return "Bright"
  }

  const getLightColor = () => {
    if (lightValue === null) return "bg-gray-200"
    if (lightValue < 30) return "bg-blue-500"
    if (lightValue < 70) return "bg-yellow-500"
    return "bg-orange-500"
  }
  const lightDisplay = lightValue !== null ? `${Math.round(lightValue)}%` : "N/A"
  const lightStatus = getLightStatus()
  const lastUpdatedDisplay = lastUpdated ? lastUpdated.toLocaleTimeString() : ""

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sun className="h-4 w-4 text-yellow-500" />
            {widget.name}
          </CardTitle>
          <div className="flex gap-2">
            <Badge>sensor</Badge>
          </div>
        </div>
        <CardDescription>Light Sensor</CardDescription>
        {widget.pin !== null && <CardDescription>Pin: {widget.pin}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground">Loading...</div>
          ) : error ? (
            <div className="text-center text-sm text-destructive">{error}</div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Light Level:</span>
                <span className="text-sm" id="light-value">
                  {lightDisplay}
                </span>
              </div>
              <Progress value={lightValue || 0} className={`h-2 ${getLightColor()}`} />
              <div className="text-center text-sm font-medium" id="light-status">
                Status: {lightStatus}
              </div>

              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Updates every {refreshInterval / 1000} seconds</span>
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
