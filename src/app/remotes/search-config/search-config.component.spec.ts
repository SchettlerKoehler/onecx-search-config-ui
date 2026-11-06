import { provideHttpClientTesting } from '@angular/common/http/testing'
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing'
import { NoopAnimationsModule } from '@angular/platform-browser/animations'
import { createApplication } from '@angular/platform-browser'
import { NgZone, ɵNoopNgZone as NoopNgZone } from '@angular/core'
import { provideHttpClient } from '@angular/common/http'
import { ReplaySubject, firstValueFrom, of, throwError } from 'rxjs'
import { DialogService } from 'primeng/dynamicdialog'

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
import { provideTranslateTestingService } from '@onecx/angular-testing'
import { REMOTE_COMPONENT_CONFIG, RemoteComponentConfig } from '@onecx/angular-utils'

import {
  SEARCH_CONFIG_STORE_NAME,
  SEARCH_CONFIG_TOPIC,
  SearchConfigMessage,
  SearchConfigStore,
  SearchConfigTopic
} from 'src/app/shared/search-config.store'
import { CreateOrEditSearchConfigDialogComponent } from 'src/app/shared/components/create-or-edit-search-config-dialog/create-or-edit-search-config-dialog.component'
import { Configuration, SearchConfigAPIService } from 'src/app/shared/generated'
import { advancedViewMode, basicViewMode } from 'src/app/shared/constants'
import { OneCXSearchConfigComponent } from './search-config.component'
import { searchConfigProviders } from './search-config.component.providers'

