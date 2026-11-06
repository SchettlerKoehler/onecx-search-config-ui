import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { importProvidersFrom, inject, provideAppInitializer } from '@angular/core'
import { provideMissingTranslationHandler, provideTranslateLoader, provideTranslateService } from '@ngx-translate/core'
import { ReplaySubject } from 'rxjs'

import { AngularAcceleratorModule, providePortalDialogService } from '@onecx/angular-accelerator'
import { AngularAuthModule } from '@onecx/angular-auth'
import { bootstrapRemoteComponent } from '@onecx/angular-webcomponents'
import { UserService } from '@onecx/angular-integration-interface'
import {
  MultiLanguageMissingTranslationHandler,
  OnecxTranslateLoader,
  provideTranslationPathFromMeta,
  REMOTE_COMPONENT_CONFIG,
  RemoteComponentConfig
} from '@onecx/angular-utils'
import { provideThemeConfig } from '@onecx/angular-utils/theme/primeng'

import { environment } from 'src/environments/environment'
import { searchConfigStoreName } from 'src/app/shared/constants'
import {
  SearchConfigStore,
  SEARCH_CONFIG_STORE_NAME,
  SEARCH_CONFIG_TOPIC,
  SearchConfigTopic
} from 'src/app/shared/search-config.store'
import { OneCXSearchConfigComponent } from './search-config.component'

function userProfileInitializer(userService: UserService) {
  return async () => {
    await userService.isInitialized
  }
}

bootstrapRemoteComponent(OneCXSearchConfigComponent, 'ocx-search-config-component', environment.production, [
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
  provideTranslationPathFromMeta(import.meta.url, 'assets/i18n/'),
  provideThemeConfig(),
  provideTranslateService({
    loader: provideTranslateLoader(OnecxTranslateLoader),
    missingTranslationHandler: provideMissingTranslationHandler(MultiLanguageMissingTranslationHandler)
  })
]).catch((err) => console.error(err))
