import { EnvironmentProviders, Provider } from '@angular/core'

import { searchConfigStoreName } from 'src/app/shared/constants'
import { createRemoteProviders } from 'src/app/shared/remote.providers'

/**
 * Providers for the OneCXSearchConfigComponent remote module.
 *
 * Delegates to the shared remote provider factory; the zone-based change
 * detection and shared-NgZone handling live there. See `createRemoteProviders`.
 */
export function searchConfigProviders(translationUrl: string | undefined): (Provider | EnvironmentProviders)[] {
  return createRemoteProviders(searchConfigStoreName, translationUrl)
}
