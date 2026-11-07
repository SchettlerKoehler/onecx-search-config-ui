import { provideHttpClientTesting } from '@angular/common/http/testing'
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing'
import { NoopAnimationsModule } from '@angular/platform-browser/animations'
import { By, createApplication } from '@angular/platform-browser'
import {
  Component,
  EnvironmentProviders,
  Injector,
  NgZone,
  Provider,
  runInInjectionContext,
  ɵNoopNgZone as NoopNgZone
} from '@angular/core'
import { provideHttpClient } from '@angular/common/http'
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed'
import { ReplaySubject, of, throwError } from 'rxjs'
import { DialogService } from 'primeng/dynamicdialog'
import { Select } from 'primeng/select'
import { Tooltip } from 'primeng/tooltip'

import { FakeTopic } from '@onecx/accelerator'
import { PortalDialogService } from '@onecx/angular-accelerator'
import { PortalMessageService } from '@onecx/angular-integration-interface'
import { AppStateService } from '@onecx/angular-integration-interface'
import { UserService } from '@onecx/angular-integration-interface'
import {
  provideAppConfigServiceMock,
  provideAppStateServiceMock,
  provideConfigurationServiceMock,
  providePortalMessageServiceMock,
  provideRemoteComponentsServiceMock,
  provideShellCapabilityServiceMock
} from '@onecx/angular-integration-interface/mocks'
import { PSelectHarness, provideTranslateTestingService } from '@onecx/angular-testing'
import { REMOTE_COMPONENT_CONFIG, RemoteComponentConfig } from '@onecx/angular-utils'
import { getWindowState } from '@onecx/angular-webcomponents'

import {
  SEARCH_CONFIG_STORE_NAME,
  SEARCH_CONFIG_TOPIC,
  SearchConfigMessage,
  SearchConfigStore,
  SearchConfigTopic
} from 'src/app/shared/search-config.store'
import { CreateOrEditSearchConfigDialogComponent } from 'src/app/shared/components/create-or-edit-search-config-dialog/create-or-edit-search-config-dialog.component'
import { Configuration, SearchConfigAPIService } from 'src/app/shared/generated'
import {
  advancedViewMode,
  basicViewMode,
  SEARCH_CONFIG_DELETE_BUTTON_ID,
  SEARCH_CONFIG_SAVE_AS_BUTTON_ID
} from 'src/app/shared/constants'
import { SEARCH_CONFIG_DIALOG_WIDTH } from 'src/app/shared/search-config-delete'
import { OneCXSearchConfigComponent } from './search-config.component'
import { OneCXSearchConfigHarness } from './search-config.harness'
import { searchConfigProviders } from './search-config.component.providers'

