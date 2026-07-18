import type { DataProvider } from './provider'
import { MockProvider } from './mock'
import { createSharePointProvider } from './sp'

export type { DataProvider, RequestScope, RequestDetail, DraftLineInput } from './provider'

export const PROVIDER_NAME = (import.meta.env.VITE_DATA_PROVIDER as string | undefined) ?? 'mock'

let instance: DataProvider | undefined

export function getProvider(): DataProvider {
  instance ??= PROVIDER_NAME === 'sharepoint' ? createSharePointProvider() : new MockProvider()
  return instance
}
