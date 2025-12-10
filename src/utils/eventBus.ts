type Callback = () => void

class EventBus {
  private listeners: Record<string, Callback[]> = {}

  on(event: string, callback: Callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback)
  }

  off(event: string, callback: Callback) {
    if (!this.listeners[event]) return
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback)
  }

  emit(event: string) {
    if (!this.listeners[event]) return
    this.listeners[event].forEach(cb => cb())
  }
}

export const eventBus = new EventBus()
