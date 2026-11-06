import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { importProvidersFrom, inject, provideAppInitializer } from '@angular/core'
import { provideMissingTranslationHandler, provideTranslateLoader, provideTranslateService } from '@ngx-translate/core'
import { ReplaySubject } from 'rxjs'

import { AngularAcceleratorModule, providePortalDialogService } from '@onecx/angular-accelerator'
import { AngularAuthModule } from '@onecx/angular-auth'
import { UserService } from '@onecx/angular-integration-interface'
import { bootstrapRemoteComponent } from '@onecx/angular-webcomponents'
import {
  MultiLanguageMissingTranslationHandler,
  OnecxTranslateLoader,
  provideTranslationPathFromMeta,
  REMOTE_COMPONENT_CONFIG,
  RemoteComponentConfig
} from '@onecx/angular-utils'
import { provideThemeConfig } from '@onecx/angular-utils/theme/primeng'

import { environment } from 'src/environments/environment'
import { columngGroupSelectionStoreName } from 'src/app/shared/constants'
import {
  SearchConfigStore,
  SEARCH_CONFIG_STORE_NAME,
  SEARCH_CONFIG_TOPIC,
  SearchConfigTopic
} from 'src/app/shared/search-config.store'
import { OneCXColumnGroupSelectionComponent } from './column-group-selection.component'

function userProfileInitializer(userService: UserService) {
  return async () => {
    await userService.isInitialized
  }
}

bootstrapRemoteComponent(
  OneCXColumnGroupSelectionComponent,
  'ocx-column-group-selection-component',
  environment.production,
  [
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide: REMOTE_COMPONENT_CONFIG,
      useValue: new ReplaySubject<RemoteComponentConfig>(1)
    },
    {
      provide: SEARCH_CONFIG_STORE_NAME,
      useValue: columngGroupSelectionStoreName
    },
    {
      provide: SEARCH_CONFIG_TOPIC,
      useValue: new SearchConfigTopic()
    },
    SearchConfigStore,
    importProvidersFrom(AngularAcceleratorModule, AngularAuthModule, BrowserAnimationsModule),
    providePortalDialogService(),
    provideAppInitializer(() => {
      const initializerFn = userProfileInitializer(inject(UserService))
      return initializerFn()
    }),
    provideTranslationPathFromMeta(import.meta.url, 'assets/i18n/'),
    provideThemeConfig(),
    provideTranslateService({
      defaultLanguage: 'en',
      loader: provideTranslateLoader(OnecxTranslateLoader),
      missingTranslationHandler: provideMissingTranslationHandler(MultiLanguageMissingTranslationHandler)
    })
  ]
).catch((err) => console.error(err))
