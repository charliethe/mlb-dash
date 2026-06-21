import '@testing-library/jest-dom/vitest'

if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {}
  globalThis.localStorage = new Proxy({}, {
    get(target: Record<string, unknown>, prop: string | symbol) {
      if (prop === 'getItem') return (key: string) => store[key] ?? null
      if (prop === 'setItem') return (key: string, val: string) => { store[key] = val }
      if (prop === 'removeItem') return (key: string) => { delete store[key] }
      if (prop === 'clear') return () => { for (const k of Object.keys(store)) delete store[k] }
      if (prop === 'length') return Object.keys(store).length
      if (prop === 'key') return (i: number) => Object.keys(store)[i] ?? null
      if (typeof prop === 'string' && prop in store) return store[prop]
      return undefined
    },
    ownKeys() { return Object.keys(store) },
    getOwnPropertyDescriptor() { return { enumerable: true, configurable: true } },
  }) as Storage
}

if (typeof globalThis.Notification === 'undefined') {
  globalThis.Notification = class Notification {
    static permission = 'default' as NotificationPermission
    constructor(_title: string, _options?: NotificationOptions) {}
    static requestPermission() { return 'granted' as const }
    onclick: ((e: Event) => void) | null = null
    close() {}
  } as unknown as typeof Notification
}
