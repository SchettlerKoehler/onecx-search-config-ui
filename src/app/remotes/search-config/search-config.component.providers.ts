import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { importProvidersFrom, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core'
import { provideMissingTranslationHandler, provideTranslateLoader, provideTranslateService } from '@ngx-translate/core'
import { ReplaySubject } from 'rxjs'

import { AngularAcceleratorModule, providePortalDialogService } from '@onecx/angular-accelerator'
import { AngularAuthModule } from '@onecx/angular-auth'
import { UserService } from '@onecx/angular-integration-interface'
import {
  MultiLanguageMissingTranslationHandler,
  OnecxTranslateLoader,
  provideTranslationPathFromMeta,
  REMOTE_COMPONENT_CONFIG,
  RemoteComponentConfig
} from '@onecx/angular-utils'
import { provideThemeConfig } from '@onecx/angular-utils/theme/primeng'

import { searchConfigStoreName } from 'src/app/shared/constants'
import {
  SearchConfigStore,
  SEARCH_CONFIG_STORE_NAME,
  SEARCH_CONFIG_TOPIC,
  SearchConfigTopic
} from 'src/app/shared/search-config.store'

function userProfileInitializer(userService: UserService) {
  return async () => {
    await userService.isInitialized
  }
}

/**
 * Providers for the OneCXSearchConfigComponent remote module.
 *
 * `provideZoneChangeDetection()` is required because `bootstrapRemoteComponent`
 * (via `createApplication`) defaults to zoneless in Angular 21; without this
 * provider the remote would lose zone-based change detection.
 *
 * The translation base URL is passed in because this file is loaded from unit
 * tests where `import.meta` is not available (ts-jest compiles to CommonJS).
 * The bootstrap file calls this with `import.meta.url`.
 */
export function searchConfigProviders(translationUrl: string | undefined) {
  return [
    provideZoneChangeDetection(),
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide: REMOTE_COMPONENT_CONFIG,
      useValue: new ReplaySubject<RemoteComponentConfig>(1)
    },
    {
      provide: SEARCH_CONFIG_STORE_NAME,
      useValue: searchConfigStoreName
    },
    {
      provide: SEARCH_CONFIG_TOPIC,
      useValue: new SearchConfigTopic()
    },
    SearchConfigStore,
    importProvidersFrom(AngularAcceleratorModule, AngularAuthModule, BrowserAnimationsModule),
    provideAppInitializer(() => {
      const initializerFn = userProfileInitializer(inject(UserService))
      return initializerFn()
    }),
    providePortalDialogService(),
    provideTranslationPathFromMeta(translationUrl, 'assets/i18n/'),
    provideThemeConfig(),
    provideTranslateService({
      loader: provideTranslateLoader(OnecxTranslateLoader),
      missingTranslationHandler: provideMissingTranslationHandler(MultiLanguageMissingTranslationHandler)
    })
  ]
}
