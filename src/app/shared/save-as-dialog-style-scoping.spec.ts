import { createApplication } from '@angular/platform-browser'
import { NoopAnimationsModule } from '@angular/platform-browser/animations'
import { of, ReplaySubject } from 'rxjs'

import { PortalDialogService, providePortalDialogService } from '@onecx/angular-accelerator'
import {
  provideAppConfigServiceMock,
  provideAppStateServiceMock,
  provideConfigurationServiceMock,
  providePortalMessageServiceMock,
  provideRemoteComponentsServiceMock,
  provideShellCapabilityServiceMock
} from '@onecx/angular-integration-interface/mocks'
import { UserService } from '@onecx/angular-integration-interface'
import { provideTranslateTestingService } from '@onecx/angular-testing'
import { REMOTE_COMPONENT_CONFIG, RemoteComponentConfig, scopeIdFromProductNameAndAppId } from '@onecx/angular-utils'

import {
  CreateOrEditSearchConfigDialogComponent,
  CreateOrEditSearchDialogContent
} from 'src/app/shared/components/create-or-edit-search-config-dialog/create-or-edit-search-config-dialog.component'

const PRODUCT_NAME = 'my-product'
const APP_ID = 'my-app'

describe('Save As dialog style scoping', () => {
  // The Save As dialog is portaled outside the remote element, so the remote's scoped host styles only
  // reach it through the `data-style-id` the accelerator stamps on the portaled overlay. That stamp is
  // applied by the *real* `PortalDialogService` (invisible through a mocked `openDialog`), so this spec
  // boots a full application with the real service and asserts the portaled dialog carries the remote's
  // scope id.
  it('should portal the Save As dialog with the remote data-style-id', async () => {
    // Only `productName`/`appId` matter for the scope id; the rest are filled to satisfy the type.
    const remoteComponentConfig = new ReplaySubject<RemoteComponentConfig>(1)
    remoteComponentConfig.next({ productName: PRODUCT_NAME, appId: APP_ID, permissions: [], baseUrl: '' })

    // The accelerator's APP_INITIALIZER awaits `firstValueFrom(userService.lang$.pipe(skip(1)))` before
    // the application boot resolves, so the stub must emit `lang$` at least twice.
    const userServiceStub = {
      isInitialized: Promise.resolve(),
      lang$: of('en', 'en')
    }

    const app = await createApplication({
      providers: [
        providePortalDialogService(),
        NoopAnimationsModule,
        { provide: UserService, useValue: userServiceStub },
        { provide: REMOTE_COMPONENT_CONFIG, useValue: remoteComponentConfig },
        ...provideTranslateTestingService({
          en: require('../../assets/i18n/en.json'),
          de: require('../../assets/i18n/de.json')
        }),
        ...provideAppConfigServiceMock(),
        ...provideAppStateServiceMock(),
        ...provideConfigurationServiceMock(),
        ...providePortalMessageServiceMock(),
        ...provideRemoteComponentsServiceMock(),
        ...provideShellCapabilityServiceMock()
      ]
    })

    const portalDialogService = app.injector.get(PortalDialogService)

    // `openDialog` is a cold observable: the dialog only opens when it is subscribed (mirroring how the
    // remotes call `saveSearchConfig`), so keep the subscription alive while the dialog renders.
    const dialogSubscription = portalDialogService
      .openDialog<CreateOrEditSearchDialogContent>(
        'SEARCH_CONFIG.SAVE_AS_DIALOG.HEADER',
        {
          type: CreateOrEditSearchConfigDialogComponent,
          inputs: {
            // The remotes pass a live store selector; the real dialog subscribes to it, so an empty
            // single-emission observable is the equivalent host input here.
            existingConfigs: of([] as never[]),
            saveInputValues: true,
            saveColumns: false,
            frozeColumnSaveOption: false
          }
        },
        'SEARCH_CONFIG.SAVE_AS_DIALOG.SAVE',
        'SEARCH_CONFIG.SAVE_AS_DIALOG.CANCEL'
      )
      .subscribe()

    // `setScopeIdentifier` stamps the id only once `getScopeIdentifier` (a promise) resolves and the
    // overlay has rendered, so poll for the portaled host carrying the remote's scope id.
    const expectedStyleId = scopeIdFromProductNameAndAppId(PRODUCT_NAME, APP_ID)
    const host = await new Promise<HTMLElement>((resolve, reject) => {
      const startedAt = Date.now()
      const timer = setInterval(() => {
        const found = Array.from(document.body.children).find(
          (element) => element.getAttribute('data-style-id') === expectedStyleId
        )
        if (found) {
          clearInterval(timer)
          resolve(found as HTMLElement)
        } else if (Date.now() - startedAt > 5000) {
          clearInterval(timer)
          reject(new Error('timed out waiting for the portaled dialog to carry the remote data-style-id'))
        }
      }, 20)
    })

    // The portaled overlay is PrimeNG's dynamic-dialog host; the scope id is stamped on that outermost
    // element (not the inner `p-dialog`), and the dialog content still renders inside it.
    expect(host.getAttribute('data-style-id')).toBe(expectedStyleId)
    expect(host.querySelector('p-dialog')).toBeTruthy()

    dialogSubscription?.unsubscribe()
    app.destroy()
    // `app.destroy()` closes the dialog via the service's cleanup and usually removes the portaled
    // overlay; if it is still attached, drop it so it cannot leak into a subsequent test in the file.
    if (host.parentNode === document.body) {
      document.body.removeChild(host)
    }
  }, 20000)
})
