import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import {
  EnvironmentProviders,
  importProvidersFrom,
  inject,
  NgZone,
  Provider,
  provideAppInitializer,
  provideZoneChangeDetection
} from '@angular/core'
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
import { getNgZone } from '@onecx/angular-webcomponents'

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
 * Providers shared by both exposed remote modules (OneCXSearchConfigComponent and
 * OneCXColumnGroupSelectionComponent).
 *
 * `provideZoneChangeDetection()` is required because `bootstrapRemoteComponent`
 * (via `createApplication`) defaults to zoneless in Angular 21; without this
 * provider the remote would lose zone-based change detection.
 *
 * `bootstrapRemoteComponent` inserts the shell's `NgZone`
 * (`{ provide: NgZone, useValue: getNgZone() }`) *before* these providers, so the
 * last `NgZone` provider wins and `provideZoneChangeDetection()`'s own factory would
 * otherwise give the remote a fresh, private zone. To keep the remote running on the
 * shell's shared zone, we re-provide `getNgZone()` right after `provideZoneChangeDetection()`,
 * falling back to a plain `NgZone` when the remote is booted standalone (no shell).
 *
 * The translation base URL is passed in because the bootstrap entry files are loaded
 * from unit tests where `import.meta` is not available (ts-jest compiles to CommonJS).
 * The bootstrap files call this with `import.meta.url`.
 */
export function createRemoteProviders(
  storeName: string,
  translationUrl: string | undefined
): (Provider | EnvironmentProviders)[] {
  return [
    provideZoneChangeDetection(),
    {
      provide: NgZone,
      useFactory: () => getNgZone() ?? new NgZone({})
    },
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide: REMOTE_COMPONENT_CONFIG,
      useValue: new ReplaySubject<RemoteComponentConfig>(1)
    },
    {
      provide: SEARCH_CONFIG_STORE_NAME,
      useValue: storeName
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