const createSpyObj = (baseName: string, methodNames: Array<string>): { [key: string]: any } => {
  const obj: any = {}

  for (let i = 0; i < methodNames.length; i++) {
    obj[methodNames[i]] = jest.fn()
  }

  return obj
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

type SearchConfigFixture = {
  id: string
  name: string
  columns: string[]
  values: Record<string, string>
  isReadonly: boolean
  isAdvanced: boolean
}

const config: SearchConfigFixture = {
  id: '1',
  name: 'config-1',
  columns: ['col-1'],
  values: {
    k1: 'v1'
  },
  isReadonly: false,
  isAdvanced: false
}

const readonlyConfig: SearchConfigFixture = {
  id: '4',
  name: 'config-readonly',
  columns: ['col-4'],
  values: {
    k4: 'v4'
  },
  isReadonly: true,
  isAdvanced: false
}

const onlyValuesConfig: SearchConfigFixture = {
  id: '2',
  name: 'config-2',
  columns: [],
  values: {
    k2: 'v2'
  },
  isReadonly: false,
  isAdvanced: false
}

const onlyColumnsConfig: SearchConfigFixture = {
  id: '3',
  name: 'config-3',
  columns: ['col-3'],
  values: {},
  isReadonly: false,
  isAdvanced: false
}

describe('OneCXSearchConfigComponent', () => {
  let component: OneCXSearchConfigComponent
  let fixture: ComponentFixture<OneCXSearchConfigComponent>
  let store: SearchConfigStore

  const searchConfigServiceSpy = {
    ...createSpyObj('searchConfigService', [
      'getSearchConfigInfos',
      'createSearchConfig',
      'deleteSearchConfig',
      'getSearchConfig',
      'updateSearchConfig'
    ]),
    configuration: new Configuration({
      basePath: ''
    })
  } as SearchConfigAPIService

  const portalDialogSpy = createSpyObj('portalDialogService', ['openDialog']) as PortalDialogService

  const portalMessageSpy = createSpyObj('portalMessageService', ['info', 'success', 'error']) as PortalMessageService

  let baseUrlSubject: ReplaySubject<any>
  beforeEach(() => {
    baseUrlSubject = new ReplaySubject<any>(1)
    TestBed.configureTestingModule({
      declarations: [],
      imports: [OneCXSearchConfigComponent, NoopAnimationsModule],
      providers: [
        ...provideTranslateTestingService({
          en: require('../../../assets/i18n/en.json'),
          de: require('../../../assets/i18n/de.json')
        }),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: REMOTE_COMPONENT_CONFIG,
          useValue: baseUrlSubject
        },
        {
          provide: SearchConfigStore,
          useClass: SearchConfigStore
        },
        {
          provide: SEARCH_CONFIG_STORE_NAME,
          useValue: 'store'
        },
        {
          provide: SEARCH_CONFIG_TOPIC,
          useValue: new FakeTopic<SearchConfigMessage>()
        },
        DialogService,
        {
          provide: PortalDialogService,
          useValue: portalDialogSpy
        },
        {
          provide: PortalMessageService,
          useValue: portalMessageSpy
        },
        {
          provide: SearchConfigAPIService,
          useValue: searchConfigServiceSpy
        }
      ]
    }).compileComponents()

    baseUrlSubject.next('base_url_mock')
    ;(portalDialogSpy.openDialog as jest.Mock).mockReset()
    ;(searchConfigServiceSpy.createSearchConfig as jest.Mock).mockReset()
    ;(searchConfigServiceSpy.deleteSearchConfig as jest.Mock).mockReset()
    ;(searchConfigServiceSpy.updateSearchConfig as jest.Mock).mockReset()
    ;(searchConfigServiceSpy.getSearchConfig as jest.Mock).mockReset()
    searchConfigServiceSpy.getSearchConfigInfos = () =>
      of({
        configs: []
      } as any)

    fixture = TestBed.createComponent(OneCXSearchConfigComponent)
    component = fixture.componentInstance
    // The root template is gated by *ocxIfPermission="'SEARCHCONFIG#VIEW'; permissions: permissions".
    // Grant the permissions before the first change detection so the header renders.
    component.permissions = ['SEARCHCONFIG#VIEW', 'SEARCHCONFIG#DELETE']
    fixture.detectChanges()

    ;(component as any).portalDialogService = portalDialogSpy
    ;(component as any).portalMessageService = portalMessageSpy
    ;(component as any).searchConfigService = searchConfigServiceSpy as any

    store = TestBed.inject(SearchConfigStore)
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  it('should update store on view mode input set', fakeAsync(() => {
    const spy = jest.spyOn(store, 'updateViewMode')

    component.viewMode = basicViewMode
    tick(500)

    expect(spy).toHaveBeenCalledWith(basicViewMode)
  }))

  it('should update store on page name input set', fakeAsync(() => {
    const spy = jest.spyOn(store, 'setPageName')

    component.pageName = 'my-page'
    tick(500)

    expect(spy).toHaveBeenCalledWith('my-page')
  }))

  it('should update store on current field values input set', fakeAsync(() => {
    const spy = jest.spyOn(store, 'updateFieldValues')

    component.currentFieldValues = { k: 'v' }
    tick(500)

    expect(spy).toHaveBeenCalledWith({ k: 'v' })
  }))

  it('should unsubscribe its subscriptions on destroy', () => {
    expect(() => component.ngOnDestroy()).not.toThrow()
    expect(() => component.ngOnDestroy()).not.toThrow()
  })

  describe('setup', () => {
    it('should init remote component', (done) => {
      const config: RemoteComponentConfig = {
        appId: 'appId',
        productName: 'prodName',
        permissions: ['permission'],
        baseUrl: 'base'
      }

      jest.spyOn(component, 'ocxInitRemoteComponent')
      component.ocxRemoteComponentConfig = config

      expect(component.permissions).toEqual(['permission'])
      expect(component.ocxInitRemoteComponent).toHaveBeenCalledWith(config)
      expect(searchConfigServiceSpy.configuration.basePath).toEqual('base/bff')
      baseUrlSubject.asObservable().subscribe((item) => {
        expect(item).toEqual(config)
        done()
      })
    })

    it('should load search configs when page, baseUrl and mfe info are available', fakeAsync(() => {
      const configs = [
        {
          name: 'config-1',
          values: {},
          columns: []
        },
        {
          name: 'config-2',
          values: {},
          columns: []
        }
      ]

      const getSearchConfigInfosSpy = jest
        .spyOn(searchConfigServiceSpy, 'getSearchConfigInfos')
        .mockReturnValue(of({ configs: configs } as any))

      const localStore = new SearchConfigStore('store', new SearchConfigTopic())
      const localBaseUrl = new ReplaySubject<RemoteComponentConfig>(1)
      localBaseUrl.next({
        baseUrl: 'base_url'
      } as any)
      localStore.setPageName('page-name')

      const appStateService = {
        currentMfe$: {
          asObservable: () => of({ appId: 'appId', productName: 'product' } as any)
        }
      } as any

      // Construct through the injection context so the field-level `viewChild(Select)` initializer
      // (valid in production because Angular creates the component in its DI context) works here too.
      const localComponent = runInInjectionContext(
        TestBed.inject(Injector),
        () =>
          new OneCXSearchConfigComponent(
            localBaseUrl,
            { lang$: of('en') } as any,
            { use: jest.fn() } as any,
            searchConfigServiceSpy,
            portalDialogSpy,
            portalMessageSpy,
            appStateService,
            localStore
          )
      )

      tick(100)

      expect(getSearchConfigInfosSpy).toHaveBeenCalledWith({
        appId: 'appId',
        page: 'page-name',
        productName: 'product'
      })
      expect(localComponent).toBeTruthy()
    }))

    it('should set search configs on page info update', fakeAsync(() => {
      const appState = TestBed.inject(AppStateService)
      const configs = [
        {
          name: 'config-1',
          values: {},
          columns: []
        },
        {
          name: 'config-2',
          values: {},
          columns: []
        }
      ]

      jest.spyOn(appState.currentMfe$, 'asObservable').mockReturnValue(
        of({
          appId: 'appId',
          productName: 'product'
        } as any)
      )
      jest.spyOn(searchConfigServiceSpy, 'getSearchConfigInfos').mockReturnValue(
        of({
          configs: configs
        } as any)
      )

      const setSearchConfigsSpy = jest.spyOn(store, 'setSearchConfigs')

      fixture.detectChanges()
      store.setSearchConfigs(configs as any)

      expect(setSearchConfigsSpy).toHaveBeenCalledWith(configs)
    }))
  })

  describe('on config save (Save As)', () => {
    it('should provide explanation for column freeze when column group component is inactive', fakeAsync(() => {
      store.patchState({
        columnGroupComponentActive: false,
        layout: 'table',
        searchConfigs: []
      })
      const dialogServiceSpy = jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'primary'
        } as any)
      )

      component.onSearchConfigSave({
        searchConfigs: [],
        pageName: 'page-name',
        fieldValues: {},
        displayedColumnsIds: [],
        viewMode: basicViewMode,
        selectedGroupKey: 'default',
        isColumnGroupComponentActive: false,
        layout: 'table',
        currentConfig: undefined,
        editMode: false,
        isInChargeOfEdit: false
      } as any)
      tick(500)

      expect(dialogServiceSpy).toHaveBeenCalledWith(
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CREATE_HEADER',
        {
          type: CreateOrEditSearchConfigDialogComponent,
          inputs: {
            searchConfigName: '',
            saveInputValues: false,
            saveColumns: false,
            frozeColumnSaveOption: true,
            frozeColumnSaveOptionExplanation: 'SEARCH_CONFIG.COLUMN_GROUP_COMPONENT_INACTIVE'
          }
        },
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CONFIRM',
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CANCEL'
      )
    }))

    it('should provide explanation for column freeze when layout is not table', fakeAsync(() => {
      store.patchState({
        columnGroupComponentActive: true,
        layout: 'list',
        searchConfigs: []
      })
      const dialogServiceSpy = jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'primary'
        } as any)
      )

      component.onSearchConfigSave({
        searchConfigs: [],
        pageName: 'page-name',
        fieldValues: {},
        displayedColumnsIds: [],
        viewMode: basicViewMode,
        selectedGroupKey: 'default',
        isColumnGroupComponentActive: true,
        layout: 'list',
        currentConfig: undefined,
        editMode: false,
        isInChargeOfEdit: false
      } as any)
      tick(500)

      expect(dialogServiceSpy).toHaveBeenCalledWith(
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CREATE_HEADER',
        {
          type: CreateOrEditSearchConfigDialogComponent,
          inputs: {
            searchConfigName: '',
            saveInputValues: false,
            saveColumns: false,
            frozeColumnSaveOption: true,
            frozeColumnSaveOptionExplanation: 'SEARCH_CONFIG.TABLE_VIEW_INACTIVE'
          }
        },
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CONFIRM',
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CANCEL'
      )
    }))

    it('should not add config when the dialog was closed', fakeAsync(() => {
      const appState = TestBed.inject(AppStateService)
      const addSpy = jest.spyOn(store, 'addSearchConfig')
      const setSpy = jest.spyOn(store, 'setCurrentConfig')
      jest.spyOn(appState.currentMfe$, 'asObservable').mockReturnValue(
        of({
          appId: 'appId',
          productName: 'product'
        } as any)
      )

      store.patchState({
        searchConfigs: [],
        pageName: 'page_name',
        fieldValues: {},
        displayedColumnsIds: [],
        viewMode: basicViewMode,
        selectedGroupKey: 'default'
      })
      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(of(undefined as any))

      component.onSearchConfigSave({
        searchConfigs: [],
        pageName: 'page_name',
        fieldValues: {},
        displayedColumnsIds: [],
        viewMode: basicViewMode,
        selectedGroupKey: 'default',
        isColumnGroupComponentActive: true,
        layout: 'table',
        currentConfig: undefined,
        editMode: false,
        isInChargeOfEdit: false
      } as any)
      tick(500)

      expect(addSpy).toHaveBeenCalledTimes(0)
      expect(setSpy).toHaveBeenCalledTimes(0)
    }))

    it.each([null, { result: undefined, button: 'primary' }])(
      'should not add config when the dialog state is %o',
      fakeAsync((dialogResult: null | { result: undefined; button: 'primary' }) => {
        const appState = TestBed.inject(AppStateService)
        const addSpy = jest.spyOn(store, 'addSearchConfig')
        const setSpy = jest.spyOn(store, 'setCurrentConfig')
        jest.spyOn(appState.currentMfe$, 'asObservable').mockReturnValue(
          of({
            appId: 'appId',
            productName: 'product'
          } as any)
        )

        store.patchState({
          searchConfigs: [],
          pageName: 'page_name',
          fieldValues: {},
          displayedColumnsIds: [],
          viewMode: basicViewMode,
          selectedGroupKey: 'default'
        })
        jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(of(dialogResult as any))

        component.onSearchConfigSave({
          searchConfigs: [],
          pageName: 'page_name',
          fieldValues: {},
          displayedColumnsIds: [],
          viewMode: basicViewMode,
          selectedGroupKey: 'default',
          isColumnGroupComponentActive: true,
          layout: 'table',
          currentConfig: undefined,
          editMode: false,
          isInChargeOfEdit: false
        } as any)
        tick(500)

        expect(addSpy).toHaveBeenCalledTimes(0)
        expect(setSpy).toHaveBeenCalledTimes(0)
      })
    )

    it('should not add config when create was not confirmed', fakeAsync(() => {
      const appState = TestBed.inject(AppStateService)
      const addSpy = jest.spyOn(store, 'addSearchConfig')
      const setSpy = jest.spyOn(store, 'setCurrentConfig')
      jest.spyOn(appState.currentMfe$, 'asObservable').mockReturnValue(
        of({
          appId: 'appId',
          productName: 'product'
        } as any)
      )

      store.patchState({
        searchConfigs: [],
        pageName: 'page_name',
        fieldValues: {},
        displayedColumnsIds: [],
        viewMode: basicViewMode,
        selectedGroupKey: 'default'
      })
      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          result: {
            searchConfigName: 'config-to-add'
          },
          button: 'secondary'
        } as any)
      )

      component.onSearchConfigSave({
        searchConfigs: [],
        pageName: 'page_name',
        fieldValues: {},
        displayedColumnsIds: [],
        viewMode: basicViewMode,
        selectedGroupKey: 'default',
        isColumnGroupComponentActive: true,
        layout: 'table',
        currentConfig: undefined,
        editMode: false,
        isInChargeOfEdit: false
      } as any)
      tick(500)

      expect(addSpy).toHaveBeenCalledTimes(0)
      expect(setSpy).toHaveBeenCalledTimes(0)
    }))

    it('should add and set config if create was confirmed', fakeAsync(() => {
      const appState = TestBed.inject(AppStateService)
      const addSpy = jest.spyOn(store, 'addSearchConfig')
      const setSpy = jest.spyOn(store, 'setCurrentConfig')
      jest.spyOn(appState.currentMfe$, 'asObservable').mockReturnValue(
        of({
          appId: 'appId',
          productName: 'product'
        } as any)
      )

      store.patchState({
        searchConfigs: [],
        pageName: 'page_name',
        fieldValues: {},
        displayedColumnsIds: [],
        viewMode: basicViewMode,
        selectedGroupKey: 'default'
      })
      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          result: {
            searchConfigName: config.name
          },
          button: 'primary'
        } as any)
      )
      jest.spyOn(searchConfigServiceSpy, 'createSearchConfig').mockReturnValue(
        of({
          id: config.id,
          configs: [config]
        } as any)
      )

      component.onSearchConfigSave({
        searchConfigs: [],
        pageName: 'page_name',
        fieldValues: {},
        displayedColumnsIds: [],
        viewMode: basicViewMode,
        selectedGroupKey: 'default',
        isColumnGroupComponentActive: true,
        layout: 'table',
        currentConfig: undefined,
        editMode: false,
        isInChargeOfEdit: false
      } as any)
      tick(500)

      expect(portalMessageSpy.info).toHaveBeenCalledWith({
        summaryKey: 'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CREATE_SUCCESS'
      })
      expect(addSpy).toHaveBeenCalledWith(config)
      expect(setSpy).toHaveBeenCalledTimes(1)
      expect(setSpy).toHaveBeenCalledWith(config)
    }))

    it('should save inputs and viewMode', fakeAsync(() => {
      const appState = TestBed.inject(AppStateService)
      const createCallSpy = jest.spyOn(searchConfigServiceSpy, 'createSearchConfig').mockReturnValue(of({} as any))
      jest.spyOn(appState.currentMfe$, 'asObservable').mockReturnValue(
        of({
          appId: 'my-app',
          productName: 'my-product'
        } as any)
      )

      store.patchState({
        searchConfigs: [],
        pageName: 'my_page',
        fieldValues: { k: 'v' },
        displayedColumnsIds: [],
        viewMode: advancedViewMode,
        selectedGroupKey: 'default'
      })
      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          result: {
            searchConfigName: config.name,
            saveInputValues: true,
            saveColumns: false
          },
          button: 'primary'
        } as any)
      )

      component.onSearchConfigSave({
        searchConfigs: [],
        pageName: 'my_page',
        fieldValues: { k: 'v' },
        displayedColumnsIds: [],
        viewMode: advancedViewMode,
        selectedGroupKey: 'default',
        isColumnGroupComponentActive: true,
        layout: 'table',
        currentConfig: undefined,
        editMode: false,
        isInChargeOfEdit: false
      } as any)
      tick(500)

      expect(createCallSpy).toHaveBeenCalledWith({
        appId: 'my-app',
        productName: 'my-product',
        fieldListVersion: 0,
        isReadonly: false,
        page: 'my_page',
        name: config.name,
        isAdvanced: true,
        columns: [],
        values: { k: 'v' }
      })
    }))

    it('should fall back to an empty name and values when they are missing', fakeAsync(() => {
      const appState = TestBed.inject(AppStateService)
      const createCallSpy = jest.spyOn(searchConfigServiceSpy, 'createSearchConfig').mockReturnValue(of({} as any))
      jest.spyOn(appState.currentMfe$, 'asObservable').mockReturnValue(
        of({
          appId: 'my-app',
          productName: 'my-product'
        } as any)
      )

      // fieldValues is left undefined in the store so the `?? {}` fallback is exercised.
      store.patchState({
        searchConfigs: [],
        pageName: 'my_page',
        displayedColumnsIds: [],
        viewMode: advancedViewMode,
        selectedGroupKey: 'default'
      })
      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          result: {
            saveInputValues: true,
            saveColumns: false
          },
          button: 'primary'
        } as any)
      )

      component.onSearchConfigSave({
        searchConfigs: [],
        pageName: 'my_page',
        fieldValues: undefined,
        displayedColumnsIds: [],
        viewMode: advancedViewMode,
        selectedGroupKey: 'default',
        isColumnGroupComponentActive: true,
        layout: 'table',
        currentConfig: undefined,
        editMode: false,
        isInChargeOfEdit: false
      } as any)
      tick(500)

      expect(createCallSpy).toHaveBeenCalledWith({
        appId: 'my-app',
        productName: 'my-product',
        fieldListVersion: 0,
        isReadonly: false,
        page: 'my_page',
        name: '',
        isAdvanced: true,
        columns: [],
        values: {}
      })
    }))

    it('should save columns', fakeAsync(() => {
      const appState = TestBed.inject(AppStateService)
      const createCallSpy = jest.spyOn(searchConfigServiceSpy, 'createSearchConfig').mockReturnValue(of({} as any))
      jest.spyOn(appState.currentMfe$, 'asObservable').mockReturnValue(
        of({
          appId: 'my-app',
          productName: 'my-product'
        } as any)
      )

      store.patchState({
        searchConfigs: [],
        pageName: 'my-page',
        fieldValues: {},
        displayedColumnsIds: ['my-col', 'my-col2'],
        viewMode: basicViewMode,
        selectedGroupKey: 'default'
      })
      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          result: {
            searchConfigName: config.name,
            saveInputValues: false,
            saveColumns: true
          },
          button: 'primary'
        } as any)
      )

      component.onSearchConfigSave({
        searchConfigs: [],
        pageName: 'my-page',
        fieldValues: {},
        displayedColumnsIds: ['my-col', 'my-col2'],
        viewMode: basicViewMode,
        selectedGroupKey: 'default',
        isColumnGroupComponentActive: true,
        layout: 'table',
        currentConfig: undefined,
        editMode: false,
        isInChargeOfEdit: false
      } as any)
      tick(500)

      expect(createCallSpy).toHaveBeenCalledWith({
        appId: 'my-app',
        productName: 'my-product',
        fieldListVersion: 0,
        isReadonly: false,
        page: 'my-page',
        name: config.name,
        isAdvanced: false,
        columns: ['my-col', 'my-col2'],
        values: {}
      })
    }))

    it('should not add config when the create call failed', fakeAsync(() => {
      const error = new Error('my-error')
      const appState = TestBed.inject(AppStateService)
      const addSpy = jest.spyOn(store, 'addSearchConfig')
      const setSpy = jest.spyOn(store, 'setCurrentConfig')
      const consoleSpy = jest.spyOn(console, 'error')
      jest.spyOn(appState.currentMfe$, 'asObservable').mockReturnValue(
        of({
          appId: 'appId',
          productName: 'product'
        } as any)
      )

      store.patchState({
        searchConfigs: [],
        pageName: 'page_name',
        fieldValues: {},
        displayedColumnsIds: [],
        viewMode: basicViewMode,
        selectedGroupKey: 'default'
      })
      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          result: {
            searchConfigName: config.name
          },
          button: 'primary'
        } as any)
      )
      jest.spyOn(searchConfigServiceSpy, 'createSearchConfig').mockReturnValue(throwError(() => error))

      component.onSearchConfigSave({
        searchConfigs: [],
        pageName: 'page_name',
        fieldValues: {},
        displayedColumnsIds: [],
        viewMode: basicViewMode,
        selectedGroupKey: 'default',
        isColumnGroupComponentActive: true,
        layout: 'table',
        currentConfig: undefined,
        editMode: false,
        isInChargeOfEdit: false
      } as any)
      tick(500)

      expect(portalMessageSpy.error).toHaveBeenCalledWith({
        summaryKey: 'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CREATE_FAILURE'
      })
      expect(consoleSpy).toHaveBeenCalledWith(error)
      expect(addSpy).toHaveBeenCalledTimes(0)
      expect(setSpy).toHaveBeenCalledTimes(0)
    }))
  })

  describe('on delete actions', () => {
    it('should open the reusable delete dialog with the fixed Delete id, danger severity and dialog width when invoked', fakeAsync(() => {
      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(of(undefined as any))
      jest.spyOn(searchConfigServiceSpy, 'deleteSearchConfig').mockReturnValue(of({} as any))

      component.onSearchConfigDelete(config)
      tick(500)

      expect(portalDialogSpy.openDialog).toHaveBeenCalledWith(
        'SEARCH_CONFIG.DELETE_CONFIRM.HEADER',
        {
          key: 'SEARCH_CONFIG.DELETE_CONFIRM.MESSAGE',
          parameters: {
            config: config.name
          }
        },
        {
          key: 'SEARCH_CONFIG.DELETE_CONFIRM.DELETE',
          id: SEARCH_CONFIG_DELETE_BUTTON_ID,
          severity: 'danger'
        },
        'SEARCH_CONFIG.DELETE_DIALOG.CANCEL',
        { width: SEARCH_CONFIG_DIALOG_WIDTH }
      )
    }))

    it('should delete the config and show the success toast when the delete is confirmed', fakeAsync(() => {
      const deleteSpy = jest.spyOn(store, 'deleteSearchConfig')
      store.patchState({
        searchConfigs: [config]
      })

      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'primary'
        } as any)
      )
      jest.spyOn(searchConfigServiceSpy, 'deleteSearchConfig').mockReturnValue(of({} as any))

      component.onSearchConfigDelete(config)
      tick(500)

      expect(portalMessageSpy.success).toHaveBeenCalledWith({
        summaryKey: 'SEARCH_CONFIG.DELETE_CONFIRM.SUCCESS',
        summaryParameters: {
          config: config.name
        }
      })
      expect(deleteSpy).toHaveBeenCalledWith(config)
    }))

    it('should not delete the config when the dialog was closed', fakeAsync(() => {
      const deleteSpy = jest.spyOn(store, 'deleteSearchConfig')
      store.patchState({
        searchConfigs: [config]
      })

      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(of(undefined as any))

      component.onSearchConfigDelete(config)
      tick(500)

      expect(deleteSpy).toHaveBeenCalledTimes(0)
    }))

    it('should not delete the config when the secondary button was chosen', fakeAsync(() => {
      const deleteSpy = jest.spyOn(store, 'deleteSearchConfig')
      store.patchState({
        searchConfigs: [config]
      })

      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'secondary'
        } as any)
      )

      component.onSearchConfigDelete(config)
      tick(500)

      expect(deleteSpy).toHaveBeenCalledTimes(0)
    }))

    it('should not delete the config when the delete call failed', fakeAsync(() => {
      const deleteSpy = jest.spyOn(store, 'deleteSearchConfig')
      const consoleSpy = jest.spyOn(console, 'error')
      const error = new Error('my-error-msg')
      store.patchState({
        searchConfigs: [config]
      })

      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'primary'
        } as any)
      )
      jest.spyOn(searchConfigServiceSpy, 'deleteSearchConfig').mockReturnValue(throwError(() => error))

      component.onSearchConfigDelete(config)
      tick(500)

      expect(deleteSpy).toHaveBeenCalledTimes(0)
      expect(consoleSpy).toHaveBeenCalledWith(error)
      expect(portalMessageSpy.error).toHaveBeenCalledWith({
        summaryKey: 'SEARCH_CONFIG.DELETE_FAILURE'
      })
    }))
  })

  describe('on dataToRevert change', () => {
    it('should not emit if data does not contain viewMode', fakeAsync(() => {
      const emitterSpy = jest.spyOn(component.searchConfigSelected, 'emit')

      store.patchState({
        dataToRevert: {
          fieldValues: {
            k: 'v'
          },
          viewMode: undefined,
          displayedColumnsIds: ['col-2'],
          columnGroupKey: 'default'
        }
      })

      tick(500)

      expect(emitterSpy).toHaveBeenCalledTimes(0)
    }))

    it('should emit the reverted data with an undefined name when field values and view mode are present', fakeAsync(() => {
      const emitterSpy = jest.spyOn(component.searchConfigSelected, 'emit')

      store.patchState({
        dataToRevert: {
          fieldValues: {
            k: 'v'
          },
          viewMode: basicViewMode,
          displayedColumnsIds: ['col-1'],
          columnGroupKey: 'default'
        }
      })

      tick(500)

      expect(emitterSpy).toHaveBeenCalledWith({
        name: undefined,
        fieldValues: {
          k: 'v'
        },
        displayedColumnsIds: ['col-1'],
        viewMode: basicViewMode
      })
    }))
  })

  describe('on currentConfig change', () => {
    it('should emit undefined when no config is selected', fakeAsync(() => {
      const localFixture = TestBed.createComponent(OneCXSearchConfigComponent)
      const localComponent = localFixture.componentInstance
      localFixture.detectChanges()
      const localStore = (localComponent as any).searchConfigStore

      localStore.patchState({
        searchConfigs: [config],
        currentSearchConfig: config,
        fieldValues: { k: 'v' }
      })

      const emitterSpy = jest.spyOn(localComponent.searchConfigSelected, 'emit')

      localComponent.currentFieldValues = { k: 'v_2' }
      tick(500)

      expect(emitterSpy).toHaveBeenCalledWith(undefined)
    }))

    it('should emit all config data when selected config has values and columns', fakeAsync(() => {
      const localFixture = TestBed.createComponent(OneCXSearchConfigComponent)
      const localComponent = localFixture.componentInstance
      localFixture.detectChanges()
      const localStore = (localComponent as any).searchConfigStore
      const emitterSpy = jest.spyOn(localComponent.searchConfigSelected, 'emit')

      localStore.patchState({
        searchConfigs: [config],
        currentSearchConfig: undefined,
        columnGroupComponentActive: true,
        displayedSearchData: {
          fieldValues: { my_k: 'my_v' },
          viewMode: advancedViewMode,
          displayedColumnsIds: ['my_col']
        }
      })

      localComponent.onSearchConfigChange(config)
      tick(500)

      expect(emitterSpy).toHaveBeenCalledWith({
        name: config.name,
        fieldValues: config.values,
        displayedColumnsIds: config.columns,
        viewMode: config.isAdvanced ? advancedViewMode : basicViewMode
      })
    }))

    it('should emit only values config', fakeAsync(() => {
      const localFixture = TestBed.createComponent(OneCXSearchConfigComponent)
      const localComponent = localFixture.componentInstance
      localFixture.detectChanges()
      const localStore = (localComponent as any).searchConfigStore
      const emitterSpy = jest.spyOn(localComponent.searchConfigSelected, 'emit')

      localStore.patchState({
        searchConfigs: [onlyValuesConfig],
        currentSearchConfig: undefined,
        columnGroupComponentActive: true,
        displayedSearchData: {
          fieldValues: { my_k: 'my_v' },
          viewMode: advancedViewMode,
          displayedColumnsIds: ['my_col']
        }
      })

      localComponent.onSearchConfigChange(onlyValuesConfig)
      tick(500)

      expect(emitterSpy).toHaveBeenCalledWith({
        name: onlyValuesConfig.name,
        fieldValues: onlyValuesConfig.values,
        displayedColumnsIds: ['my_col'],
        viewMode: onlyValuesConfig.isAdvanced ? advancedViewMode : basicViewMode
      })
    }))

    it('should emit only columns config', fakeAsync(() => {
      const localFixture = TestBed.createComponent(OneCXSearchConfigComponent)
      const localComponent = localFixture.componentInstance
      localFixture.detectChanges()
      const localStore = (localComponent as any).searchConfigStore
      const emitterSpy = jest.spyOn(localComponent.searchConfigSelected, 'emit')

      localStore.patchState({
        searchConfigs: [onlyColumnsConfig],
        currentSearchConfig: onlyColumnsConfig,
        columnGroupComponentActive: true,
        displayedSearchData: {
          fieldValues: { my_k: 'my_v' },
          viewMode: advancedViewMode,
          displayedColumnsIds: ['my_col']
        }
      })

      tick(500)

      expect(emitterSpy).toHaveBeenLastCalledWith({
        name: onlyColumnsConfig.name,
        fieldValues: { my_k: 'my_v' },
        displayedColumnsIds: onlyColumnsConfig.columns,
        viewMode: advancedViewMode
      })

      localStore.patchState({
        currentSearchConfig: undefined
      })
      tick(500)

      localStore.patchState({
        currentSearchConfig: onlyColumnsConfig,
        displayedSearchData: {
          fieldValues: undefined,
          viewMode: advancedViewMode,
          displayedColumnsIds: ['my_col']
        }
      })
      tick(500)

      expect(emitterSpy).toHaveBeenLastCalledWith({
        name: onlyColumnsConfig.name,
        fieldValues: {},
        displayedColumnsIds: onlyColumnsConfig.columns,
        viewMode: advancedViewMode
      })
    }))

    it('should emit advancedViewMode when selected config is advanced', fakeAsync(() => {
      const advancedConfig = {
        ...config,
        isAdvanced: true
      }

      const localFixture = TestBed.createComponent(OneCXSearchConfigComponent)
      const localComponent = localFixture.componentInstance
      localFixture.detectChanges()
      const localStore = (localComponent as any).searchConfigStore

      localStore.patchState({
        searchConfigs: [advancedConfig],
        currentSearchConfig: undefined,
        columnGroupComponentActive: true,
        displayedSearchData: {
          fieldValues: { my_k: 'my_v' },
          viewMode: basicViewMode,
          displayedColumnsIds: ['my_col']
        }
      })

      const emitterSpy = jest.spyOn(localComponent.searchConfigSelected, 'emit')

      localStore.patchState({
        currentSearchConfig: advancedConfig
      })

      tick(500)

      expect(emitterSpy).toHaveBeenCalledWith({
        name: advancedConfig.name,
        fieldValues: advancedConfig.values,
        displayedColumnsIds: advancedConfig.columns,
        viewMode: advancedViewMode
      })
    }))
  })
})