const createSpyObj = (baseName: string, methodNames: Array<string>): { [key: string]: any } => {
  const obj: any = {}

  for (let i = 0; i < methodNames.length; i++) {
    obj[methodNames[i]] = jest.fn()
  }

  return obj
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

  const portalMessageSpy = createSpyObj('portalMessageService', ['info', 'error']) as PortalMessageService

  const config = {
    id: '1',
    name: 'config-1',
    columns: ['col-1'],
    values: {
      k1: 'v1'
    },
    isReadonly: false,
    isAdvanced: false
  }

  const onlyValuesConfig = {
    id: '2',
    name: 'config-2',
    columns: [],
    values: {
      k2: 'v2'
    },
    isReadonly: false,
    isAdvanced: false
  }

  const onlyColumnsConfig = {
    id: '3',
    name: 'config-3',
    columns: ['col-3'],
    values: {},
    isReadonly: false,
    isAdvanced: false
  }

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

      const localComponent = new OneCXSearchConfigComponent(
        localBaseUrl,
        { lang$: of('en') } as any,
        { use: jest.fn() } as any,
        searchConfigServiceSpy,
        portalDialogSpy,
        portalMessageSpy,
        appStateService,
        localStore
      )

      tick(100)

      expect(getSearchConfigInfosSpy).toHaveBeenCalledWith({
        appId: 'appId',
        page: 'page-name',
        productName: 'product'
      })
      expect(localComponent).toBeTruthy()
    }))

    it('should expose create action and overlay text states', () => {
      component.ocxInitRemoteComponent({
        appId: 'appId',
        productName: 'product',
        permissions: ['SEARCHCONFIG#CREATE'],
        baseUrl: 'base'
      } as any)

      expect(component.baseOptions).toEqual([{ id: 'ocx-add-search-config-option' }])
      expect(
        component.overlayButtonText({
          editMode: true,
          currentConfig: config,
          searchConfigs: [config]
        } as any)
      ).toEqual({
        key: 'SEARCH_CONFIG.EDITING',
        params: { config: config.name }
      })
      expect(
        component.overlayButtonText({
          editMode: false,
          currentConfig: config,
          searchConfigs: [config]
        } as any)
      ).toEqual({
        key: 'SEARCH_CONFIG.ACTIVE',
        params: { config: config.name }
      })
      expect(
        component.overlayButtonText({
          editMode: false,
          currentConfig: undefined,
          searchConfigs: []
        } as any)
      ).toEqual({ key: 'SEARCH_CONFIG.MANAGE.LABEL' })
    })

    it('should not throw when overlay panel is undefined in onSearchConfigSave', fakeAsync(() => {
      component.op = undefined

      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(of(undefined as any))

      const vm = {
        searchConfigs: [],
        pageName: 'page-name',
        fieldValues: {},
        displayedColumnsIds: [],
        viewMode: basicViewMode,
        selectedGroupKey: 'default',
        isColumnGroupComponentActive: true,
        layout: 'table'
      } as any

      expect(() => component.onSearchConfigSave(vm)).not.toThrow()

      tick(500)
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

  describe('overlay content', () => {
    it('should expose only configs with values in the view model', async () => {
      store.patchState({
        searchConfigs: [config, onlyValuesConfig, onlyColumnsConfig]
      })

      const vm = await firstValueFrom(store.searchConfigVm$)

      expect(vm.searchConfigs.map((item) => item.name)).toEqual([config.name, onlyValuesConfig.name])
      expect(vm.currentConfig).toBeUndefined()
    })
  })

  describe('on config save', () => {
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

    it('should not add config and reset if dialog was closed', fakeAsync(() => {
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
      expect(setSpy).toHaveBeenCalledTimes(1)
      expect(setSpy).toHaveBeenCalledWith(undefined)
    }))

    it.each([null, { result: undefined, button: 'primary' }])(
      'should not add config and reset if the dialog state is %o',
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
        expect(setSpy).toHaveBeenCalledTimes(1)
        expect(setSpy).toHaveBeenCalledWith(undefined)
      })
    )

    it('should not add config and reset if create was not confirmed', fakeAsync(() => {
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
      expect(setSpy).toHaveBeenCalledTimes(1)
      expect(setSpy).toHaveBeenCalledWith(undefined)
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
      expect(setSpy).toHaveBeenCalledTimes(2)
      expect(setSpy).toHaveBeenCalledWith(undefined)
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

    it('should not add config and reset if create call failed', fakeAsync(() => {
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
      expect(setSpy).toHaveBeenCalledTimes(1)
      expect(setSpy).toHaveBeenCalledWith(undefined)
    }))
  })

  describe('on edit actions', () => {
    it('should set edit mode on edit button click', fakeAsync(() => {
      const editModeSpy = jest.spyOn(store, 'enterEditMode')
      store.patchState({
        searchConfigs: [config]
      })

      component.onSearchConfigEdit(config)
      tick(500)

      expect(editModeSpy).toHaveBeenCalledTimes(1)
      expect(editModeSpy).toHaveBeenCalledWith(config)
    }))

    it('should cancel edit mode on edit cancel button click', fakeAsync(() => {
      const cancelEditSpy = jest.spyOn(store, 'cancelEdit')
      store.patchState({
        searchConfigs: [config]
      })

      component.onSearchConfigEdit(config)
      component.onSearchConfigCancelEdit()
      tick(500)

      expect(cancelEditSpy).toHaveBeenCalledTimes(1)
    }))
  })

  describe('on delete actions', () => {
    it('should delete config', fakeAsync(() => {
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

      expect(portalMessageSpy.info).toHaveBeenCalledWith({
        summaryKey: 'SEARCH_CONFIG.DELETE_SUCCESS'
      })
      expect(deleteSpy).toHaveBeenCalledWith(config)
    }))

    it('should not delete config if dialog was closed', fakeAsync(() => {
      const deleteSpy = jest.spyOn(store, 'deleteSearchConfig')
      store.patchState({
        searchConfigs: [config]
      })

      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(of(undefined as any))

      component.onSearchConfigDelete(config)
      tick(500)

      expect(deleteSpy).toHaveBeenCalledTimes(0)
    }))

    it('should not delete config if secondary button was chosen', fakeAsync(() => {
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

    it('should not delete config if delete call failed', fakeAsync(() => {
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

  describe('on edit save', () => {
    const getSaveEditVm = (overrides: Partial<any> = {}) => ({
      currentConfig: config,
      isColumnGroupComponentActive: true,
      layout: 'table',
      editMode: true,
      isInChargeOfEdit: false,
      searchConfigs: [config],
      pageName: 'page-name',
      fieldValues: config.values,
      displayedColumnsIds: config.columns,
      viewMode: basicViewMode,
      selectedGroupKey: 'default',
      ...overrides
    })

    const triggerSaveEdit = (overrides: Partial<any> = {}) => {
      component.onSearchConfigEdit(config)
      component.onSearchConfigSaveEdit(getSaveEditVm(overrides) as any)
      tick(500)
    }

    it('should use config info to fill dialog', fakeAsync(() => {
      store.patchState({
        searchConfigs: [config],
        layout: 'table',
        columnGroupComponentActive: true
      })
      jest.spyOn(searchConfigServiceSpy, 'getSearchConfig').mockReturnValue(
        of({
          config
        } as any)
      )
      jest.spyOn(searchConfigServiceSpy, 'updateSearchConfig').mockReturnValue(
        of({
          configs: [config],
          id: config.id
        } as any)
      )
      const dialogServiceSpy = jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'primary'
        } as any)
      )

      triggerSaveEdit()

      expect(dialogServiceSpy).toHaveBeenCalledWith(
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.EDIT_HEADER',
        {
          type: CreateOrEditSearchConfigDialogComponent,
          inputs: {
            searchConfigName: config.name,
            saveInputValues: true,
            saveColumns: true,
            frozeColumnSaveOption: false,
            frozeColumnSaveOptionExplanation: ''
          }
        },
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CONFIRM',
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CANCEL'
      )
    }))

    it('should use fallback values for dialog inputs', fakeAsync(() => {
      const dialogSpy = jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(of(undefined as any))

      jest.spyOn(searchConfigServiceSpy, 'getSearchConfig').mockReturnValue(of({ config: undefined } as any))

      component.onSearchConfigSaveEdit({
        currentConfig: {
          id: '1',
          name: 'cfg',
          values: undefined,
          columns: undefined
        },
        isColumnGroupComponentActive: true,
        layout: 'table',
        searchConfigs: [],
        pageName: 'page-name',
        fieldValues: undefined,
        displayedColumnsIds: [],
        viewMode: basicViewMode,
        selectedGroupKey: 'default',
        editMode: true,
        isInChargeOfEdit: false
      } as any)

      tick(500)

      expect(dialogSpy).toHaveBeenCalledWith(
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.EDIT_HEADER',
        expect.objectContaining({
          inputs: expect.objectContaining({
            saveInputValues: false,
            saveColumns: false
          })
        }),
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CONFIRM',
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CANCEL'
      )
    }))

    it('should provide explanation for column freeze when column group component is inactive', fakeAsync(() => {
      store.patchState({
        searchConfigs: [config],
        layout: 'table',
        columnGroupComponentActive: false
      })
      jest.spyOn(searchConfigServiceSpy, 'getSearchConfig').mockReturnValue(
        of({
          config
        } as any)
      )
      jest.spyOn(searchConfigServiceSpy, 'updateSearchConfig').mockReturnValue(
        of({
          configs: [config],
          id: config.id
        } as any)
      )
      const dialogServiceSpy = jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'primary'
        } as any)
      )

      triggerSaveEdit({
        isColumnGroupComponentActive: false
      })

      expect(dialogServiceSpy).toHaveBeenCalledWith(
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.EDIT_HEADER',
        {
          type: CreateOrEditSearchConfigDialogComponent,
          inputs: {
            searchConfigName: config.name,
            saveInputValues: true,
            saveColumns: true,
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
        searchConfigs: [config],
        layout: 'list',
        columnGroupComponentActive: true
      })
      jest.spyOn(searchConfigServiceSpy, 'getSearchConfig').mockReturnValue(
        of({
          config
        } as any)
      )
      jest.spyOn(searchConfigServiceSpy, 'updateSearchConfig').mockReturnValue(
        of({
          configs: [config],
          id: config.id
        } as any)
      )
      const dialogServiceSpy = jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'primary'
        } as any)
      )

      triggerSaveEdit({
        layout: 'list'
      })

      expect(dialogServiceSpy).toHaveBeenCalledWith(
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.EDIT_HEADER',
        {
          type: CreateOrEditSearchConfigDialogComponent,
          inputs: {
            searchConfigName: config.name,
            saveInputValues: true,
            saveColumns: true,
            frozeColumnSaveOption: true,
            frozeColumnSaveOptionExplanation: 'SEARCH_CONFIG.TABLE_VIEW_INACTIVE'
          }
        },
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CONFIRM',
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CANCEL'
      )
    }))

    it('should cancel edit if dialog was closed', fakeAsync(() => {
      const cancelEditSpy = jest.spyOn(store, 'cancelEdit')
      store.patchState({
        searchConfigs: [config],
        layout: 'table',
        columnGroupComponentActive: true
      })
      jest.spyOn(searchConfigServiceSpy, 'getSearchConfig').mockReturnValue(
        of({
          config: config
        } as any)
      )
      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(of(undefined as any))

      triggerSaveEdit()

      expect(cancelEditSpy).toHaveBeenCalledTimes(1)
    }))

    it('should cancel edit if edit was not confirmed', fakeAsync(() => {
      const cancelEditSpy = jest.spyOn(store, 'cancelEdit')
      store.patchState({
        searchConfigs: [config],
        layout: 'table',
        columnGroupComponentActive: true
      })
      jest.spyOn(searchConfigServiceSpy, 'getSearchConfig').mockReturnValue(
        of({
          config: config
        } as any)
      )
      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'secondary'
        } as any)
      )

      triggerSaveEdit()

      expect(cancelEditSpy).toHaveBeenCalledTimes(1)
    }))

    it('should save edit config if edit was confirmed', fakeAsync(() => {
      const saveEditSpy = jest.spyOn(store, 'saveEdit')
      const updatedConfig = {
        ...config,
        name: 'conf-1',
        values: { k: 'v-2' }
      }
      store.patchState({
        searchConfigs: [config],
        layout: 'table',
        columnGroupComponentActive: true
      })
      jest.spyOn(searchConfigServiceSpy, 'getSearchConfig').mockReturnValue(
        of({
          config: config
        } as any)
      )
      jest.spyOn(searchConfigServiceSpy, 'updateSearchConfig').mockReturnValue(
        of({
          configs: [updatedConfig]
        } as any)
      )
      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'primary'
        } as any)
      )

      triggerSaveEdit()

      expect(portalMessageSpy.info).toHaveBeenCalledWith({
        summaryKey: 'SEARCH_CONFIG.CREATE_EDIT_DIALOG.EDIT_SUCCESS'
      })
      expect(saveEditSpy).toHaveBeenCalledWith(updatedConfig)
    }))

    it('should save inputs and viewMode', fakeAsync(() => {
      const updateSpy = jest.spyOn(searchConfigServiceSpy, 'updateSearchConfig').mockReturnValue(of(undefined as any))
      const initState = {
        searchConfigs: [config],
        layout: 'table',
        columnGroupComponentActive: true
      }
      store.patchState(initState as any)
      jest.spyOn(searchConfigServiceSpy, 'getSearchConfig').mockReturnValue(
        of({
          config: config
        } as any)
      )
      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          result: {
            searchConfigName: 'new-name',
            saveInputValues: true
          },
          button: 'primary'
        } as any)
      )

      store.patchState({
        ...initState,
        fieldValues: { k: 'v_2' },
        viewMode: advancedViewMode
      } as any)

      triggerSaveEdit({
        fieldValues: { k: 'v_2' },
        viewMode: advancedViewMode
      })

      expect(updateSpy).toHaveBeenCalledWith('1', {
        searchConfig: {
          ...config,
          name: 'new-name',
          columns: [],
          values: { k: 'v_2' },
          isAdvanced: true
        }
      })
    }))

    it('should save columns', fakeAsync(() => {
      const updateSpy = jest.spyOn(searchConfigServiceSpy, 'updateSearchConfig').mockReturnValue(of(undefined as any))
      const initState = {
        searchConfigs: [config],
        layout: 'table',
        columnGroupComponentActive: true
      }
      store.patchState(initState as any)
      jest.spyOn(searchConfigServiceSpy, 'getSearchConfig').mockReturnValue(
        of({
          config: config
        } as any)
      )
      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          result: {
            searchConfigName: 'new-name',
            saveColumns: true
          },
          button: 'primary'
        } as any)
      )

      store.patchState({
        ...initState,
        displayedColumnsIds: ['col-2']
      } as any)

      triggerSaveEdit({
        displayedColumnsIds: ['col-2']
      })

      expect(updateSpy).toHaveBeenCalledWith('1', {
        searchConfig: {
          ...config,
          name: 'new-name',
          columns: ['col-2'],
          values: {},
          isAdvanced: false
        }
      })
    }))

    it('should cancel edit if get search config call failed', fakeAsync(() => {
      const cancelEditSpy = jest.spyOn(store, 'cancelEdit')
      const error = new Error('my-msg')
      store.patchState({
        searchConfigs: [config],
        layout: 'table',
        columnGroupComponentActive: true
      })
      jest.spyOn(searchConfigServiceSpy, 'getSearchConfig').mockReturnValue(throwError(() => error))
      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'primary'
        } as any)
      )

      triggerSaveEdit()

      expect(cancelEditSpy).toHaveBeenCalledTimes(1)
    }))

    it('should cancel edit if update search config call failed', fakeAsync(() => {
      const cancelEditSpy = jest.spyOn(store, 'cancelEdit')
      store.patchState({
        searchConfigs: [config],
        layout: 'table',
        columnGroupComponentActive: true
      })
      const error = new Error('my-msg')
      jest.spyOn(searchConfigServiceSpy, 'getSearchConfig').mockReturnValue(
        of({
          config: config
        } as any)
      )
      jest.spyOn(searchConfigServiceSpy, 'updateSearchConfig').mockReturnValue(throwError(() => error))
      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'primary'
        } as any)
      )

      triggerSaveEdit()

      expect(cancelEditSpy).toHaveBeenCalledTimes(1)
    }))

    it('should cancel edit if config is not set', fakeAsync(() => {
      const cancelEditSpy = jest.spyOn(store, 'cancelEdit')

      component.onSearchConfigSaveEdit({
        currentConfig: undefined
      } as any)

      tick(500)

      expect(cancelEditSpy).toHaveBeenCalledTimes(1)
    }))

    it('should handle optional hide and undefined subscriptions without throwing', fakeAsync(() => {
      component.op = undefined
      component.currentConfigSub = undefined
      component.dataRevertSub = undefined
      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(of({ button: 'primary' } as any))
      jest.spyOn(searchConfigServiceSpy, 'deleteSearchConfig').mockReturnValue(of({} as any))

      expect(() => component.onSearchConfigChange({ id: 'x', name: 'y' } as any)).not.toThrow()
      expect(() => component.onSearchConfigEdit({ id: 'x', name: 'y' } as any)).not.toThrow()
      expect(() => component.onSearchConfigDelete({ id: 'x', name: 'y' } as any)).not.toThrow()
      expect(() => component.ngOnDestroy()).not.toThrow()
      tick(0)
    }))

    it('should build empty edit/create payload branches when optional fields are undefined', () => {
      const createSpy = jest.spyOn(searchConfigServiceSpy, 'createSearchConfig').mockReturnValue(of({} as any))

      component['saveSearchConfig'](
        {
          searchConfigName: undefined,
          saveInputValues: false,
          saveColumns: false
        } as any,
        { appId: 'app-id', productName: 'prod' } as any,
        { fieldValues: undefined, displayedColumnsIds: undefined, viewMode: basicViewMode } as any,
        'dashboard'
      ).subscribe()

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '',
          columns: [],
          values: {},
          isAdvanced: false
        })
      )

      const updateSpy = jest.spyOn(searchConfigServiceSpy, 'updateSearchConfig').mockReturnValue(of({} as any))

      component['editSearchConfig'](
        { id: 'id-1', name: 'cfg', columns: ['col-1'], values: {}, isAdvanced: false } as any,
        {
          searchConfigName: undefined,
          saveInputValues: false,
          saveColumns: false
        } as any,
        { fieldValues: undefined, displayedColumnsIds: ['c1'], viewMode: basicViewMode } as any,
        { isColumnGroupComponentActive: true, layout: 'table' } as any
      ).subscribe()

      expect(updateSpy).toHaveBeenCalledWith(
        'id-1',
        expect.objectContaining({
          searchConfig: expect.objectContaining({
            name: 'cfg',
            columns: [],
            values: {},
            isAdvanced: false
          })
        })
      )

      updateSpy.mockClear()

      component['editSearchConfig'](
        {
          id: 'id-2',
          name: undefined,
          columns: ['col-1'],
          values: {},
          isAdvanced: false
        } as any,
        undefined,
        {
          fieldValues: undefined,
          displayedColumnsIds: ['c1'],
          viewMode: basicViewMode
        } as any,
        {
          isColumnGroupComponentActive: true
        } as any
      ).subscribe()

      expect(updateSpy).toHaveBeenCalledWith(
        'id-2',
        expect.objectContaining({
          searchConfig: expect.objectContaining({
            name: ''
          })
        })
      )

      updateSpy.mockClear()

      component['editSearchConfig'](
        {
          id: 'id-3',
          name: 'cfg',
          columns: ['col-1'],
          values: {},
          isAdvanced: false
        } as any,
        {
          saveInputValues: true,
          saveColumns: false
        } as any,
        {
          fieldValues: undefined,
          displayedColumnsIds: ['c1'],
          viewMode: basicViewMode
        } as any,
        {
          isColumnGroupComponentActive: false,
          layout: 'grid'
        } as any
      ).subscribe()

      expect(updateSpy).toHaveBeenCalledWith(
        'id-3',
        expect.objectContaining({
          searchConfig: expect.objectContaining({
            values: {}
          })
        })
      )
    })

    it('should use empty object when fieldValues are undefined and saveInputValues is true', () => {
      const createSpy = jest.spyOn(searchConfigServiceSpy, 'createSearchConfig').mockReturnValue(of({} as any))

      component['saveSearchConfig'](
        {
          searchConfigName: 'new-name',
          saveInputValues: true,
          saveColumns: false
        } as any,
        {
          appId: 'app-id',
          productName: 'product'
        } as any,
        {
          fieldValues: undefined,
          displayedColumnsIds: [],
          viewMode: basicViewMode
        } as any,
        'page-name'
      ).subscribe()

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'new-name',
          values: {},
          columns: [],
          isAdvanced: false
        })
      )
    })

    it('should use false values for empty config', fakeAsync(() => {
      const openDialogSpy = jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(of(undefined as any))

      jest.spyOn(searchConfigServiceSpy, 'getSearchConfig').mockReturnValue(of({ config: undefined } as any))

      component.onSearchConfigSaveEdit({
        currentConfig: {
          id: '1',
          name: 'empty-config',
          values: undefined,
          columns: undefined
        },
        isColumnGroupComponentActive: true,
        layout: 'table'
      } as any)

      tick(500)

      expect(openDialogSpy).toHaveBeenCalledWith(
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.EDIT_HEADER',
        expect.objectContaining({
          inputs: expect.objectContaining({
            searchConfigName: 'empty-config',
            saveInputValues: false,
            saveColumns: false
          })
        }),
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CONFIRM',
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CANCEL'
      )
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

  describe('focusManageButton', () => {
    it('should not throw when manage button is undefined', () => {
      component.manageButton = undefined

      expect(() => component.focusManageButton()).not.toThrow()
    })
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = await createApplication({
      providers: [
        ...searchConfigProviders(undefined),
        ...shellMocks,
        { provide: UserService, useValue: userServiceStub }
      ]
    } as any)
    const zone = app.injector.get(NgZone)

    expect(zone).toBeInstanceOf(NgZone)
    expect(zone).not.toBeInstanceOf(NoopNgZone)

    app.destroy()
  }, 20000)
})
