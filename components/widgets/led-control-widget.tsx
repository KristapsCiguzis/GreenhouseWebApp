"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Power, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { Widget } from "@/lib/supabase"

interface LedControlWidgetProps {
  widget: Widget
  deviceIp: string | null
  onDelete: (id: string) => Promise<any>
  ledStatus: boolean
  onToggle: (widget: Widget) => Promise<void>
}

export default function LedControlWidget({ widget, deviceIp, onDelete, ledStatus, onToggle }: LedControlWidgetProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isToggling, setIsToggling] = useState(false)

  const displayLedStatus = ledStatus

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

  const handleToggle = async () => {
    if (!deviceIp) return

    setIsToggling(true)
    console.log("LED toggle clicked, current status:", ledStatus)

    try {
      const response = await fetch(`http://${deviceIp}/led`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          state: !ledStatus,
          pin: widget.pin,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to control LED")
      }

      const data = await response.json()
      console.log("LED toggle response:", data)

      if (data.success) {
        onToggle(widget)
      } else {
        throw new Error(data.error || "Failed to control LED")
      }
    } catch (error) {
      console.error("Error toggling LED:", error)
    } finally {
      setIsToggling(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center gap-2">
            <Power className={`h-4 w-4 ${displayLedStatus ? "text-yellow-500" : ""}`} />
            {widget.name}
          </CardTitle>
          <Badge>control</Badge>
        </div>
        <CardDescription>Type: {widget.sensor_type}</CardDescription>
        {widget.pin !== null && <CardDescription>Pin: {widget.pin}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>Toggle</span>
            {displayLedStatus && <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>}
          </div>
          <Switch checked={displayLedStatus} onCheckedChange={handleToggle} disabled={!deviceIp || isToggling} />
        </div>
        {!deviceIp && <p className="text-xs text-muted-foreground mt-2">Connect to device to control LED</p>}
        {isToggling && <p className="text-xs text-muted-foreground mt-2">Updating LED state...</p>}
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