@Component({
  standalone: true,
  imports: [OneCXSearchConfigComponent],
  template: '<app-ocx-search-config></app-ocx-search-config>'
})
class HostComponent {}

describe('OneCXSearchConfigHarness (remote host element)', () => {
  let hostFixture: ComponentFixture<HostComponent>
  let childStore: SearchConfigStore
  let childComponent: OneCXSearchConfigComponent

  const searchConfigServiceSpy = {
    getSearchConfigInfos: () =>
      of({
        configs: []
      } as any),
    createSearchConfig: jest.fn(),
    deleteSearchConfig: jest.fn(),
    getSearchConfig: jest.fn(),
    updateSearchConfig: jest.fn(),
    configuration: new Configuration({
      basePath: ''
    })
  } as unknown as SearchConfigAPIService

  let baseUrlSubject: ReplaySubject<any>

  const patchConfigs = async (configs: SearchConfigFixture[]) => {
    childStore.patchState({
      searchConfigs: configs
    })
    hostFixture.detectChanges()
    await delay(80)
    hostFixture.detectChanges()
    await hostFixture.whenStable()
  }

  // The panel renders inside the <p-select> host (PrimeNG's default `self` appendTo), so it stays
  // scoped to this remote; tooltips append to `body` (forced). #getSelectItems resolves against the
  // document root and works; pick the wanted row from the returned list.
  const findItemByText = async (items: Awaited<ReturnType<PSelectHarness['getSelectItems']>>, text: string) => {
    for (const item of items) {
      if ((await item.getText()) === text) {
        return item
      }
    }
    return null
  }

  const openItems = async () => (await harness()).getSelectItems()

  const harness = async () =>
    (await TestbedHarnessEnvironment.documentRootLoader(hostFixture).getHarness(
      OneCXSearchConfigHarness
    )) as OneCXSearchConfigHarness

  // `PortalDialogService`, `SearchConfigAPIService` and `PortalMessageService` are all
  // `providedIn: 'any'`, so the child would otherwise resolve the real services from the root
  // injector, not a root TestBed `useValue`. Override the component so the child injects the mocks
  // through DI (rather than mutating its private fields).
  const portalDialogHostMock = {
    openDialog: jest.fn()
  } as unknown as PortalDialogService

  const portalMessageHostMock = {
    info: jest.fn(),
    success: jest.fn(),
    error: jest.fn()
  } as unknown as PortalMessageService

  beforeAll(() => {
    // PrimeNG scrolls the selected select item into view when the panel opens, but jsdom does not
    // implement `scrollIntoView`. Stub it so opening the panel with a current selection does not throw.
    Element.prototype.scrollIntoView = () => {}
  })

  beforeEach(async () => {
    ;(portalDialogHostMock.openDialog as jest.Mock).mockReset()
    baseUrlSubject = new ReplaySubject<any>(1)
    TestBed.overrideComponent(OneCXSearchConfigComponent, {
      add: {
        providers: [
          { provide: PortalDialogService, useValue: portalDialogHostMock },
          { provide: SearchConfigAPIService, useValue: searchConfigServiceSpy },
          { provide: PortalMessageService, useValue: portalMessageHostMock }
        ]
      }
    })
    await TestBed.configureTestingModule({
      imports: [HostComponent, NoopAnimationsModule],
      providers: [
        ...provideTranslateTestingService({
          en: require('../../../assets/i18n/en.json'),
          de: require('../../../assets/i18n/de.json')
        }),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: REMOTE_COMPONENT_CONFIG,
          useValue: baseUrlSubject
        },
        {
          provide: SearchConfigStore,
          useClass: SearchConfigStore
        },
        {
          provide: SEARCH_CONFIG_STORE_NAME,
          useValue: 'store'
        },
        {
          provide: SEARCH_CONFIG_TOPIC,
          useValue: new FakeTopic<SearchConfigMessage>()
        },
        DialogService,
        {
          provide: PortalDialogService,
          useValue: { openDialog: jest.fn() }
        },
        {
          provide: PortalMessageService,
          useValue: { info: jest.fn(), success: jest.fn(), error: jest.fn() }
        },
        {
          provide: SearchConfigAPIService,
          useValue: searchConfigServiceSpy
        }
      ]
    }).compileComponents()

    baseUrlSubject.next('base_url_mock')
    hostFixture = TestBed.createComponent(HostComponent)
    const child = hostFixture.debugElement.query(By.directive(OneCXSearchConfigComponent))!
    childComponent = child.componentInstance
    childComponent.permissions = ['SEARCHCONFIG#VIEW', 'SEARCHCONFIG#DELETE']
    hostFixture.detectChanges()

    childStore = TestBed.inject(SearchConfigStore)
  })

  it('should render the Search Config label and Save As button when configs are available', async () => {
    await patchConfigs([config])

    const label = hostFixture.nativeElement.querySelector('.sc-search-config-label')
    expect(label).toBeTruthy()
    expect(label.textContent.trim()).toBe('Search Config')

    const saveAs = await (await harness()).getSaveAsButton()
    expect(saveAs).not.toBeNull()
    expect(await (saveAs as NonNullable<typeof saveAs>).getLabel()).toBe('Save As')
    // PrimeNG 21 renders p-button[icon] as a signal input (no ng-reflect-icon), so assert the
    // rendered icon span's classes instead of the harness' getIcon().
    const iconSpan = hostFixture.nativeElement.querySelector(
      `#${SEARCH_CONFIG_SAVE_AS_BUTTON_ID} .p-button-icon`
    ) as HTMLElement
    expect(iconSpan).toBeTruthy()
    expect(iconSpan.classList.contains('pi-save')).toBe(true)
  })

  it('should expose the config select label to the inner combobox', async () => {
    await patchConfigs([config])

    // The <label> is wired to the select through [ariaLabelledBy] on the <p-select> host; PrimeNG
    // forwards that attribute down to its inner role="combobox" element, so the combobox keeps an
    // accessible name for screen readers.
    const combobox = hostFixture.nativeElement.querySelector('p-select span[role="combobox"]') as HTMLElement
    expect(combobox).toBeTruthy()
    expect(combobox.getAttribute('aria-labelledby')).toBe('sc_search_config_label')
  })

  it('should render the No search configs label and a disabled select when no config is available', async () => {
    await patchConfigs([])

    const label = hostFixture.nativeElement.querySelector('.sc-search-config-label')
    expect(label.textContent.trim()).toBe('No search configs')

    // The empty select is disabled; Save As stays enabled.
    const selectLabel = hostFixture.nativeElement.querySelector('p-select span[role="combobox"]')
    expect(selectLabel.getAttribute('aria-disabled')).toBe('true')

    const saveAs = await (await harness()).getSaveAsButton()
    expect(saveAs).not.toBeNull()
    const saveAsButton = hostFixture.nativeElement.querySelector(
      `#${SEARCH_CONFIG_SAVE_AS_BUTTON_ID} button`
    ) as HTMLButtonElement
    expect(saveAsButton.disabled).toBe(false)
  })

  it('should list only the value-storing config names in the select when a criteria-only config is present', async () => {
    // `onlyColumnsConfig` stores columns only (no values), so it is filtered out of `searchConfigVm$`
    // and its row must not render — the criteria-only filter is exercised at the DOM level.
    await patchConfigs([config, onlyValuesConfig, onlyColumnsConfig])

    const items = await openItems()
    const texts = await Promise.all(items.map((item) => item.getText()))
    expect(texts).toEqual(['config-1', 'config-2'])
  })

  it('should render the select and its opened panel inside the remote element with the style hooks', async () => {
    await patchConfigs([config])

    const items = await openItems()
    await hostFixture.whenStable()
    expect(items.length).toBeGreaterThan(0)

    // The select host carries the styleClass hook.
    const select = hostFixture.nativeElement.querySelector('p-select') as HTMLElement
    expect(select.classList.contains('sc-search-config-select')).toBe(true)

    // The opened panel carries the panelStyleClass hook and renders inside `<p-select>` (PrimeNG
    // default `self`), which is a descendant of the remote element, so it resolves from the remote
    // element rather than the document body.
    const panel = hostFixture.nativeElement.querySelector('.sc-search-config-panel') as HTMLElement
    expect(panel).toBeTruthy()
  })

  it('should apply the config when its row is clicked', async () => {
    await patchConfigs([config])

    const changeSpy = jest.spyOn(childComponent, 'onSearchConfigChange')
    const items = await openItems()
    const item = await findItemByText(items, 'config-1')
    expect(item).not.toBeNull()
    await (item as NonNullable<typeof item>).selectItem()
    await hostFixture.whenStable()

    expect(changeSpy).toHaveBeenCalledWith(expect.objectContaining({ id: config.id, name: config.name }))
  })

  it('should open the delete dialog when the trash button is clicked, without selecting the row', async () => {
    ;(portalDialogHostMock.openDialog as jest.Mock).mockReturnValue(of(undefined as any))

    await patchConfigs([config])
    const changeSpy = jest.spyOn(childComponent, 'onSearchConfigChange')
    const trashButton = await (await harness()).getDeleteButton(config.name)
    expect(trashButton).toBeTruthy()

    ;(trashButton as HTMLButtonElement).click()
    await hostFixture.whenStable()

    expect(portalDialogHostMock.openDialog).toHaveBeenCalledWith(
      'SEARCH_CONFIG.DELETE_CONFIRM.HEADER',
      {
        key: 'SEARCH_CONFIG.DELETE_CONFIRM.MESSAGE',
        parameters: {
          config: config.name
        }
      },
      {
        key: 'SEARCH_CONFIG.DELETE_CONFIRM.DELETE',
        id: SEARCH_CONFIG_DELETE_BUTTON_ID,
        severity: 'danger'
      },
      'SEARCH_CONFIG.DELETE_DIALOG.CANCEL',
      { width: SEARCH_CONFIG_DIALOG_WIDTH }
    )
    // The trash click stops propagation, so the row is not selected.
    expect(changeSpy).not.toHaveBeenCalled()
  })

  it('should render no trash button when the SEARCHCONFIG#DELETE permission is missing', async () => {
    childComponent.permissions = ['SEARCHCONFIG#VIEW']
    await patchConfigs([config])

    const row = await (await harness()).getRowByName(config.name)
    expect(row).toBeTruthy()
    expect(row.querySelector('.sc-search-config-delete')).toBeFalsy()
  })

  it('should keep the Save As button enabled and open the save dialog when clicked', async () => {
    await patchConfigs([config])

    const saveAs = await (await harness()).getSaveAsButton()
    const saveAsButton = hostFixture.nativeElement.querySelector(
      `#${SEARCH_CONFIG_SAVE_AS_BUTTON_ID} button`
    ) as HTMLButtonElement
    expect(saveAsButton.disabled).toBe(false)

    const saveSpy = jest.spyOn(childComponent, 'onSearchConfigSave').mockImplementation(() => {})
    await (saveAs as NonNullable<typeof saveAs>).click()

    expect(saveSpy).toHaveBeenCalled()
  })

  it('should disable the config select when the column remote is in edit mode', async () => {
    await patchConfigs([config])
    childStore.patchState({
      editMode: true
    })
    await delay(80)
    hostFixture.detectChanges()
    await hostFixture.whenStable()

    // The `[disabled]` guard (`vm.searchConfigs.length === 0 || vm.editMode`) forces the select closed
    // while another remote holds the edit lock, so a picked row can no longer desync from the applied
    // `currentConfig` (which `setCurrentConfig` ignores in edit mode).
    const combobox = hostFixture.nativeElement.querySelector('p-select span[role="combobox"]')
    expect(combobox.getAttribute('aria-disabled')).toBe('true')
  })

  it('should disable the Save As button when the column remote is in edit mode', async () => {
    await patchConfigs([config])
    childStore.patchState({
      editMode: true
    })
    await delay(80)
    hostFixture.detectChanges()
    await hostFixture.whenStable()

    const saveAsButton = hostFixture.nativeElement.querySelector(
      `#${SEARCH_CONFIG_SAVE_AS_BUTTON_ID} button`
    ) as HTMLButtonElement
    expect(saveAsButton.disabled).toBe(true)
  })

  it('should delete the focused option when Delete is pressed on an open select', async () => {
    ;(portalDialogHostMock.openDialog as jest.Mock).mockReturnValue(of(undefined as any))

    await patchConfigs([config])

    const deleteSpy = jest.spyOn(childComponent, 'onSearchConfigDelete').mockImplementation(() => {})
    const combobox = hostFixture.nativeElement.querySelector('p-select span[role="combobox"]') as HTMLElement

    const select = (childComponent as any).select() as Select
    expect(select).toBeTruthy()

    // Guard branches (exercised by calling the handler directly so PrimeNG's own keydown side
    // effects — e.g. Escape closing the panel — do not interfere):
    // a non-Delete key is ignored regardless of panel state...
    childComponent.onSearchConfigSelectKeydown({ code: 'Escape' } as KeyboardEvent)
    expect(deleteSpy).not.toHaveBeenCalled()
    // ...and Delete while the panel is closed is a no-op. (PrimeNG leaves `overlayVisible`
    // undefined until the panel is shown, which the handler treats as closed.)
    expect(select.overlayVisible).toBeFalsy()
    childComponent.onSearchConfigSelectKeydown({ code: 'Delete' } as KeyboardEvent)
    expect(deleteSpy).not.toHaveBeenCalled()

    // Open the panel (through the harness) and exercise the real DOM keydown path end-to-end.
    const configSelect = await (await harness()).getConfigSelect()
    await configSelect?.open()
    await hostFixture.whenStable()
    expect(select.overlayVisible).toBe(true)
    // No option is focused yet (default focusedOptionIndex is -1), so Delete is ignored.
    expect(select.focusedOptionIndex()).toBe(-1)
    combobox.dispatchEvent(new KeyboardEvent('keydown', { code: 'Delete', bubbles: true }))
    await hostFixture.whenStable()
    expect(deleteSpy).not.toHaveBeenCalled()

    // Focus the (single) option and press Delete again: the keyboard path deletes it.
    select.focusedOptionIndex.set(0)
    combobox.dispatchEvent(new KeyboardEvent('keydown', { code: 'Delete', bubbles: true }))
    await hostFixture.whenStable()
    expect(deleteSpy).toHaveBeenCalledWith(config)
  })

  it('should not delete via the keyboard path when the focused option is not deletable or is out of range', async () => {
    ;(portalDialogHostMock.openDialog as jest.Mock).mockReturnValue(of(undefined as any))

    await patchConfigs([config, readonlyConfig])
    await (await (await harness()).getConfigSelect())?.open()
    await hostFixture.whenStable()

    const select = (childComponent as any).select() as Select
    expect(select.overlayVisible).toBe(true)

    const deleteSpy = jest.spyOn(childComponent, 'onSearchConfigDelete').mockImplementation(() => {})
    const visibleOptions = select.visibleOptions()

    // Focused on the read-only option: `canDelete` is false, so Delete is a no-op.
    const readonlyIndex = visibleOptions.findIndex((option: any) => option.id === readonlyConfig.id)
    expect(readonlyIndex).toBeGreaterThanOrEqual(0)
    select.focusedOptionIndex.set(readonlyIndex)
    childComponent.onSearchConfigSelectKeydown({ code: 'Delete' } as KeyboardEvent)
    await hostFixture.whenStable()
    expect(deleteSpy).not.toHaveBeenCalled()

    // Focused out of range: `visibleOptions()[index]` is undefined, so Delete is a no-op.
    select.focusedOptionIndex.set(visibleOptions.length)
    childComponent.onSearchConfigSelectKeydown({ code: 'Delete' } as KeyboardEvent)
    await hostFixture.whenStable()
    expect(deleteSpy).not.toHaveBeenCalled()
  })

  it('should show the full config name with a tooltip that appears on ellipsis', async () => {
    await patchConfigs([config])

    // The row name renders the full config name and carries the `pTooltip` directive wired to the same
    // name with `showOnEllipsis`. The tooltip container only mounts once shown (and does not reliably
    // render in jsdom), so assert on the rendered full-name text and the directive instance's options.
    const row = await (await harness()).getRowByName(config.name)
    const nameSpan = row.querySelector('.sc-search-config-row-name') as HTMLElement
    expect(nameSpan).toBeTruthy()
    expect(nameSpan.textContent.trim()).toBe(config.name)

    const tooltip = hostFixture.debugElement.query(By.css(`.sc-search-config-row-name`)).injector.get(Tooltip)
    expect(tooltip).toBeTruthy()
    expect(tooltip.getOption('showOnEllipsis')).toBe(true)
    expect(tooltip.getOption('tooltipLabel')).toBe(config.name)
  })

  it('should clear the select and emit the cleared selection when the selected config is deleted', async () => {
    await patchConfigs([config, onlyValuesConfig])

    // Seed the displayed data: the `searchConfigSelected` emission is driven by `currentConfig$`
    // combined (via `withLatestFrom`) with `currentDisplayedData$`, which is filtered until
    // `displayedSearchData` exists.
    childStore.patchState({
      displayedSearchData: {
        fieldValues: {},
        displayedColumnsIds: [],
        viewMode: basicViewMode
      }
    })

    // Select config-1 through the store (rather than the panel) so the panel is opened exactly once,
    // by the trash-button lookup below.
    childStore.setCurrentConfig(config)
    await delay(80)
    hostFixture.detectChanges()
    await hostFixture.whenStable()

    const select = (childComponent as any).select() as Select
    expect(select.label()).toBe(config.name)

    // Delete the selected config through the (mocked) confirm dialog.
    ;(portalDialogHostMock.openDialog as jest.Mock).mockReturnValue(of({ button: 'primary' } as any))
    ;(searchConfigServiceSpy.deleteSearchConfig as jest.Mock).mockReturnValue(of({} as any))
    const searchConfigSelectedSpy = jest.spyOn(childComponent.searchConfigSelected, 'emit')
    const trashButton = (await (await harness()).getDeleteButton(config.name)) as HTMLButtonElement
    trashButton.click()
    await hostFixture.whenStable()
    // `store.deleteSearchConfig` runs in a `setTimeout` and `currentConfig$` is debounced (50ms).
    await delay(120)
    hostFixture.detectChanges()
    await hostFixture.whenStable()

    // The deleted config was the current one, so the select no longer shows a value and the applied
    // selection resets (the page's own values/columns are untouched — the store just clears the current
    // config, which surfaces as a cleared `searchConfigSelected`).
    expect(select.label()).toBe('p-emptylabel')
    expect(searchConfigSelectedSpy).toHaveBeenCalledWith(undefined)
  })

  it('should show the filter placeholder and the no-match text for a non-matching filter', async () => {
    await patchConfigs([config, onlyValuesConfig])

    // Open the panel so the in-panel filter input is rendered.
    await openItems()
    await hostFixture.whenStable()

    const filterInput = hostFixture.nativeElement.querySelector('p-select input[role="searchbox"]') as HTMLInputElement
    expect(filterInput).toBeTruthy()
    expect(filterInput.placeholder).toBe('Filter by name')

    filterInput.value = 'does-not-exist'
    filterInput.dispatchEvent(new Event('input', { bubbles: true }))
    await delay(150)
    hostFixture.detectChanges()
    await hostFixture.whenStable()

    const emptyMessage = hostFixture.nativeElement.querySelector('.p-select-empty-message')
    expect(emptyMessage).toBeTruthy()
    expect(emptyMessage!.textContent.trim()).toBe('No matching configs')
  })

  it('should render the trash button inside a deletable row and none inside a read-only row', async () => {
    await patchConfigs([config, readonlyConfig])

    // The panel renders one row per option; the read-only config's row renders no trash button.
    const h = await harness()
    expect(await h.getDeleteButton(config.name)).toBeTruthy()
    expect(await h.getDeleteButton(readonlyConfig.name)).toBeNull()
  })

  it('should reject getRowByName when no row matches the given name', async () => {
    // A criteria-only config (no values) is patched but filtered out of the value-storing rows, so the
    // panel renders no row for it and `getRowByName` rejects.
    await patchConfigs([config, onlyColumnsConfig])

    const h = await harness()
    await expect(h.getRowByName(onlyColumnsConfig.name)).rejects.toThrow(
      `No search-config row found for name "${onlyColumnsConfig.name}"`
    )
  })
})

