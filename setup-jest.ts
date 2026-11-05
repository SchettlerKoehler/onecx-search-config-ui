// setup-jest.ts
import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone'

const globalObj = globalThis as any
const options = globalObj.ngJest?.testEnvironmentOptions || {}

setupZoneTestEnv(options as any)

if (globalObj.ngJest) {
  delete globalObj.ngJest
}

/* eslint-disable @typescript-eslint/no-empty-function */
// jsdom has no working cross-tab postMessage. @onecx/accelerator v7 falls back to the real
// window.postMessage when publishing topics (no BroadcastChannel in jsdom); that real
// setTimeout outlives zone-based fakeAsync and crashes jsdom at teardown. Stub it as a no-op
// (the specs use FakeTopic and never assert on postMessage delivery).
globalThis.postMessage = jest.fn()

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

/* fixes a bug with jsdom: ignoring this error message in log */
const originalConsoleError = console.error
type Err = { message: string }
console.error = (message, ...optionalParams) => {
  try {
    if (message?.includes('Error: Could not parse CSS stylesheet')) return
  } catch (err) {
    ;(err as Err).message = `Error in console.error`
    return
  }
  originalConsoleError(message, ...optionalParams)
}

/* Mock matchMedia for tests */
Object.defineProperty(globalThis, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }))
})

globalThis.matchMedia =
  globalThis.matchMedia ||
  function () {
    return {
      addListener: () => {},
      removeListener: () => {}
    }
  }

// @ts-expect-error https://thymikee.github.io/jest-preset-angular/docs/getting-started/test-environment
globalThis.ngJest = {
  testEnvironmentOptions: {
    errorOnUnknownElements: true,
    errorOnUnknownProperties: true
  }
}
