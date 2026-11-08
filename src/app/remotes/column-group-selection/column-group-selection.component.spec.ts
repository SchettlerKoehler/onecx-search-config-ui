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
import { BehaviorSubject, ReplaySubject, Subject, firstValueFrom, of, throwError } from 'rxjs'
import { DialogService } from 'primeng/dynamicdialog'
import { Select } from 'primeng/select'
import { Tooltip } from 'primeng/tooltip'

import { FakeTopic } from '@onecx/accelerator'
import { REMOTE_COMPONENT_CONFIG, RemoteComponentConfig } from '@onecx/angular-utils'
import { PortalDialogService } from '@onecx/angular-accelerator'
import { AppStateService } from '@onecx/angular-integration-interface'
import { PortalMessageService } from '@onecx/angular-integration-interface'
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
import { getWindowState } from '@onecx/angular-webcomponents'

import {
  SEARCH_CONFIG_STORE_NAME,
  SEARCH_CONFIG_TOPIC,
  SearchConfigMessage,
  SearchConfigStore,
  SearchConfigTopic
} from 'src/app/shared/search-config.store'
import { advancedViewMode, basicViewMode, SEARCH_CONFIG_SAVE_AS_BUTTON_ID } from 'src/app/shared/constants'
import { CreateOrEditSearchConfigDialogComponent } from 'src/app/shared/components/create-or-edit-search-config-dialog/create-or-edit-search-config-dialog.component'
import { Configuration, SearchConfigAPIService } from 'src/app/shared/generated'
import { OneCXColumnGroupSelectionComponent } from './column-group-selection.component'
import { OneCXColumnGroupSelectionHarness } from './column-group-selection.harness'
import { columnGroupSelectionProviders } from './column-group-selection.component.providers'

