type Callback = (...args: any[]) => void

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

  emit(event: string, ...args: any[]) {
    if (!this.listeners[event]) return
    this.listeners[event].forEach(cb => cb(...args))
  }
}

export const eventBus = new EventBus()