describe('search-config zone-based change detection', () => {
  it('boots the remote providers and injects a real NgZone (not NoopNgZone)', async () => {
    const shellMocks = [
      provideAppConfigServiceMock(),
      provideAppStateServiceMock(),
      provideConfigurationServiceMock(),
      providePortalMessageServiceMock(),
      provideRemoteComponentsServiceMock(),
      provideShellCapabilityServiceMock()
    ].flat()

    // The accelerator's own APP_INITIALIZER awaits `firstValueFrom(userService.lang$.pipe(skip(1)))`,
    // so the UserService stub must emit `lang$` at least twice for the app initializer
    // to resolve under the test environment (the locale-data load itself is wrapped in a
    // try/catch inside the accelerator, so its jsdom limitation is non-fatal).
    const userServiceStub = {
      isInitialized: Promise.resolve(),
      lang$: of('en', 'en')
    }

    const providers: (Provider | EnvironmentProviders)[] = [
      ...searchConfigProviders(undefined),
      ...shellMocks,
      { provide: UserService, useValue: userServiceStub }
    ]
    const app = await createApplication({ providers })
    const zone = app.injector.get(NgZone)

    expect(zone).toBeInstanceOf(NgZone)
    expect(zone).not.toBeInstanceOf(NoopNgZone)

    app.destroy()
  }, 20000)

  it('reuses the shell NgZone instead of creating a private one', async () => {
    const shellZone = new NgZone({})
    // The shell publishes its NgZone here before the remote boots; the remote's
    // providers must re-provide this same instance (see createRemoteProviders).
    getWindowState().ngZone = shellZone

    const providers: (Provider | EnvironmentProviders)[] = [
      { provide: NgZone, useValue: shellZone },
      ...searchConfigProviders(undefined),
      {
        provide: UserService,
        useValue: { isInitialized: Promise.resolve(), lang$: of('en', 'en') }
      }
    ]
    const app = await createApplication({ providers })

    expect(app.injector.get(NgZone)).toBeInstanceOf(NgZone)
    expect(app.injector.get(NgZone)).toBe(shellZone)

    app.destroy()
  }, 20000)
})