const createSpyObj = (baseName: string, methodNames: Array<string>): { [key: string]: any } => {
  const obj: any = {}

  for (let i = 0; i < methodNames.length; i++) {
    obj[methodNames[i]] = jest.fn()
  }

  return obj
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

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

const readonlyConfig = {
  id: '4',
  name: 'config-readonly',
  columns: ['col-4'],
  values: {},
  isReadonly: true,
  isAdvanced: false
}

describe('OneCXColumnGroupSelectionComponent', () => {
  let component: OneCXColumnGroupSelectionComponent
  let fixture: ComponentFixture<OneCXColumnGroupSelectionComponent>
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
      imports: [OneCXColumnGroupSelectionComponent, NoopAnimationsModule],
      providers: [
        ...provideTranslateTestingService({
          en: require('../../../assets/i18n/en.json'),
          de: require('../../../assets/i18n/de.json')
        }),
        ...provideAppStateServiceMock(),
        DialogService,
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
    })

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

    fixture = TestBed.createComponent(OneCXColumnGroupSelectionComponent)
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

  it('should update store on selectedGroupKey input set', fakeAsync(() => {
    const spy = jest.spyOn(store, 'setSelectedGroupKey')

    component.selectedGroupKey = 'my-key'
    tick(500)

    expect(spy).toHaveBeenCalledWith('my-key')
  }))

  it('should not update store on when selectedGroupKey input is undefined', fakeAsync(() => {
    const spy = jest.spyOn(store, 'setSelectedGroupKey')

    component.selectedGroupKey = undefined
    tick(500)

    expect(spy).toHaveBeenCalledTimes(0)
  }))

  it('should update store on customGroupKey input set', fakeAsync(() => {
    const spy = jest.spyOn(store, 'setCustomGroupKey')

    component.customGroupKey = 'my-key'
    tick(500)

    expect(spy).toHaveBeenCalledWith('my-key')
  }))

  it('should update store on displayedColumnsIds input set', fakeAsync(() => {
    const spy = jest.spyOn(store, 'updateDisplayedColumnsIds')

    component.displayedColumnsIds = ['col-1']
    tick(500)

    expect(spy).toHaveBeenCalledWith(['col-1'])
  }))

  it('should update store on layout input set', fakeAsync(() => {
    const spy = jest.spyOn(store, 'updateLayout')

    component.layout = 'grid'
    tick(500)

    expect(spy).toHaveBeenCalledWith('grid')
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
  })

  describe('view model', () => {
    it('should display only configs with columns in the store view model', async () => {
      store.patchState({
        searchConfigs: [config, onlyValuesConfig, onlyColumnsConfig],
        nonSearchConfigGroupKeys: [],
        customGroupKey: 'custom',
        layout: 'table'
      })

      const vm = await firstValueFrom(store.columnSelectionVm$)

      expect(vm.searchConfigsOnlyColumns.map((item) => item.name)).toEqual([onlyColumnsConfig.name])
    })

    it('should normalize unique predefined group keys and trigger selected group updates', fakeAsync(() => {
      const setSelectedGroupKeySpy = jest.spyOn(store, 'setSelectedGroupKey')

      component.columns = [
        { id: 'col-1', predefinedGroupKeys: ['default', 'default', undefined as any] } as any,
        { id: 'col-2', predefinedGroupKeys: ['custom', 'default'] } as any
      ]

      component.ngOnInit()
      component.onColumnGroupChange('custom')
      tick(100)

      expect(setSelectedGroupKeySpy).toHaveBeenCalledWith('custom')
    }))
  })

  describe('on destroy', () => {
    it('should unsubscribe the selectedGroupKey subscription when the component is destroyed', () => {
      const selectedSub = { unsubscribe: jest.fn() }

      component.selectedGroupKeySub = selectedSub as any

      component.ngOnDestroy()

      expect(selectedSub.unsubscribe).toHaveBeenCalledTimes(1)
    })
  })

  describe('on selectedGroupKey change', () => {
    it('should emit if config with columns was set', fakeAsync(() => {
      const selectedGroupKey$ = new Subject<string>()
      const vm$ = new BehaviorSubject<any>({
        searchConfigsWithColumns: [onlyColumnsConfig],
        customGroupKey: 'custom',
        nonSearchConfigGroupKeys: [],
        selectedGroupKey: onlyColumnsConfig.name
      })
      const fakeStore = {
        pageName$: of('page-name'),
        selectedGroupKey$,
        columnSelectionVm$: vm$,
        searchConfigs: [],
        state: () => ({ searchConfigs: [] }),
        setSelectedGroupKey: jest.fn(),
        setCustomGroupKey: jest.fn(),
        updateDisplayedColumnsIds: jest.fn(),
        updateLayout: jest.fn(),
        setNonSearchConfigGroupKeys: jest.fn()
      } as any

      // Construct through the injection context so the field-level `viewChild(Select)` initializer
      // (valid in production because Angular creates the component in its DI context) works here too.
      const fakeComponent = runInInjectionContext(
        TestBed.inject(Injector),
        () =>
          new OneCXColumnGroupSelectionComponent(
            new ReplaySubject<RemoteComponentConfig>(1),
            { lang$: new BehaviorSubject('en') } as any,
            { use: jest.fn() } as any,
            { configuration: new Configuration({ basePath: '' }) } as any,
            { openDialog: jest.fn() } as any,
            { info: jest.fn(), success: jest.fn(), error: jest.fn() } as any,
            { currentMfe$: { asObservable: () => of({ appId: 'appId', productName: 'product' } as any) } } as any,
            fakeStore
          )
      )
      fakeComponent.columns = onlyColumnsConfig.columns.map((id) => ({ id })) as any
      const emitterSpy = jest.spyOn(fakeComponent.groupSelectionChanged, 'emit')

      selectedGroupKey$.next(onlyColumnsConfig.name)
      tick(60)

      expect(emitterSpy).toHaveBeenCalledWith({
        activeColumns: onlyColumnsConfig.columns.map((id) => ({ id })),
        groupKey: onlyColumnsConfig.name
      })
    }))

    it('should emit if no search config group key was set', fakeAsync(() => {
      const selectedGroupKey$ = new Subject<string>()
      const vm$ = new BehaviorSubject<any>({
        searchConfigsWithColumns: [],
        customGroupKey: 'custom',
        nonSearchConfigGroupKeys: ['def', 'full'],
        selectedGroupKey: 'full'
      })
      const fakeStore = {
        pageName$: of('page-name'),
        selectedGroupKey$,
        columnSelectionVm$: vm$,
        searchConfigs: [],
        state: () => ({ searchConfigs: [] }),
        setSelectedGroupKey: jest.fn(),
        setCustomGroupKey: jest.fn(),
        updateDisplayedColumnsIds: jest.fn(),
        updateLayout: jest.fn(),
        setNonSearchConfigGroupKeys: jest.fn()
      } as any

      // Construct through the injection context so the field-level `viewChild(Select)` initializer
      // (valid in production because Angular creates the component in its DI context) works here too.
      const fakeComponent = runInInjectionContext(
        TestBed.inject(Injector),
        () =>
          new OneCXColumnGroupSelectionComponent(
            new ReplaySubject<RemoteComponentConfig>(1),
            { lang$: new BehaviorSubject('en') } as any,
            { use: jest.fn() } as any,
            { configuration: new Configuration({ basePath: '' }) } as any,
            { openDialog: jest.fn() } as any,
            { info: jest.fn(), success: jest.fn(), error: jest.fn() } as any,
            { currentMfe$: { asObservable: () => of({ appId: 'appId', productName: 'product' } as any) } } as any,
            fakeStore
          )
      )
      fakeComponent.columns = [
        {
          id: 'my-col',
          predefinedGroupKeys: ['def', 'full']
        } as any,
        {
          id: 'second-col',
          predefinedGroupKeys: ['full']
        } as any
      ]
      const emitterSpy = jest.spyOn(fakeComponent.groupSelectionChanged, 'emit')

      selectedGroupKey$.next('full')
      tick(60)

      expect(emitterSpy).toHaveBeenCalledWith({
        activeColumns: [
          {
            id: 'my-col',
            predefinedGroupKeys: ['def', 'full']
          } as any,
          {
            id: 'second-col',
            predefinedGroupKeys: ['full']
          } as any
        ],
        groupKey: 'full'
      })
    }))

    it('should ignore selectedGroupKey when it matches custom group or is not a config/predefined group', fakeAsync(() => {
      const selectedGroupKey$ = new Subject<string>()
      const vm$ = new BehaviorSubject<any>({
        searchConfigsWithColumns: [],
        customGroupKey: 'custom',
        nonSearchConfigGroupKeys: ['default'],
        selectedGroupKey: 'custom'
      })
      const fakeStore = {
        pageName$: of('page-name'),
        selectedGroupKey$,
        columnSelectionVm$: vm$,
        searchConfigs: [],
        state: () => ({ searchConfigs: [] }),
        setSelectedGroupKey: jest.fn(),
        setCustomGroupKey: jest.fn(),
        updateDisplayedColumnsIds: jest.fn(),
        updateLayout: jest.fn(),
        setNonSearchConfigGroupKeys: jest.fn()
      } as any

      // Construct through the injection context so the field-level `viewChild(Select)` initializer
      // (valid in production because Angular creates the component in its DI context) works here too.
      const fakeComponent = runInInjectionContext(
        TestBed.inject(Injector),
        () =>
          new OneCXColumnGroupSelectionComponent(
            new ReplaySubject<RemoteComponentConfig>(1),
            { lang$: new BehaviorSubject('en') } as any,
            { use: jest.fn() } as any,
            { configuration: new Configuration({ basePath: '' }) } as any,
            { openDialog: jest.fn() } as any,
            { info: jest.fn(), success: jest.fn(), error: jest.fn() } as any,
            { currentMfe$: { asObservable: () => of({ appId: 'appId', productName: 'product' } as any) } } as any,
            fakeStore
          )
      )
      fakeComponent.columns = [{ id: 'col-1' } as any, { id: 'col-2' } as any]

      const emitterSpy = jest.spyOn(fakeComponent.groupSelectionChanged, 'emit')

      vm$.next({
        searchConfigsWithColumns: [],
        customGroupKey: 'custom',
        nonSearchConfigGroupKeys: ['default'],
        selectedGroupKey: 'custom'
      })
      selectedGroupKey$.next('custom')
      tick(60)
      expect(emitterSpy).not.toHaveBeenCalled()

      vm$.next({
        searchConfigsWithColumns: [],
        customGroupKey: 'custom',
        nonSearchConfigGroupKeys: ['default'],
        selectedGroupKey: 'default'
      })
      selectedGroupKey$.next('default')
      tick(60)
      expect(emitterSpy).toHaveBeenCalledWith({
        activeColumns: [],
        groupKey: 'default'
      })
    }))
  })

  describe('grouped options', () => {
    it('should group the host column groups under Predefined and the saved column configs under Saved', () => {
      const vmValue = {
        nonSearchConfigGroupKeys: ['default', 'full'],
        searchConfigsWithColumns: [config, onlyColumnsConfig],
        customGroupKey: 'custom'
      } as any

      const options = component.getOptions(vmValue)

      expect(options).toEqual([
        {
          label: 'Predefined',
          value: 'predefined',
          items: [
            { label: 'default', value: 'default', isPredefined: true },
            { label: 'full', value: 'full', isPredefined: true }
          ]
        },
        {
          label: 'Saved',
          value: 'saved',
          items: [
            { label: config.name, value: config.name, isReadonly: false },
            { label: onlyColumnsConfig.name, value: onlyColumnsConfig.name, isReadonly: false }
          ]
        }
      ])
    })

    it('should exclude value-only configs from the Saved group', () => {
      const vmValue = {
        nonSearchConfigGroupKeys: [],
        searchConfigsWithColumns: [onlyColumnsConfig],
        customGroupKey: 'custom'
      } as any

      const options = component.getOptions(vmValue)

      expect(options[1].items).toEqual([
        { label: onlyColumnsConfig.name, value: onlyColumnsConfig.name, isReadonly: false }
      ])
    })
  })

  describe('select label and placeholder', () => {
    it('should show the host placeholder key while nothing is selected', () => {
      component.placeholderKey = 'COLUMN_GROUP_SELECTION.SELECT.PLACEHOLDER'

      expect(component.selectLabel({ selectedGroupKey: undefined } as any)).toBe(
        'COLUMN_GROUP_SELECTION.SELECT.PLACEHOLDER'
      )
    })

    it('should fall back to the default placeholder key when no host placeholder is provided', () => {
      component.placeholderKey = ''

      expect(component.selectLabel({ selectedGroupKey: undefined } as any)).toBe(
        'COLUMN_GROUP_SELECTION.SELECT.PLACEHOLDER'
      )
    })

    it('should show the fixed column group label once a group is selected', () => {
      expect(component.selectLabel({ selectedGroupKey: 'config-1' } as any)).toBe('COLUMN_GROUP_SELECTION.LABEL')
    })
  })

  describe('delete actions', () => {
    it('should open the reusable delete dialog for the config when invoked', fakeAsync(() => {
      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(of(undefined as any))
      jest.spyOn(searchConfigServiceSpy, 'deleteSearchConfig').mockReturnValue(of({} as any))

      component.onColumnGroupDelete(config)
      tick(500)

      expect(portalDialogSpy.openDialog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ parameters: { config: config.name } }),
        expect.anything(),
        expect.anything(),
        expect.anything()
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

      component.onColumnGroupDelete(config)
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

      component.onColumnGroupDelete(config)
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

      component.onColumnGroupDelete(config)
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

      component.onColumnGroupDelete(config)
      tick(500)

      expect(deleteSpy).toHaveBeenCalledTimes(0)
      expect(consoleSpy).toHaveBeenCalledWith(error)
      expect(portalMessageSpy.error).toHaveBeenCalledWith({
        summaryKey: 'SEARCH_CONFIG.DELETE_FAILURE'
      })
    }))

    it('should render the delete affordance only for a non-readonly saved config with the DELETE permission', () => {
      component.permissions = ['SEARCHCONFIG#DELETE']
      expect(component.canDelete(config)).toBe(true)
      expect(component.canDelete(readonlyConfig)).toBe(false)
      expect(component.canDelete(undefined)).toBe(false)

      component.permissions = []
      expect(component.canDelete(config)).toBe(false)
    })

    it('should expose the keyboard delete hint only when a deletable config is present', () => {
      const vmValue = {
        searchConfigsWithColumns: [config, readonlyConfig],
        customGroupKey: 'custom'
      } as any

      component.permissions = ['SEARCHCONFIG#DELETE']
      expect(component.hasDeletableConfig(vmValue)).toBe(true)

      component.permissions = []
      expect(component.hasDeletableConfig(vmValue)).toBe(false)

      expect(
        component.hasDeletableConfig({ searchConfigsWithColumns: [readonlyConfig], customGroupKey: 'custom' } as any)
      ).toBe(false)
    })
  })

  describe('Save As', () => {
    it('should open the create dialog with columns saved and the column option unfrozen', fakeAsync(() => {
      const appState = TestBed.inject(AppStateService)
      jest.spyOn(appState.currentMfe$, 'asObservable').mockReturnValue(
        of({
          appId: 'appId',
          productName: 'product'
        } as any)
      )
      store.patchState({
        searchConfigs: [config],
        pageName: 'my-page',
        fieldValues: {},
        displayedColumnsIds: [],
        viewMode: basicViewMode
      })
      const dialogServiceSpy = jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'primary'
        } as any)
      )

      component.onColumnGroupSaveAs({ searchConfigsWithColumns: [config], customGroupKey: 'custom' } as any)
      tick(500)

      expect(dialogServiceSpy).toHaveBeenCalledWith(
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CREATE_HEADER',
        {
          type: CreateOrEditSearchConfigDialogComponent,
          inputs: {
            searchConfigName: '',
            saveInputValues: false,
            saveColumns: true,
            frozeColumnSaveOption: false
          }
        },
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CONFIRM',
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CANCEL'
      )
    }))

    it('should save the displayed columns and no input values when a new config is created', fakeAsync(() => {
      const appState = TestBed.inject(AppStateService)
      jest.spyOn(appState.currentMfe$, 'asObservable').mockReturnValue(
        of({
          appId: 'my-app',
          productName: 'my-product'
        } as any)
      )
      const createCallSpy = jest.spyOn(searchConfigServiceSpy, 'createSearchConfig').mockReturnValue(of({} as any))
      store.patchState({
        searchConfigs: [config],
        pageName: 'my-page',
        fieldValues: { k: 'v' },
        displayedColumnsIds: ['my-col', 'my-col2'],
        viewMode: advancedViewMode
      })
      // The dialog's result carries the `saveColumns`/`saveInputValues` flags (seeded from the dialog
      // inputs and echoed back on confirm); the Save As interim path seeds `saveColumns: true`.
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

      component.onColumnGroupSaveAs({ searchConfigsWithColumns: [config], customGroupKey: 'custom' } as any)
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

    it('should add and select the new config when the create call returns an id', fakeAsync(() => {
      const appState = TestBed.inject(AppStateService)
      jest.spyOn(appState.currentMfe$, 'asObservable').mockReturnValue(
        of({
          appId: 'appId',
          productName: 'product'
        } as any)
      )
      const addSpy = jest.spyOn(store, 'addSearchConfig')
      const setGroupSpy = jest.spyOn(store, 'setSelectedGroupKey')
      store.patchState({
        searchConfigs: [],
        pageName: 'my-page',
        fieldValues: {},
        displayedColumnsIds: ['my-col'],
        viewMode: basicViewMode
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

      component.onColumnGroupSaveAs({ searchConfigsWithColumns: [], customGroupKey: 'custom' } as any)
      tick(500)

      expect(portalMessageSpy.info).toHaveBeenCalledWith({
        summaryKey: 'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CREATE_SUCCESS'
      })
      expect(addSpy).toHaveBeenCalledWith(config)
      expect(setGroupSpy).toHaveBeenCalledWith(config.name)
    }))

    it('should not add a config when the dialog was not confirmed', fakeAsync(() => {
      const appState = TestBed.inject(AppStateService)
      jest.spyOn(appState.currentMfe$, 'asObservable').mockReturnValue(
        of({
          appId: 'appId',
          productName: 'product'
        } as any)
      )
      const addSpy = jest.spyOn(store, 'addSearchConfig')
      const setGroupSpy = jest.spyOn(store, 'setSelectedGroupKey')
      store.patchState({
        searchConfigs: [],
        pageName: 'my-page',
        fieldValues: {},
        displayedColumnsIds: [],
        viewMode: basicViewMode
      })
      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          result: {
            searchConfigName: config.name
          },
          button: 'secondary'
        } as any)
      )

      component.onColumnGroupSaveAs({ searchConfigsWithColumns: [], customGroupKey: 'custom' } as any)
      tick(500)

      expect(addSpy).toHaveBeenCalledTimes(0)
      expect(setGroupSpy).toHaveBeenCalledTimes(0)
    }))

    it('should not add a config when the dialog state is missing a result', fakeAsync(() => {
      const appState = TestBed.inject(AppStateService)
      jest.spyOn(appState.currentMfe$, 'asObservable').mockReturnValue(
        of({
          appId: 'appId',
          productName: 'product'
        } as any)
      )
      const addSpy = jest.spyOn(store, 'addSearchConfig')
      const setGroupSpy = jest.spyOn(store, 'setSelectedGroupKey')
      store.patchState({
        searchConfigs: [],
        pageName: 'my-page',
        fieldValues: {},
        displayedColumnsIds: [],
        viewMode: basicViewMode
      })
      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(of({ result: undefined, button: 'primary' } as any))

      component.onColumnGroupSaveAs({ searchConfigsWithColumns: [], customGroupKey: 'custom' } as any)
      tick(500)

      expect(addSpy).toHaveBeenCalledTimes(0)
      expect(setGroupSpy).toHaveBeenCalledTimes(0)
    }))

    it('should not add a config when the create call failed', fakeAsync(() => {
      const error = new Error('my-error')
      const appState = TestBed.inject(AppStateService)
      const addSpy = jest.spyOn(store, 'addSearchConfig')
      const setGroupSpy = jest.spyOn(store, 'setSelectedGroupKey')
      const consoleSpy = jest.spyOn(console, 'error')
      jest.spyOn(appState.currentMfe$, 'asObservable').mockReturnValue(
        of({
          appId: 'appId',
          productName: 'product'
        } as any)
      )
      store.patchState({
        searchConfigs: [],
        pageName: 'my-page',
        fieldValues: {},
        displayedColumnsIds: [],
        viewMode: basicViewMode
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

      component.onColumnGroupSaveAs({ searchConfigsWithColumns: [], customGroupKey: 'custom' } as any)
      tick(500)

      expect(portalMessageSpy.error).toHaveBeenCalledWith({
        summaryKey: 'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CREATE_FAILURE'
      })
      expect(consoleSpy).toHaveBeenCalledWith(error)
      expect(addSpy).toHaveBeenCalledTimes(0)
      expect(setGroupSpy).toHaveBeenCalledTimes(0)
    }))
  })

  describe('load search configs', () => {
    it('should fetch the saved configs once the base url, page name and mfe are available and store them', fakeAsync(() => {
      const configs = [
        {
          name: 'config-1',
          values: {},
          columns: ['col-1']
        },
        {
          name: 'config-2',
          values: {},
          columns: ['col-2']
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
          new OneCXColumnGroupSelectionComponent(
            localBaseUrl,
            { lang$: new BehaviorSubject('en') } as any,
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
      expect(localStore.state().searchConfigs).toEqual(configs)
      expect(localComponent).toBeTruthy()
    }))
  })
})

@Component({
  standalone: true,
  imports: [OneCXColumnGroupSelectionComponent],
  template: '<app-ocx-column-group-selection></app-ocx-column-group-selection>'
})
class HostComponent {}

describe('OneCXColumnGroupSelectionHarness (remote host element)', () => {
  let hostFixture: ComponentFixture<HostComponent>
  let childStore: SearchConfigStore
  let childComponent: OneCXColumnGroupSelectionComponent

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

  // The host binds `[columns]` and the remote derives its predefined group keys from them
  // (`ngOnInit` → `setNonSearchConfigGroupKeys`), so the predefined keys are driven through the
  // component's real pipeline (one column carrying the keys) rather than patched into the store
  // directly — a direct patch would be clobbered by that pipeline once the (empty) `columns` resolve.
  const patchConfigs = async (configs: any[], predefinedGroupKeys: string[] = []) => {
    childComponent.columns = predefinedGroupKeys.length > 0 ? [{ id: 'col', predefinedGroupKeys } as any] : ([] as any)
    childStore.patchState({
      searchConfigs: configs
    })
    hostFixture.detectChanges()
    await delay(80)
    hostFixture.detectChanges()
    await hostFixture.whenStable()
  }

  const openItems = async () => (await harness()).getSelectItems()

  // The combobox is the element PrimeNG keeps focused while the panel is open (`focusInputViewChild`,
  // `role="combobox"`); the keyboard handler only reacts to a Delete pressed directly on it.
  const comboboxOf = (select: Select): HTMLElement => {
    const combobox = select.focusInputViewChild?.nativeElement
    expect(combobox).toBeTruthy()
    return combobox as HTMLElement
  }

  const harness = async () =>
    (await TestbedHarnessEnvironment.documentRootLoader(hostFixture).getHarness(
      OneCXColumnGroupSelectionHarness
    )) as OneCXColumnGroupSelectionHarness

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
    TestBed.overrideComponent(OneCXColumnGroupSelectionComponent, {
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
    const child = hostFixture.debugElement.query(By.directive(OneCXColumnGroupSelectionComponent))!
    childComponent = child.componentInstance
    // `SEARCHCONFIG#CREATE` so the Save As button (rendered through a `SEARCHCONFIG#CREATE`-gated
    // `<p-inputgroup-addon>`) is present; the group itself requires `SEARCHCONFIG#VIEW`.
    childComponent.permissions = ['SEARCHCONFIG#VIEW', 'SEARCHCONFIG#CREATE', 'SEARCHCONFIG#DELETE']
    hostFixture.detectChanges()

    childStore = TestBed.inject(SearchConfigStore)
  })

  it('should render the Column group label and the Save As button when configs are available', async () => {
    await patchConfigs([config])

    const label = hostFixture.nativeElement.querySelector('.sc-search-config-label')
    expect(label).toBeTruthy()
    expect(label.textContent.trim()).toBe('Column group')

    const saveAs = await (await harness()).getSaveAsButton()
    expect(saveAs).not.toBeNull()
    expect(await (saveAs as NonNullable<typeof saveAs>).getLabel()).toBe('Save As')
    const iconSpan = hostFixture.nativeElement.querySelector(
      `#${SEARCH_CONFIG_SAVE_AS_BUTTON_ID} .p-button-icon`
    ) as HTMLElement
    expect(iconSpan).toBeTruthy()
    expect(iconSpan.classList.contains('pi-save')).toBe(true)
  })

  it('should group the host column groups and the saved column configs in the opened panel', async () => {
    await patchConfigs([config, onlyColumnsConfig], ['default', 'full'])

    const h = await harness()
    const items = await openItems()
    await hostFixture.whenStable()

    // Both group headers render as the grouped panel's `#group` template rows (`.sc-search-config-group-header`),
    // not as option leaves, so they carry no `aria-label` and are asserted by their rendered text.
    const groupHeaders = hostFixture.nativeElement.querySelectorAll(
      '.sc-search-config-group-header'
    ) as NodeListOf<HTMLElement>
    expect(Array.from(groupHeaders).map((header) => header.textContent?.trim())).toEqual(['Predefined', 'Saved'])
    // The predefined host column groups and the two saved column configs all render as option rows.
    expect(await h.findSelectItem('default')).not.toBeNull()
    expect(await h.findSelectItem('full')).not.toBeNull()
    expect(await h.findSelectItem(config.name)).not.toBeNull()
    expect(await h.findSelectItem(onlyColumnsConfig.name)).not.toBeNull()
    expect(items.length).toBeGreaterThanOrEqual(4)
  })

  it('should list only the column-storing config names in the Saved group when a value-only config is present', async () => {
    await patchConfigs([config, onlyValuesConfig, onlyColumnsConfig])

    const h = await harness()
    expect(await h.findSelectItem(config.name)).not.toBeNull()
    expect(await h.findSelectItem(onlyColumnsConfig.name)).not.toBeNull()
    // `onlyValuesConfig` stores values only (no columns), so it is filtered out of `searchConfigsWithColumns`.
    expect(await h.findSelectItem(onlyValuesConfig.name)).toBeNull()
  })

  it('should render the select and its opened panel inside the remote element with the style hooks', async () => {
    await patchConfigs([config])

    const items = await openItems()
    await hostFixture.whenStable()
    expect(items.length).toBeGreaterThan(0)

    const select = hostFixture.nativeElement.querySelector('p-select') as HTMLElement
    expect(select.classList.contains('sc-search-config-select')).toBe(true)

    const panel = hostFixture.nativeElement.querySelector('.sc-search-config-panel') as HTMLElement
    expect(panel).toBeTruthy()
  })

  it('should apply the saved config when its row is clicked', async () => {
    await patchConfigs([config])

    const changeSpy = jest.spyOn(childComponent, 'onColumnGroupChange')
    const item = await (await harness()).findSelectItem(config.name)
    expect(item).not.toBeNull()
    await (item as NonNullable<typeof item>).selectItem()
    await hostFixture.whenStable()

    // `optionValue="value"` means the select emits the leaf's `value` (the config name), not the row object.
    expect(changeSpy).toHaveBeenCalledWith(config.name)
  })

  it('should open the delete dialog when the trash button is clicked, without selecting the row', async () => {
    ;(portalDialogHostMock.openDialog as jest.Mock).mockReturnValue(of(undefined as any))

    await patchConfigs([config])
    const changeSpy = jest.spyOn(childComponent, 'onColumnGroupChange')
    const trashButton = await (await harness()).getDeleteButton(config.name)
    expect(trashButton).toBeTruthy()

    await (trashButton as NonNullable<typeof trashButton>).click()
    await hostFixture.whenStable()

    expect(portalDialogHostMock.openDialog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ parameters: { config: config.name } }),
      expect.anything(),
      expect.anything(),
      expect.anything()
    )
    // The trash click stops propagation, so the row is not selected.
    expect(changeSpy).not.toHaveBeenCalled()
  })

  it('should render no trash button when the SEARCHCONFIG#DELETE permission is missing', async () => {
    childComponent.permissions = ['SEARCHCONFIG#VIEW']
    await patchConfigs([config])

    const h = await harness()
    expect(await h.getRowByName(config.name)).toBeTruthy()
    expect(await h.getDeleteButton(config.name)).toBeNull()
  })

  it('should render no trash button for a read-only config', async () => {
    await patchConfigs([config, readonlyConfig])

    const h = await harness()
    expect(await h.getDeleteButton(config.name)).toBeTruthy()
    expect(await h.getDeleteButton(readonlyConfig.name)).toBeNull()
  })

  it('should keep the Save As button enabled and open the save dialog when clicked', async () => {
    await patchConfigs([config])

    const saveAs = await (await harness()).getSaveAsButton()
    const saveAsButton = hostFixture.nativeElement.querySelector(
      `#${SEARCH_CONFIG_SAVE_AS_BUTTON_ID} button`
    ) as HTMLButtonElement
    expect(saveAsButton.disabled).toBe(false)

    const saveSpy = jest.spyOn(childComponent, 'onColumnGroupSaveAs').mockImplementation(() => {})
    await (saveAs as NonNullable<typeof saveAs>).click()

    expect(saveSpy).toHaveBeenCalled()
  })

  it('should expose the keyboard delete hint to the combobox when a deletable config is present', async () => {
    await patchConfigs([config])

    const hint = hostFixture.nativeElement.querySelector('#sc_column_group_delete_hint') as HTMLElement
    expect(hint).toBeTruthy()
    expect(hint.classList.contains('p-hidden-accessible')).toBe(true)
    expect(hint.textContent.trim()).toBe('Press Delete to remove')

    const combobox = hostFixture.nativeElement.querySelector('p-select span[role="combobox"]') as HTMLElement
    expect(combobox).toBeTruthy()
    expect(combobox.getAttribute('aria-describedby')).toBe('sc_column_group_delete_hint')
  })

  it('should not render the keyboard delete hint when no option is deletable', async () => {
    await patchConfigs([readonlyConfig])

    expect(hostFixture.nativeElement.querySelector('#sc_column_group_delete_hint')).toBeNull()
    const combobox = hostFixture.nativeElement.querySelector('p-select span[role="combobox"]') as HTMLElement
    expect(combobox.getAttribute('aria-describedby')).toBeNull()
  })

  it('should show the full config name with a tooltip that appears on ellipsis', async () => {
    await patchConfigs([config])

    const h = await harness()
    expect(await h.getRowByName(config.name)).toBeTruthy()

    // A single config is patched (no predefined groups), so there is exactly one option row; its name
    // span renders the full config name and carries the `pTooltip` directive wired to the same name
    // with `showOnEllipsis` (the tooltip container only mounts once shown, and not in jsdom, so assert
    // on the rendered text and the directive instance's options).
    const row = hostFixture.debugElement.query(By.css('.sc-search-config-row'))
    const nameSpan = row.children[0].nativeElement as HTMLElement
    expect(nameSpan.textContent.trim()).toBe(config.name)

    const tooltip = row.children[0].injector.get(Tooltip)
    expect(tooltip).toBeTruthy()
    expect(tooltip.getOption('showOnEllipsis')).toBe(true)
    expect(tooltip.getOption('tooltipLabel')).toBe(config.name)
  })

  it('should delete the focused saved-config option when Delete is pressed on the open select combobox', async () => {
    ;(portalDialogHostMock.openDialog as jest.Mock).mockReturnValue(of(undefined as any))

    await patchConfigs([config])

    const deleteSpy = jest.spyOn(childComponent, 'onColumnGroupDelete').mockImplementation(() => {})
    const select = (childComponent as any).select() as Select
    const combobox = comboboxOf(select)

    const configSelect = await (await harness()).getConfigSelect()
    await configSelect?.open()
    await hostFixture.whenStable()
    expect(select.overlayVisible).toBe(true)
    expect(select.focusedOptionIndex()).toBe(-1)

    // With no option focused yet (`focusedOptionIndex()` is `-1`), a Delete on the combobox must not
    // delete — this is the `focusedIndex < 0` guard in `onColumnGroupSelectKeydown`.
    combobox.dispatchEvent(new KeyboardEvent('keydown', { code: 'Delete', bubbles: true, cancelable: true }))
    await hostFixture.whenStable()
    expect(deleteSpy).not.toHaveBeenCalled()

    // Focus the saved-config leaf and delete it. `visibleOptions()` flattens the groups, so the leaf
    // carries its own `value` (the config name); the handler resolves the config from that.
    const visibleOptions = select.visibleOptions()
    const configIndex = (visibleOptions as any[]).findIndex((option) => option?.value === config.name)
    expect(configIndex).toBeGreaterThanOrEqual(0)
    select.focusedOptionIndex.set(configIndex)

    const deleteEvent = new KeyboardEvent('keydown', { code: 'Delete', bubbles: true, cancelable: true })
    combobox.dispatchEvent(deleteEvent)
    await hostFixture.whenStable()
    expect(deleteSpy).toHaveBeenCalledWith(config)
    // The handler calls `preventDefault()` so the browser's default Delete is not also consumed.
    expect(deleteEvent.defaultPrevented).toBe(true)
  })

  it('should not delete via the keyboard path when a grouped header is focused', async () => {
    ;(portalDialogHostMock.openDialog as jest.Mock).mockReturnValue(of(undefined as any))
    await patchConfigs([config], ['default'])

    const deleteSpy = jest.spyOn(childComponent, 'onColumnGroupDelete').mockImplementation(() => {})
    const select = (childComponent as any).select() as Select
    const combobox = comboboxOf(select)

    await (await (await harness()).getConfigSelect())?.open()
    await hostFixture.whenStable()

    // A predefined (host column group) leaf resolves to no config — `visibleOptions()` group headers carry
    // no `value`, but a real predefined leaf does — so a Delete on it is a no-op (no matching config to delete).
    const visibleOptions = select.visibleOptions() as any[]
    const predefinedLeafIndex = visibleOptions.findIndex((option) => option?.value === 'default')
    expect(predefinedLeafIndex).toBeGreaterThanOrEqual(0)
    select.focusedOptionIndex.set(predefinedLeafIndex)
    combobox.dispatchEvent(new KeyboardEvent('keydown', { code: 'Delete', bubbles: true, cancelable: true }))
    await hostFixture.whenStable()
    expect(deleteSpy).not.toHaveBeenCalled()
  })

  it('should reject getRowByName when no row matches the given name', async () => {
    // `onlyValuesConfig` is value-only and filtered out of the Saved group, so the panel renders no row
    // for it and `getRowByName` rejects.
    await patchConfigs([config, onlyValuesConfig])

    const h = await harness()
    await expect(h.getRowByName(onlyValuesConfig.name)).rejects.toThrow(
      `No column-group row found for name "${onlyValuesConfig.name}"`
    )
  })

  it('should hide the Save As button but still render the select without the SEARCHCONFIG#CREATE permission', async () => {
    childComponent.permissions = ['SEARCHCONFIG#VIEW']
    await patchConfigs([config])

    const h = await harness()
    expect(await h.getSaveAsButton()).toBeNull()
    expect(hostFixture.nativeElement.querySelector('.sc-search-config-save-as')).toBeNull()

    expect(await h.getConfigSelect()).not.toBeNull()
    expect(hostFixture.nativeElement.querySelector('.sc-search-config-select')).not.toBeNull()
  })

  it('should render nothing when the SEARCHCONFIG#VIEW permission is missing', async () => {
    childComponent.permissions = []
    await patchConfigs([config])

    expect(hostFixture.nativeElement.querySelector('p-inputgroup')).toBeNull()

    const h = await harness()
    expect(await h.getConfigSelect()).toBeNull()
    expect(await h.getSelectItems()).toEqual([])
  })
})

describe('column-group-selection zone-based change detection', () => {
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
      ...columnGroupSelectionProviders(undefined),
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
      ...columnGroupSelectionProviders(undefined),
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
