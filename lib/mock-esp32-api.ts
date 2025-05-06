// Mock data for ESP32 simulation
export class MockESP32Api {
    private static instance: MockESP32Api
    private ledState = false
    private relayState = false
    private lightRelayState = false
    private temperature = 23.5
    private humidity = 65
    private soilMoisture = 42
    private lightLevel = 78
    private updateInterval: NodeJS.Timeout | null = null
    private lastUpdated: Date = new Date()
  
    // Singleton pattern
    public static getInstance(): MockESP32Api {
      if (!MockESP32Api.instance) {
        MockESP32Api.instance = new MockESP32Api()
      }
      return MockESP32Api.instance
    }
  
    constructor() {
      // Start periodic data updates to simulate sensor changes
      this.startDataUpdates()
    }
  
    private startDataUpdates() {
      if (this.updateInterval) {
        clearInterval(this.updateInterval)
      }
  
      this.updateInterval = setInterval(() => {
        // Add small random variations to simulate real sensor data
        this.temperature = Math.max(10, Math.min(35, this.temperature + (Math.random() - 0.5) * 2))
        this.humidity = Math.max(30, Math.min(90, this.humidity + (Math.random() - 0.5) * 5))
        this.soilMoisture = Math.max(10, Math.min(90, this.soilMoisture + (Math.random() - 0.5) * 3))
        this.lightLevel = Math.max(5, Math.min(95, this.lightLevel + (Math.random() - 0.5) * 8))
        this.lastUpdated = new Date()
      }, 5000)
    }
  
    public cleanup() {
      if (this.updateInterval) {
        clearInterval(this.updateInterval)
        this.updateInterval = null
      }
    }
  
    // Mock API endpoints
    public async getInfo() {
      return {
        status: "online",
        mac: "DUMMY-ESP32-MAC",
        ip: "192.168.1.200",
        device: "ESP32-DUMMY",
        uptime: Math.floor((new Date().getTime() - this.lastUpdated.getTime()) / 1000),
        free_heap: 120000,
      }
    }
  
    public async getSensors() {
      return {
        sensors: [
          {
            id: "temperature",
            type: "temperature",
            name: "Temperature Sensor",
            value: this.temperature,
            unit: "°C",
          },
          {
            id: "humidity",
            type: "humidity",
            name: "Humidity Sensor",
            value: this.humidity,
            unit: "%",
          },
          {
            id: "soil_moisture",
            type: "soil",
            name: "Soil Moisture Sensor",
            value: 4095 - (this.soilMoisture / 100) * 4095, // Convert to raw value
            percentage: this.soilMoisture,
            unit: "%",
          },
          {
            id: "light",
            type: "light",
            name: "Light Sensor",
            value: (this.lightLevel / 100) * 4095, // Convert to raw value
            percentage: this.lightLevel,
            unit: "%",
          },
        ],
      }
    }
  
    public async getLight() {
      return {
        value: (this.lightLevel / 100) * 4095, // Raw value (0-4095)
        percentage: this.lightLevel, // Percentage (0-100)
        unit: "%",
      }
    }
  
    public async getLedState() {
      return {
        state: this.ledState,
      }
    }
  
    public async setLedState(state: boolean) {
      this.ledState = state
      return {
        success: true,
        state: this.ledState,
      }
    }
  
    public async getRelayState() {
      return {
        state: this.relayState,
      }
    }
  
    public async setRelayState(state: boolean) {
      this.relayState = state
      return {
        success: true,
        state: this.relayState,
      }
    }
  
    public async getLightRelayState() {
      return {
        state: this.lightRelayState,
      }
    }
  
    public async setLightRelayState(state: boolean) {
      this.lightRelayState = state
      return {
        success: true,
        state: this.lightRelayState,
      }
    }
  
    public async setRelayPin(pin: number) {
      return {
        success: true,
        message: `Relay pin set to ${pin}`,
      }
    }
  
    public async setLedPin(pin: number) {
      return {
        success: true,
        message: `LED pin set to ${pin}`,
      }
    }
  
    public async setDhtPin(pin: number) {
      return {
        success: true,
        message: `DHT pin set to ${pin}`,
      }
    }
  
    public async setMoisturePin(pin: number) {
      return {
        success: true,
        message: `Moisture pin set to ${pin}`,
      }
    }
  
    public async setLightPin(pin: number) {
      return {
        success: true,
        message: `Light pin set to ${pin}`,
      }
    }
  
    public async setPumpCheckInterval(interval: number) {
      return {
        success: true,
        message: `Pump check interval set to ${interval}`,
      }
    }
  
    public async getStream() {
      // This would normally return a stream, but for our mock we'll just return a placeholder
      return "mock-stream-url"
    }
  
    public async resetCamera() {
      return {
        success: true,
        message: "Camera reset successful",
      }
    }
  
    public async resetStreams() {
      return {
        success: true,
        message: "All streams reset",
      }
    }
  
    // Supabase configuration endpoints
    public async getSupabaseConfig() {
      return {
        supabaseUrl: "https://example.supabase.co",
        supabaseApiKey: "dummy-api-key",
        dataConfig: {
          sendTemperature: true,
          sendHumidity: true,
          sendSoilMoisture: true,
          sendLightLevel: true,
          sendLedState: true,
          sendRelayState: true,
          sendLightRelayState: true,
          sendLightAutoMode: true,
        },
      }
    }
  
    public async setSupabaseConfig(config: any) {
      return {
        success: true,
        message: "Supabase configuration updated",
      }
    }
  
    public async clearSupabaseConfig() {
      return {
        success: true,
        message: "Supabase configuration cleared",
      }
    }
  }
  