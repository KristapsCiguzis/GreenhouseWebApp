"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Camera, Trash2, RefreshCw, Play, Pause, PowerOff, Brain, Bug } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import type { Widget } from "@/lib/supabase"

interface WebcamWidgetProps {
  widget: Widget
  deviceIp: string | null
  onDelete: (id: string) => Promise<any>
}

interface BoundingBox {
  label: string
  value: number
  x: number
  y: number
  width: number
  height: number
}

export default function WebcamWidget({ widget, deviceIp, onDelete }: WebcamWidgetProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isResetting, setIsResetting] = useState(false)
  const [mlEnabled, setMlEnabled] = useState(false)
  const [debugEnabled, setDebugEnabled] = useState(false)
  const [boundingBoxes, setBoundingBoxes] = useState<BoundingBox[]>([])
  const [rawInferenceData, setRawInferenceData] = useState<any>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)


  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null

    if (mlEnabled && streaming && deviceIp) {
      const fetchInferenceData = async () => {
        try {
          const response = await fetch(`http://${deviceIp}/inference`)
          const data = await response.json()
          
          setRawInferenceData(data) 
          
          if (data.has_results && data.bounding_boxes) {
            setBoundingBoxes(data.bounding_boxes)
          } else {
            setBoundingBoxes([])
          }
        } catch (err) {
          console.error("Failed to fetch inference results:", err)
        }
      }

 
      fetchInferenceData()
      intervalId = setInterval(fetchInferenceData, 250)
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [mlEnabled, streaming, deviceIp])

  useEffect(() => {
    if (!canvasRef.current || !imgRef.current || !mlEnabled || !streaming) return

    const canvas = canvasRef.current
    const img = imgRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return


    canvas.width = img.width || 640
    canvas.height = img.height || 480

    ctx.clearRect(0, 0, canvas.width, canvas.height)

 
    boundingBoxes.forEach((box) => {

      const scaleX = canvas.width / 96
      const scaleY = canvas.height / 96
      
    
      const padding = 10 
      const x = Math.max(0, (box.x * scaleX) - padding)
      const y = Math.max(0, (box.y * scaleY) - padding)
      const width = Math.min(canvas.width - x, (box.width * scaleX) + (padding * 2))
      const height = Math.min(canvas.height - y, (box.height * scaleY) + (padding * 2))

   
      if (box.label === "ripe") {
        ctx.strokeStyle = "#00ff00" // Green for ripe
        ctx.fillStyle = "rgba(0, 255, 0, 0.2)"
      } else if (box.label === "notripe") {
        ctx.strokeStyle = "#ff0000" // Red for not ripe
        ctx.fillStyle = "rgba(255, 0, 0, 0.2)"
      } else {
       
      }


      ctx.lineWidth = 3
      ctx.strokeRect(x, y, width, height)
      ctx.fillRect(x, y, width, height)

 
      ctx.font = "16px Arial"
      ctx.fillStyle = ctx.strokeStyle
      const percentage = Math.round(box.value * 100)
      

      const text = `${box.label} ${percentage}%`
      const textMetrics = ctx.measureText(text)
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
      ctx.fillRect(x, y - 20, textMetrics.width + 6, 20)
      

      ctx.fillStyle = ctx.strokeStyle
      ctx.fillText(text, x + 3, y - 5)
    })
  }, [boundingBoxes, mlEnabled, streaming])


  const toggleMlVision = () => {
    setMlEnabled(!mlEnabled)
    if (!mlEnabled) {
      setBoundingBoxes([])
      setRawInferenceData(null)
    }
  }


  useEffect(() => {
    if (!streaming) {
      setMlEnabled(false)
      setBoundingBoxes([])
      setRawInferenceData(null)
    }
  }, [streaming])

  const toggleDebug = () => {
    setDebugEnabled(!debugEnabled)
  }


  const toggleStreaming = async () => {
    if (streaming) {
      setStreamUrl(null)
      setStreaming(false)
      setError(null)
      setBoundingBoxes([])
      setRawInferenceData(null)

      if (deviceIp) {
        try {
          await fetch(`http://${deviceIp}/reset-streams`, {
            method: "GET",
            cache: "no-store",
          })
        } catch (err) {
          console.warn("Failed to reset streams:", err)
        }
      }
      return
    }

    if (!deviceIp) {
      setError("No device connected")
      return
    }

    setLoading(true)
    setError(null)

    try {
      try {
        await fetch(`http://${deviceIp}/reset-camera`, {
          method: "GET",
          cache: "no-store",
        })
        await new Promise((resolve) => setTimeout(resolve, 2000))
      } catch (err) {
        console.warn("Camera reset failed, continuing:", err)
      }

      const timestamp = Date.now()
      const fullStreamUrl = `http://${deviceIp}/stream?t=${timestamp}`
      setStreamUrl(fullStreamUrl)
      setStreaming(true)
      setLastUpdated(new Date())
    } catch (err) {
      setError("Failed to connect to camera")
    } finally {
      setLoading(false)
    }
  }

  const resetCamera = async () => {
    if (!deviceIp) return

    setIsResetting(true)
    setLoading(true)
    setError(null)

    try {
      await fetch(`http://${deviceIp}/hard-reset`, {
        method: "GET",
        cache: "no-store",
      })

      setStreamUrl(null)
      setStreaming(false)
      setBoundingBoxes([])
      setRawInferenceData(null)
      setError("Camera reset. Please wait 10 seconds before reconnecting.")

      setTimeout(() => {
        setError(null)
      }, 10000)
    } catch (err) {
      setError("Failed to reset camera. Try power cycling the device.")
    } finally {
      setLoading(false)
      setIsResetting(false)
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

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center gap-2">
            <Camera className="h-4 w-4" />
            {widget.name}
          </CardTitle>
          <Badge>camera</Badge>
        </div>
        <CardDescription>Ripe pepper detector</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="space-y-4">
        <div className="flex items-center space-x-4 ml-auto">
            <div className="flex items-center space-x-2">
              <Label htmlFor="ml-mode" className="flex items-center text-sm">
                <Brain className="h-4 w-4 mr-1" />
                ML Vision
              </Label>
              <Switch
                id="ml-mode"
                checked={mlEnabled}
                onCheckedChange={toggleMlVision}
                disabled={!streaming}
              />
            </div>
            {mlEnabled && (
              <div className="flex items-center space-x-2">
                <Label htmlFor="debug-mode" className="flex items-center text-sm">
                  <Bug className="h-4 w-4 mr-1" />
                  Debug
                </Label>
                <Switch
                  id="debug-mode"
                  checked={debugEnabled}
                  onCheckedChange={toggleDebug}
                />
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-[320px] bg-muted rounded-md">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {isResetting ? "Resetting camera..." : "Connecting to camera..."}
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-[320px] bg-muted rounded-md">
              <div className="text-center text-destructive space-y-2">
                <Camera className="h-8 w-8 mx-auto" />
                <p>{error}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={resetCamera} disabled={!deviceIp}>
                  Reset Camera
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative w-full h-[320px] bg-black rounded-md overflow-hidden">
              {!streaming ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-muted-foreground">
                    <Camera className="h-8 w-8 mx-auto mb-2" />
                    <p>Camera stream not active</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={toggleStreaming}
                      disabled={!deviceIp || loading}
                    >
                      Start Stream
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <img
                    ref={imgRef}
                    src={streamUrl || ""}
                    alt="Camera Stream"
                    className="w-full h-full object-contain"
                    crossOrigin="anonymous"
                    onError={() => {
                      setError("Stream error, retrying...")
                      setTimeout(() => {
                        if (streaming && deviceIp) {
                          setStreamUrl(`http://${deviceIp}/stream?t=${Date.now()}`)
                          setError(null)
                        }
                      }, 3000)
                    }}
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none"
                    style={{ display: mlEnabled ? 'block' : 'none' }}
                  />
                </>
              )}
            </div>
          )}

          {mlEnabled && boundingBoxes.length > 0 && (
            <div className="text-xs bg-slate-100 p-2 rounded max-h-20 overflow-y-auto">
              <div className="font-semibold flex items-center justify-between">
                <span>Detected Objects:</span>
                <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">
                  {boundingBoxes.length} objects
                </span>
              </div>
              <div className="mt-1 text-gray-900">
                {boundingBoxes.map((box, index) => (
                  <div key={index}>
                    {box.label}: {Math.round(box.value * 100)}% at [{box.x}, {box.y}]
                  </div>
                ))}
              </div>
            </div>
          )}

          {mlEnabled && debugEnabled && rawInferenceData && (
            <div className="text-xs bg-gray-100 text-gray-900 p-2 rounded max-h-40 overflow-y-auto font-mono">
              <div className="font-semibold mb-1 text-gray-900">Debug Information:</div>
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(rawInferenceData, null, 2)}
              </pre>
            </div>
          )}

          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="flex gap-2">
              {streaming ? (
                <Button variant="destructive" onClick={toggleStreaming} disabled={!deviceIp || loading}>
                  <Pause className="mr-2 h-4 w-4" />
                  Stop Stream
                </Button>
              ) : (
                <Button variant="default" onClick={toggleStreaming} disabled={!deviceIp || loading}>
                  <Play className="mr-2 h-4 w-4" />
                  Start Stream
                </Button>
              )}
              <Button
                variant="outline"
                onClick={resetCamera}
                disabled={!deviceIp || isResetting}
                className="bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
              >
                <PowerOff className="mr-2 h-4 w-4" />
                Hard Reset
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {lastUpdated && (
                <span className="text-xs text-muted-foreground">Started: {lastUpdated.toLocaleTimeString()}</span>
              )}
            </div>
          </div>
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
