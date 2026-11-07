import { of } from 'rxjs'
import { createApplication } from '@angular/platform-browser'

import { PortalDialogService } from '@onecx/angular-accelerator'
import { UserService } from '@onecx/angular-integration-interface'
import {
  provideAppConfigServiceMock,
  provideAppStateServiceMock,
  provideConfigurationServiceMock,
  providePortalMessageServiceMock,
  provideRemoteComponentsServiceMock,
  provideShellCapabilityServiceMock
} from '@onecx/angular-integration-interface/mocks'

import { searchConfigStoreName } from 'src/app/shared/constants'
import { createRemoteProviders } from 'src/app/shared/remote.providers'

describe('createRemoteProviders', () => {
  it('provides the PortalDialogService so the remotes can open the delete confirm dialog', async () => {
    const shellMocks = [
      provideAppConfigServiceMock(),
      provideAppStateServiceMock(),
      provideConfigurationServiceMock(),
      providePortalMessageServiceMock(),
      provideRemoteComponentsServiceMock(),
      provideShellCapabilityServiceMock()
    ].flat()

    // This test boots a full application (`createApplication`) rather than a TestBed component, so it
    // carries a 20s timeout to cover the boot.
    //
    // `AngularAcceleratorModule` does not provide `DialogService`/`PortalDialogService`, so the remotes
    // rely on `providePortalDialogService()` in `createRemoteProviders` for the confirm dialog. The
    // accelerator's own APP_INITIALIZER awaits `firstValueFrom(userService.lang$.pipe(skip(1)))`, so the
    // stub must emit `lang$` at least twice for the boot to resolve under the test environment.
    const userServiceStub = {
      isInitialized: Promise.resolve(),
      lang$: of('en', 'en')
    }

    const app = await createApplication({
      providers: [
        ...createRemoteProviders(searchConfigStoreName, undefined),
        ...shellMocks,
        { provide: UserService, useValue: userServiceStub }
      ]
    })

    expect(app.injector.get(PortalDialogService)).toBeTruthy()

    app.destroy()
  }, 20000)
})
