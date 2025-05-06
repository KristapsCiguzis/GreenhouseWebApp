import { MockESP32Api } from "./mock-esp32-api"
const DUMMY_IP = "192.168.1.200"
export function setupMockFetch() {
  if (typeof window === "undefined") return

  const originalFetch = window.fetch


  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString()
    if (url.includes(DUMMY_IP)) {
      return handleMockRequest(url, init)
    }

    return originalFetch(input, init)
  }


  return () => {
    window.fetch = originalFetch
  }
}


export function cleanupMockFetch() {

}


async function handleMockRequest(url: string, init?: RequestInit): Promise<Response> {
  const mockApi = MockESP32Api.getInstance()
  let responseData: any

  const endpoint = url.split(DUMMY_IP)[1].split("?")[0]

  let body: any = null
  if (init?.body) {
    try {
      body = JSON.parse(init.body.toString())
    } catch (e) {
      console.error("Failed to parse request body:", e)
    }
  }


  await new Promise((resolve) => setTimeout(resolve, 200))
  switch (endpoint) {
    case "/info":
      responseData = await mockApi.getInfo()
      break
    case "/sensors":
      responseData = await mockApi.getSensors()
      break
    case "/led":
      if (init?.method === "POST" && body) {
        responseData = await mockApi.setLedState(body.state)
      } else {
        responseData = await mockApi.getLedState()
      }
      break
    case "/relay":
      if (init?.method === "POST" && body) {
        responseData = await mockApi.setRelayState(body.state)
      } else {
        responseData = await mockApi.getRelayState()
      }
      break
    case "/light":
      responseData = await mockApi.getLight()
      break
    case "/set-relay-pin":
      responseData = await mockApi.setRelayPin(body?.pin || 0)
      break
    case "/set-led-pin":
      responseData = await mockApi.setLedPin(body?.pin || 0)
      break
    case "/set-dht-pin":
      responseData = await mockApi.setDhtPin(body?.pin || 0)
      break
    case "/set-moisture-pin":
      responseData = await mockApi.setMoisturePin(body?.pin || 0)
      break
    case "/set-light-pin":
      responseData = await mockApi.setLightPin(body?.pin || 0)
      break
    case "/set-pump-check-interval":
      responseData = await mockApi.setPumpCheckInterval(body?.interval || 0)
      break
    case "/stream":
      responseData = await mockApi.getStream()
      break
    case "/reset-camera":
      responseData = await mockApi.resetCamera()
      break
    case "/reset-streams":
      responseData = await mockApi.resetStreams()
      break
    case "/get-supabase-config":
      responseData = await mockApi.getSupabaseConfig()
      break
    case "/set-supabase-config":
      responseData = await mockApi.setSupabaseConfig(body)
      break
    case "/clear-supabase-config":
      responseData = await mockApi.clearSupabaseConfig()
      break
    default:
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
  }

  return new Response(JSON.stringify(responseData), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}
