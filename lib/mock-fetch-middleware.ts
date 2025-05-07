const isBrowser = typeof window !== "undefined"

let originalFetch: typeof fetch | null = null

const mockData = {
  info: {
    status: "online",
    mac: "DUMMY-ESP32-MAC",
    ip: "192.168.1.200",
    device: "ESP32-DUMMY",
    uptime: 3600,
    free_heap: 120000,
  },
  led: false,
  relay: false,
  lightRelay: false,
}

function getRandomSensorData() {
  const temperature = 20 + Math.random() * 10
  const humidity = 40 + Math.random() * 40
  const lightValue = Math.floor(200 + Math.random() * 800)
  const lightPercentage = Math.min(100, Math.max(0, Math.floor((lightValue / 4095) * 100)))
  const soilMoistureValue = Math.floor(1000 + Math.random() * 3000)
  const soilMoisturePercentage = Math.min(100, Math.max(0, Math.floor(100 - (soilMoistureValue / 4095) * 100)))

  return {
    sensors: [
      {
        id: "temperature",
        type: "temperature",
        name: "Temperature Sensor",
        value: temperature,
        unit: "°C",
      },
      {
        id: "humidity",
        type: "humidity",
        name: "Humidity Sensor",
        value: humidity,
        unit: "%",
      },
      {
        id: "soil_moisture",
        type: "soil",
        name: "Soil Moisture Sensor",
        value: soilMoistureValue,
        percentage: soilMoisturePercentage,
        unit: "%",
      },
      {
        id: "light",
        type: "light",
        name: "Light Sensor",
        value: lightValue,
        percentage: lightPercentage,
        unit: "%",
      },
    ],
  }
}

export function setupMockFetch() {
  console.log("Setting up mock fetch middleware")

  if (!isBrowser) {
    console.warn("Mock fetch middleware can only be used in browser environments")
    return null
  }

  if (!originalFetch) {
    originalFetch = window.fetch
  }

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString()

    console.log(`Mock fetch intercepted: ${url}`)

    if (url.includes("192.168.1.200")) {
      console.log("Handling mock ESP32 request")

      await new Promise((resolve) => setTimeout(resolve, 300))

      if (url.includes("/info")) {
        return new Response(JSON.stringify(mockData.info), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      } else if (url.includes("/sensors")) {
        const sensorData = getRandomSensorData()
        console.log("Returning mock sensor data:", sensorData)
        return new Response(JSON.stringify(sensorData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      } else if (url.includes("/led")) {
        if (init?.method === "POST") {
          try {
            const body = init.body ? JSON.parse(init.body.toString()) : {}
            mockData.led = body.state === true
            console.log("LED state changed to:", mockData.led)
            return new Response(JSON.stringify({ success: true, state: mockData.led }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          } catch (error) {
            console.error("Error parsing LED request:", error)
            return new Response(JSON.stringify({ success: false, error: "Invalid request" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            })
          }
        }
        return new Response(JSON.stringify({ state: mockData.led }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      } else if (url.includes("/relay")) {
        if (init?.method === "POST") {
          try {
            const body = init.body ? JSON.parse(init.body.toString()) : {}
            mockData.relay = body.state === true
            console.log("Relay state changed to:", mockData.relay)
            return new Response(JSON.stringify({ success: true, state: mockData.relay }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          } catch (error) {
            console.error("Error parsing relay request:", error)
            return new Response(JSON.stringify({ success: false, error: "Invalid request" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            })
          }
        }
        return new Response(JSON.stringify({ state: mockData.relay }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      } else if (
        url.includes("/set-relay-pin") ||
        url.includes("/set-led-pin") ||
        url.includes("/set-dht-pin") ||
        url.includes("/set-moisture-pin") ||
        url.includes("/set-light-pin") ||
        url.includes("/set-pump-check-interval")
      ) {
        return new Response(JSON.stringify({ success: true, message: "Configuration updated" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      } else if (url.includes("/stream")) {
        return new Response(JSON.stringify({ success: true, url: "mock-stream-url" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      } else if (url.includes("/reset-camera") || url.includes("/reset-streams")) {
        return new Response(JSON.stringify({ success: true, message: "Reset successful" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      console.log("Unknown endpoint requested:", url)
      return new Response(JSON.stringify({ success: false, error: "Endpoint not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    }

    if (originalFetch) {
      return originalFetch(input, init)
    }

    throw new Error("Original fetch not available")
  }

  return () => {
    console.log("Cleaning up mock fetch middleware")
    if (isBrowser && originalFetch) {
      window.fetch = originalFetch
      originalFetch = null
    }
  }
}

export function cleanupMockFetch() {
  console.log("Cleaning up mock fetch middleware")
  if (isBrowser && originalFetch) {
    window.fetch = originalFetch
    originalFetch = null
  }
}
