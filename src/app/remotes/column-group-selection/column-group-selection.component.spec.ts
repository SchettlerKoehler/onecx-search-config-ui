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
import { HttpEvent, provideHttpClient } from '@angular/common/http'
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed'
import { BehaviorSubject, ReplaySubject, Subject, firstValueFrom, of, take, throwError } from 'rxjs'
import { DialogService } from 'primeng/dynamicdialog'
import { Select } from 'primeng/select'
import { Tooltip } from 'primeng/tooltip'
import { TranslateService } from '@ngx-translate/core'

import { FakeTopic, getLocation } from '@onecx/accelerator'
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
import { advancedViewMode, basicViewMode, COLUMN_GROUP_SAVE_AS_BUTTON_ID } from 'src/app/shared/constants'
import { CreateOrEditSearchConfigDialogComponent } from 'src/app/shared/components/create-or-edit-search-config-dialog/create-or-edit-search-config-dialog.component'
import {
  Configuration,
  GetSearchConfigInfosResponse,
  SearchConfigAPIService,
  SearchConfigInfo
} from 'src/app/shared/generated'
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

  it('should create the component when it is instantiated', () => {
    expect(component).toBeTruthy()
  })

  it('should set the store selected group key when the selectedGroupKey input is set', fakeAsync(() => {
    const spy = jest.spyOn(store, 'setSelectedGroupKey')

    component.selectedGroupKey = 'my-key'
    tick(500)

    expect(spy).toHaveBeenCalledWith('my-key')
  }))

  it('should not set the store selected group key when the selectedGroupKey input is undefined', fakeAsync(() => {
    const spy = jest.spyOn(store, 'setSelectedGroupKey')

    component.selectedGroupKey = undefined
    tick(500)

    expect(spy).toHaveBeenCalledTimes(0)
  }))

  it('should set the store custom group key when the customGroupKey input is set', fakeAsync(() => {
    const spy = jest.spyOn(store, 'setCustomGroupKey')

    component.customGroupKey = 'my-key'
    tick(500)

    expect(spy).toHaveBeenCalledWith('my-key')
  }))

  it('should update the store displayed columns when the displayedColumnsIds input is set', fakeAsync(() => {
    const spy = jest.spyOn(store, 'updateDisplayedColumnsIds')

    component.displayedColumnsIds = ['col-1']
    tick(500)

    expect(spy).toHaveBeenCalledWith(['col-1'])
  }))

  it('should update the store layout when the layout input is set', fakeAsync(() => {
    const spy = jest.spyOn(store, 'updateLayout')

    component.layout = 'grid'
    tick(500)

    expect(spy).toHaveBeenCalledWith('grid')
  }))

  describe('setup', () => {
    it('should init the remote component when the remote component config is set', (done) => {
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
    it('should display only configs with columns in the store view model when the store holds configs with and without columns', async () => {
      store.patchState({
        searchConfigs: [config, onlyValuesConfig, onlyColumnsConfig],
        nonSearchConfigGroupKeys: [],
        customGroupKey: 'custom',
        layout: 'table'
      })

      const vm = await firstValueFrom(store.columnSelectionVm$)

      // Both `config` (columns + values) and `onlyColumnsConfig` store columns, so both are listed;
      // `onlyValuesConfig` stores values only and is excluded.
      expect(vm.searchConfigsWithColumns.map((item) => item.name)).toEqual([config.name, onlyColumnsConfig.name])
    })

    it('should normalize unique predefined group keys and trigger selected group updates when the columns carry predefined group keys', fakeAsync(() => {
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

    it('should ignore a column with no predefinedGroupKeys when deriving the predefined group keys', fakeAsync(() => {
      const setNonSearchConfigGroupKeysSpy = jest.spyOn(store, 'setNonSearchConfigGroupKeys')

      // The first column declares no `predefinedGroupKeys` (undefined) — the `|| []` fallback (L194) —
      // while the second declares keys; the surviving keys plus the default group are what remain.
      component.columns = [{ id: 'col-a' } as any, { id: 'col-b', predefinedGroupKeys: ['custom', 'default'] } as any]

      component.ngOnInit()
      tick(100)

      // The undefined keys contribute nothing (`|| []`), so only the surviving keys remain (the empty
      // `defaultGroupKey` is filtered out by `!!value`).
      expect(setNonSearchConfigGroupKeysSpy).toHaveBeenCalledWith(['custom', 'default'])
    }))

    // The store emits the raw i18n group keys; the component's `vm$` translates them (and the
    // predefined leaf labels) reactively against the translate service, so a language change is
    // reflected without any store round-trip.
    it('should translate the group headers and predefined leaves in the component view model when the store emits group keys', fakeAsync(() => {
      const translateService = TestBed.inject(TranslateService)
      store.patchState({
        nonSearchConfigGroupKeys: ['full'],
        searchConfigs: [config],
        customGroupKey: 'custom'
      } as any)

      let vm: any
      const subscription = component.vm$.subscribe((value) => (vm = value))
      tick(60)
      subscription.unsubscribe()

      expect(vm.options[0].label).toBe('Predefined')
      expect(vm.options[1].label).toBe('Saved')
      expect(vm.options[0].items).toEqual([
        { label: translateService.instant('full'), value: 'full', isPredefined: true }
      ])
      expect(vm.options[1].items).toEqual([{ label: config.name, value: config.name, config }])
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
    it('should emit the group selection when the selected key matches a config with columns', fakeAsync(() => {
      const selectedGroupKey$ = new Subject<string>()
      const vm$ = new BehaviorSubject<any>({
        searchConfigsWithColumns: [onlyColumnsConfig],
        customGroupKey: 'custom',
        nonSearchConfigGroupKeys: [],
        selectedGroupKey: onlyColumnsConfig.name
      })
      const fakeStore = {
        // `loadSearchConfigs()` (constructor) resolves the page name live via `select(...)` and gates
        // the load on `isSearchConfigComponentActive$`; the load is a no-op here (baseUrl never emits),
        // so only those two members plus the group-key setter are exercised.
        isSearchConfigComponentActive$: of(false),
        selectedGroupKey$,
        columnSelectionVm$: vm$,
        select: (projector: any) => of(projector({ pageName: 'page-name' })),
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
            { use: jest.fn(), stream: () => of({}) } as any,
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

    it('should emit the group selection when the selected key matches a predefined group', fakeAsync(() => {
      const selectedGroupKey$ = new Subject<string>()
      const vm$ = new BehaviorSubject<any>({
        searchConfigsWithColumns: [],
        customGroupKey: 'custom',
        nonSearchConfigGroupKeys: ['def', 'full'],
        selectedGroupKey: 'full'
      })
      const fakeStore = {
        // `loadSearchConfigs()` (constructor) resolves the page name live via `select(...)` and gates
        // the load on `isSearchConfigComponentActive$`; the load is a no-op here (baseUrl never emits),
        // so only those two members plus the group-key setter are exercised.
        isSearchConfigComponentActive$: of(false),
        selectedGroupKey$,
        columnSelectionVm$: vm$,
        select: (projector: any) => of(projector({ pageName: 'page-name' })),
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
            { use: jest.fn(), stream: () => of({}) } as any,
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
        // `loadSearchConfigs()` (constructor) resolves the page name live via `select(...)` and gates
        // the load on `isSearchConfigComponentActive$`; the load is a no-op here (baseUrl never emits),
        // so only those two members plus the group-key setter are exercised.
        isSearchConfigComponentActive$: of(false),
        selectedGroupKey$,
        columnSelectionVm$: vm$,
        select: (projector: any) => of(projector({ pageName: 'page-name' })),
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
            { use: jest.fn(), stream: () => of({}) } as any,
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

    it('should not emit when selectedGroupKey is neither a stored config, the custom group nor a predefined group', fakeAsync(() => {
      const selectedGroupKey$ = new Subject<string>()
      const vm$ = new BehaviorSubject<any>({
        searchConfigsWithColumns: [],
        customGroupKey: 'custom',
        nonSearchConfigGroupKeys: ['default', 'full'],
        selectedGroupKey: 'other'
      })
      const fakeStore = {
        // `loadSearchConfigs()` (constructor) resolves the page name live via `select(...)` and gates
        // the load on `isSearchConfigComponentActive$`; the load is a no-op here (baseUrl never emits),
        // so only those two members plus the group-key setter are exercised.
        isSearchConfigComponentActive$: of(false),
        selectedGroupKey$,
        columnSelectionVm$: vm$,
        select: (projector: any) => of(projector({ pageName: 'page-name' })),
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
            { use: jest.fn(), stream: () => of({}) } as any,
            { configuration: new Configuration({ basePath: '' }) } as any,
            { openDialog: jest.fn() } as any,
            { info: jest.fn(), success: jest.fn(), error: jest.fn() } as any,
            { currentMfe$: { asObservable: () => of({ appId: 'appId', productName: 'product' } as any) } } as any,
            fakeStore
          )
      )
      fakeComponent.columns = [{ id: 'col-1' } as any, { id: 'col-2' } as any]
      const emitterSpy = jest.spyOn(fakeComponent.groupSelectionChanged, 'emit')

      // `'other'` is not a config-with-columns, is not the custom group and is not in
      // `nonSearchConfigGroupKeys`, so the `else if` (L175) is skipped and nothing is emitted.
      selectedGroupKey$.next('other')
      tick(60)

      expect(emitterSpy).not.toHaveBeenCalled()
    }))
  })

  describe('grouped options', () => {
    it('should group the host column groups under the Predefined group key and the saved column configs under the Saved group key when both groups have items', (done) => {
      store.patchState({
        nonSearchConfigGroupKeys: ['default', 'full'],
        searchConfigs: [config, onlyColumnsConfig],
        customGroupKey: 'custom'
      } as any)

      // The store emits the raw i18n group keys (translated reactively in the component's `vm$`) and the
      // config's own `name` for each saved leaf; no `isReadonly` is carried on the option.
      store.columnSelectionVm$.pipe(take(1)).subscribe((vm) => {
        expect(vm.options).toEqual([
          {
            label: 'COLUMN_GROUP_SELECTION.GROUPS.PREDEFINED',
            value: 'predefined',
            items: [
              { label: 'default', value: 'default', isPredefined: true },
              { label: 'full', value: 'full', isPredefined: true }
            ]
          },
          {
            label: 'COLUMN_GROUP_SELECTION.GROUPS.SAVED',
            value: 'saved',
            items: [
              { label: config.name, value: config.name, config },
              {
                label: onlyColumnsConfig.name,
                value: onlyColumnsConfig.name,
                config: onlyColumnsConfig
              }
            ]
          }
        ])
        done()
      })
    })

    it('should exclude value-only configs from the Saved group when the store holds a value-only config', (done) => {
      store.patchState({
        nonSearchConfigGroupKeys: [],
        searchConfigs: [onlyColumnsConfig, onlyValuesConfig],
        customGroupKey: 'custom'
      } as any)

      store.columnSelectionVm$.pipe(take(1)).subscribe((vm) => {
        expect(vm.options[1].items).toEqual([
          {
            label: onlyColumnsConfig.name,
            value: onlyColumnsConfig.name,
            config: onlyColumnsConfig
          }
        ])
        done()
      })
    })
  })

  describe('hasOptions', () => {
    it('should report options when a host predefined column group exists and no saved config does', () => {
      const vmValue = {
        nonSearchConfigGroupKeys: ['default'],
        searchConfigsWithColumns: [],
        customGroupKey: 'custom'
      } as any

      expect(component.hasOptions(vmValue)).toBe(true)
    })

    it('should report options when a saved column config exists and no predefined column group does', () => {
      const vmValue = {
        nonSearchConfigGroupKeys: [],
        searchConfigsWithColumns: [onlyColumnsConfig],
        customGroupKey: 'custom'
      } as any

      expect(component.hasOptions(vmValue)).toBe(true)
    })

    it('should report no options when there are no predefined column groups and no saved column configs', () => {
      const vmValue = {
        nonSearchConfigGroupKeys: [],
        searchConfigsWithColumns: [],
        customGroupKey: 'custom'
      } as any

      expect(component.hasOptions(vmValue)).toBe(false)
    })
  })

  describe('select label and placeholder', () => {
    it('should show the host placeholder key when nothing is selected', () => {
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

    it('should show the fixed column group label when a group is selected', () => {
      expect(component.selectLabel({ selectedGroupKey: 'config-1' } as any)).toBe('COLUMN_GROUP_SELECTION.LABEL')
    })

    it('should show the host placeholder when the selected key is the host custom group', () => {
      component.placeholderKey = 'COLUMN_GROUP_SELECTION.SELECT.PLACEHOLDER'

      expect(component.selectLabel({ selectedGroupKey: 'custom', customGroupKey: 'custom' } as any)).toBe(
        'COLUMN_GROUP_SELECTION.SELECT.PLACEHOLDER'
      )
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

    // M2: standalone use — deleting the currently selected saved config also clears the selection so
    // the select does not keep pointing at a config that no longer exists; it falls back to the host
    // custom group.
    it('should clear the selected group key to the custom group when the selected config is deleted', fakeAsync(() => {
      store.patchState({
        searchConfigs: [config],
        selectedGroupKey: config.name,
        customGroupKey: 'custom'
      })

      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'primary'
        } as any)
      )
      jest.spyOn(searchConfigServiceSpy, 'deleteSearchConfig').mockReturnValue(of({} as any))

      component.onColumnGroupDelete(config)
      tick(500)

      expect(store.state().searchConfigs).toEqual([])
      expect(store.state().selectedGroupKey).toBe('custom')
    }))

    it('should keep the selected group key when a non-selected config is deleted', fakeAsync(() => {
      store.patchState({
        searchConfigs: [config, onlyColumnsConfig],
        selectedGroupKey: onlyColumnsConfig.name,
        customGroupKey: 'custom'
      })

      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'primary'
        } as any)
      )
      jest.spyOn(searchConfigServiceSpy, 'deleteSearchConfig').mockReturnValue(of({} as any))

      component.onColumnGroupDelete(config)
      tick(500)

      expect(store.state().selectedGroupKey).toBe(onlyColumnsConfig.name)
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

    it('should render the delete affordance only for a non-readonly saved config when the DELETE permission is present', () => {
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
    it('should open the create dialog with columns saved and the column option unfrozen when Save As is invoked', fakeAsync(() => {
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

      component.onColumnGroupSaveAs()
      tick(500)

      expect(dialogServiceSpy).toHaveBeenCalledWith(
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CREATE_HEADER',
        {
          type: CreateOrEditSearchConfigDialogComponent,
          inputs: {
            searchConfigName: '',
            saveInputValues: false,
            saveColumns: true,
            frozeColumnSaveOption: false,
            frozeColumnSaveOptionExplanation: undefined
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

      component.onColumnGroupSaveAs()
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

    it('should save the parsed input values and the advanced flag when the dialog result keeps the input values', fakeAsync(() => {
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
        fieldValues: { k1: 'v1', empty: '' },
        displayedColumnsIds: ['my-col'],
        viewMode: advancedViewMode
      })
      // The dialog result keeps `saveInputValues: true` (unlike the columns-only Seed path), so the
      // request maps `isAdvanced` from the advanced view mode (L424) and `values` from the parsed
      // field values (L426); `parseFieldValues` drops the empty value.
      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          result: {
            searchConfigName: config.name,
            saveInputValues: true,
            saveColumns: true
          },
          button: 'primary'
        } as any)
      )

      component.onColumnGroupSaveAs()
      tick(500)

      expect(createCallSpy).toHaveBeenCalledWith({
        appId: 'my-app',
        productName: 'my-product',
        fieldListVersion: 0,
        isReadonly: false,
        page: 'my-page',
        name: config.name,
        isAdvanced: true,
        columns: ['my-col'],
        values: { k1: 'v1' }
      })
    }))

    it('should fall back to an empty name when the dialog result omits the config name', fakeAsync(() => {
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
        fieldValues: {},
        displayedColumnsIds: ['my-col'],
        viewMode: basicViewMode
      })
      // The dialog result carries no `searchConfigName`, so the request's `name` falls back to `''`
      // via `?? ''` (L423) rather than `undefined`.
      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          result: {
            saveInputValues: false,
            saveColumns: true
          },
          button: 'primary'
        } as any)
      )

      component.onColumnGroupSaveAs()
      tick(500)

      expect(createCallSpy).toHaveBeenCalledWith({
        appId: 'my-app',
        productName: 'my-product',
        fieldListVersion: 0,
        isReadonly: false,
        page: 'my-page',
        name: '',
        isAdvanced: false,
        columns: ['my-col'],
        values: {}
      })
    }))

    it('should map empty values when the input values are saved but no field values are present', fakeAsync(() => {
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
        fieldValues: undefined,
        displayedColumnsIds: ['my-col'],
        viewMode: basicViewMode
      })
      // `saveInputValues: true` but `fieldValues` is undefined, so `data.fieldValues ?? {}` falls back
      // to `{}` (L426) and `parseFieldValues` yields no values.
      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          result: {
            searchConfigName: config.name,
            saveInputValues: true,
            saveColumns: true
          },
          button: 'primary'
        } as any)
      )

      component.onColumnGroupSaveAs()
      tick(500)

      expect(createCallSpy).toHaveBeenCalledWith({
        appId: 'my-app',
        productName: 'my-product',
        fieldListVersion: 0,
        isReadonly: false,
        page: 'my-page',
        name: config.name,
        isAdvanced: false,
        columns: ['my-col'],
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

      component.onColumnGroupSaveAs()
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

      component.onColumnGroupSaveAs()
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

      component.onColumnGroupSaveAs()
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

      component.onColumnGroupSaveAs()
      tick(500)

      expect(portalMessageSpy.error).toHaveBeenCalledWith({
        summaryKey: 'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CREATE_FAILURE'
      })
      expect(consoleSpy).toHaveBeenCalledWith(error)
      expect(addSpy).toHaveBeenCalledTimes(0)
      expect(setGroupSpy).toHaveBeenCalledTimes(0)
    }))

    // M1: standalone Save As — the host usually never sets `pageName`, so the request derives the
    // page name from `getLocation().applicationPath` instead of silently POSTing `undefined`. The
    // fallback is read live from the store and never persisted, so the shared store (and the header
    // remote) keep the real page name and nothing is broadcast.
    it('should post the fallback page name without persisting it when the store has no page name set', fakeAsync(() => {
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
        fieldValues: {},
        displayedColumnsIds: ['my-col'],
        viewMode: basicViewMode
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

      component.onColumnGroupSaveAs()
      tick(500)

      expect(createCallSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          page: getLocation().applicationPath
        })
      )
      // The fallback is read live and never written to the shared store.
      expect(store.state().pageName).toBeUndefined()
    }))

    // M1: the fallback is a live selector, so once the header remote sets the shared store's `pageName`
    // (even after the column remote has already booted with the fallback in place) the next Save As
    // resolves the header's page name — and that value was set by the header, never the column remote.
    it('should use the header page name for the next Save As when it arrives over the store after the fallback', fakeAsync(() => {
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
        fieldValues: {},
        displayedColumnsIds: ['my-col'],
        viewMode: basicViewMode
      })
      // The header remote delivers its page name over the shared store.
      store.setPageName('header-page')
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

      component.onColumnGroupSaveAs()
      tick(500)

      expect(createCallSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 'header-page'
        })
      )
      // The value in the store is the header's — the column remote never persisted the fallback.
      expect(store.state().pageName).toBe('header-page')
    }))

    it('should not silently drop a confirmed dialog when the create call fails', fakeAsync(() => {
      const appState = TestBed.inject(AppStateService)
      jest.spyOn(appState.currentMfe$, 'asObservable').mockReturnValue(
        of({
          appId: 'my-app',
          productName: 'my-product'
        } as any)
      )
      jest.spyOn(searchConfigServiceSpy, 'createSearchConfig').mockReturnValue(throwError(() => new Error('my-error')))
      store.patchState({
        searchConfigs: [],
        pageName: 'my-page',
        fieldValues: {},
        displayedColumnsIds: ['my-col'],
        viewMode: basicViewMode
      })
      // A confirmed (primary) dialog is not swallowed: the failure surfaces as an error toast and no
      // config is added.
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

      component.onColumnGroupSaveAs()
      tick(500)

      expect(portalMessageSpy.error).toHaveBeenCalledWith({
        summaryKey: 'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CREATE_FAILURE'
      })
      expect(store.state().searchConfigs).toHaveLength(0)
    }))
  })

  describe('load search configs', () => {
    it('should fetch the saved configs when the base url, page name and mfe are available and store them', fakeAsync(() => {
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
            { use: jest.fn(), stream: () => of({}) } as any,
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

    // M1: dual-remote race — the column remote loads while the header is inactive, but the header
    // becomes active before the (in-flight) fallback-page response arrives. Because the gate is
    // projected inside the `switchMap`, the stale request is cancelled and its result discarded, so
    // the column remote never stores the wrong page's configs (a plain `filter` would have).
    it('should not store the fetched configs when the header becomes active before the response arrives', fakeAsync(() => {
      const configs = [
        {
          name: 'config-stale',
          values: {},
          columns: ['col-1']
        }
      ] as SearchConfigInfo[]
      const inFlight = new Subject<HttpEvent<GetSearchConfigInfosResponse>>()
      const getSearchConfigInfosSpy = jest
        .spyOn(searchConfigServiceSpy, 'getSearchConfigInfos')
        .mockReturnValue(inFlight)

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

      const localComponent = runInInjectionContext(
        TestBed.inject(Injector),
        () =>
          new OneCXColumnGroupSelectionComponent(
            localBaseUrl,
            { lang$: new BehaviorSubject('en') } as any,
            { use: jest.fn(), stream: () => of({}) } as any,
            searchConfigServiceSpy,
            portalDialogSpy,
            portalMessageSpy,
            appStateService,
            localStore
          )
      )

      // The header remote becomes active while the fallback-page GET is still in flight.
      localStore.patchState({ searchConfigComponentActive: true })

      // The stale fallback-page response arrives after the header is active.
      inFlight.next({ configs } as any)
      inFlight.complete()
      tick(100)

      expect(getSearchConfigInfosSpy).toHaveBeenCalledTimes(1)
      // The stale response is discarded — the column remote did not store it.
      expect(localStore.state().searchConfigs).toEqual([])
      expect(localComponent).toBeTruthy()
    }))

    // M1: standalone load — with no `pageName` input the configs are fetched with the fallback page
    // name derived from `getLocation().applicationPath` (only the base url and the current MFE are
    // provided, as the host does not set a page name).
    it('should load the configs with the fallback page name when no page name is provided', fakeAsync(() => {
      const configs = [
        {
          name: 'config-1',
          values: {},
          columns: ['col-1']
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
      // No `setPageName` — the store's `pageName` stays undefined, so the load derives the fallback.

      const appStateService = {
        currentMfe$: {
          asObservable: () => of({ appId: 'appId', productName: 'product' } as any)
        }
      } as any

      const localComponent = runInInjectionContext(
        TestBed.inject(Injector),
        () =>
          new OneCXColumnGroupSelectionComponent(
            localBaseUrl,
            { lang$: new BehaviorSubject('en') } as any,
            { use: jest.fn(), stream: () => of({}) } as any,
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
        page: getLocation().applicationPath,
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
  // These specs run against a real DOM (PrimeNG overlays, `TestbedHarnessEnvironment`) and cannot
  // use `fakeAsync`, so the debounced `vm$` is flushed with a bounded real-time pump instead of a
  // blind `delay(80)`: `detectChanges()` re-renders on a short tick while `vm$` (a 50 ms
  // `debounceTime`) settles, until two consecutive ticks observe the same emitted view model (the
  // debounce has fired and no further state change is pending), then a final `detectChanges()` and
  // `whenStable()` follow. Waiting on the emitted value — not a fixed sleep — is what removes the
  // wall-clock race between the old `delay(80)` and `debounceTime(50)`.
  const settle = async () => {
    const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
    let last: any
    const sub = childComponent.vm$.subscribe((vm) => (last = vm))
    try {
      let previous: any
      let settled = false
      for (let i = 0; i < 100 && !settled; i++) {
        hostFixture.detectChanges()
        await realSleep(10)
        if (last !== undefined && last === previous) {
          settled = true
        } else {
          previous = last
        }
      }
      hostFixture.detectChanges()
      await hostFixture.whenStable()
    } finally {
      sub.unsubscribe()
    }
  }

  const patchConfigs = async (configs: any[], predefinedGroupKeys: string[] = []) => {
    childComponent.columns = predefinedGroupKeys.length > 0 ? [{ id: 'col', predefinedGroupKeys } as any] : ([] as any)
    childStore.patchState({
      searchConfigs: configs
    })
    hostFixture.detectChanges()
    await settle()
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
      `#${COLUMN_GROUP_SAVE_AS_BUTTON_ID} .p-button-icon`
    ) as HTMLElement
    expect(iconSpan).toBeTruthy()
    expect(iconSpan.classList.contains('pi-save')).toBe(true)
  })

  it('should group the host column groups and the saved column configs in the opened panel when the select is opened', async () => {
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

  it('should render the select and its opened panel inside the remote element with the style hooks when configs are available', async () => {
    await patchConfigs([config])

    const items = await openItems()
    await hostFixture.whenStable()
    expect(items.length).toBeGreaterThan(0)

    const select = hostFixture.nativeElement.querySelector('p-select') as HTMLElement
    expect(select.classList.contains('sc-search-config-select')).toBe(true)

    const panel = hostFixture.nativeElement.querySelector('.sc-search-config-panel') as HTMLElement
    expect(panel).toBeTruthy()

    // The option panel renders inside the remote element because `appendTo` is left at its default
    // (PrimeNG's `self`); pin the recorded decision rather than relying on the panel location alone.
    const selectInstance = childComponent.select() as Select
    expect(selectInstance.appendTo()).toBeUndefined()
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

  it('should render no trash button when the config is read-only', async () => {
    await patchConfigs([config, readonlyConfig])

    const h = await harness()
    expect(await h.getDeleteButton(config.name)).toBeTruthy()
    expect(await h.getDeleteButton(readonlyConfig.name)).toBeNull()
  })

  it('should keep the Save As button enabled and open the save dialog when clicked', async () => {
    await patchConfigs([config])

    const saveAs = await (await harness()).getSaveAsButton()
    const saveAsButton = hostFixture.nativeElement.querySelector(
      `#${COLUMN_GROUP_SAVE_AS_BUTTON_ID} button`
    ) as HTMLButtonElement
    expect(saveAsButton.disabled).toBe(false)

    const saveSpy = jest.spyOn(childComponent, 'onColumnGroupSaveAs').mockImplementation(() => {})
    await (saveAs as NonNullable<typeof saveAs>).click()

    expect(saveSpy).toHaveBeenCalled()
  })

  it('should render a disabled select when there are no predefined column groups and no saved configs', async () => {
    // No saved configs and no predefined groups (no `columns` carry `predefinedGroupKeys`), so the
    // grouped select has no option in either the Predefined or the Saved group and is disabled — the
    // same disabled empty state the search header select uses with no configs — instead of opening to
    // two empty group headers.
    await patchConfigs([])

    const combobox = hostFixture.nativeElement.querySelector('p-select span[role="combobox"]') as HTMLElement
    expect(combobox).toBeTruthy()
    expect(combobox.getAttribute('aria-disabled')).toBe('true')
    expect(combobox.hasAttribute('disabled')).toBe(true)

    // Save As stays enabled.
    const saveAsButton = hostFixture.nativeElement.querySelector(
      `#${COLUMN_GROUP_SAVE_AS_BUTTON_ID} button`
    ) as HTMLButtonElement
    expect(saveAsButton.disabled).toBe(false)
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

  it('should show the full config name with a tooltip that appears on ellipsis when a config is present', async () => {
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
    // The tooltip is forced onto the document `body` (PrimeNG's default) rather than the row, so it
    // can never be clipped by the row's `overflow` and always renders on top of the dense table rows.
    expect(tooltip.getOption('appendTo')).toBe('body')
    // The tooltip is bound to (its target is) the row's name span, not the whole row.
    expect(tooltip.el.nativeElement).toBe(nameSpan)
  })

  it('should show the modified marker and a Modified tooltip on the selected saved config row when its displayed columns differ', async () => {
    // `onlyColumnsConfig` stores only columns (`values: {}`), so the columns aspect is isolated: the
    // page's field values stay equal to the stored (empty) values and only the displayed columns
    // diverge. That divergence is what marks the config modified, while the selection is retained. The
    // header is inactive (default) so the column selection change never swaps the header's current
    // config.
    await patchConfigs([onlyColumnsConfig])
    // The select points at the saved config (`selectedGroupKey`) and the header's current config is the
    // same one; the marker is driven by the selection, so the displayed columns must diverge from the
    // stored columns to mark the selected config modified.
    // The column-group remote is active so the displayed-columns aspect is judged (and the marker
    // appears).
    childStore.patchState({
      selectedGroupKey: onlyColumnsConfig.name,
      currentSearchConfig: onlyColumnsConfig,
      displayedColumnsIds: ['col-9'],
      viewMode: basicViewMode,
      columnGroupComponentActive: true
    })
    await settle()

    const h = await harness()
    await (await h.getConfigSelect())?.open()
    await hostFixture.whenStable()

    const row = hostFixture.nativeElement.querySelector('.sc-search-config-row') as HTMLElement
    expect(row.querySelector('.sc-search-config-row-name')?.textContent.trim()).toBe(onlyColumnsConfig.name)
    expect(row.querySelector('.sc-search-config-modified-marker')?.textContent.trim()).toBe('*')
    // The name span keeps the config's own name as its tooltip; the `*` marker carries the
    // translated "Modified" tooltip.
    expect(
      hostFixture.debugElement
        .query(By.css('.sc-search-config-row .sc-search-config-row-name'))!
        .injector.get(Tooltip)
        .getOption('tooltipLabel')
    ).toBe(onlyColumnsConfig.name)
    expect(
      hostFixture.debugElement
        .query(By.css('.sc-search-config-row .sc-search-config-modified-marker'))!
        .injector.get(Tooltip)
        .getOption('tooltipLabel')
    ).toBe('Modified')

    // The selection was retained, not cleared.
    expect(childStore.state().currentSearchConfig).toBe(onlyColumnsConfig)
  })

  it('should mark only the selected saved config row modified when the displayed columns match neither the selected nor the header config', async () => {
    // The select points at `wide` while the header retains `sales` as its current config, and the
    // displayed columns match neither the selected config's stored columns nor the header's. The row
    // marker is driven by the selection — not by which configs are modified — so only the selected
    // row (the config the select points at) is marked; the header's retained config row shows no `*`.
    const sales = {
      id: 'sales',
      name: 'Sales',
      columns: ['col-s'],
      values: { a: '1' },
      isReadonly: false,
      isAdvanced: false
    } as SearchConfigInfo
    const wide = {
      id: 'wide',
      name: 'Wide',
      columns: ['col-w', 'col-x'],
      values: {},
      isReadonly: false,
      isAdvanced: false
    } as SearchConfigInfo

    await patchConfigs([sales, wide])
    // The column-group remote is active so the displayed-columns aspect is judged.
    childStore.patchState({
      selectedGroupKey: wide.name,
      currentSearchConfig: sales,
      displayedColumnsIds: ['col-9'],
      fieldValues: { a: '1' },
      viewMode: basicViewMode,
      columnGroupComponentActive: true
    })
    await settle()

    const vm = await firstValueFrom(childStore.columnSelectionVm$)
    // The column select marks its selection (Wide) modified. The header marks its retained current
    // config (Sales) modified — both are modified, and they are two different configs.
    expect(vm.selectedConfigModified).toBe(true)

    // The selection was applied and the header's current config was retained, not swapped.
    expect(childStore.state().selectedGroupKey).toBe(wide.name)
    expect(childStore.state().currentSearchConfig).toBe(sales)

    const h = await harness()
    await (await h.getConfigSelect())?.open()
    await hostFixture.whenStable()

    // The column-group select marks the row it points at (Wide) with the `*` and the "Modified" tooltip.
    const nameSpans = hostFixture.debugElement.queryAll(By.css('.sc-search-config-row-name'))
    const rows = Array.from(hostFixture.nativeElement.querySelectorAll('.sc-search-config-row')) as HTMLElement[]
    const wideRow = rows.find(
      (row) => row.querySelector('.sc-search-config-row-name')?.textContent?.trim() === wide.name
    )!
    const wideNameSpan = nameSpans.find((span) => (span.nativeElement as HTMLElement).textContent?.trim() === wide.name)
    expect(wideRow).toBeTruthy()
    expect(wideNameSpan).toBeTruthy()
    expect(wideRow.querySelector('.sc-search-config-modified-marker')?.textContent.trim()).toBe('*')
    // The name span keeps the config's own name as its tooltip; the `*` marker carries the
    // translated "Modified" tooltip. Only Wide is marked, so there is exactly one marker.
    expect(wideNameSpan!.injector.get(Tooltip).getOption('tooltipLabel')).toBe(wide.name)
    const wideMarker = hostFixture.debugElement.queryAll(
      By.css('.sc-search-config-row .sc-search-config-modified-marker')
    )
    expect(wideMarker).toHaveLength(1)
    expect(wideMarker[0].injector.get(Tooltip).getOption('tooltipLabel')).toBe('Modified')

    // The retained header config (Sales) is NOT marked in the column-group select — it is a different
    // config from the one selected, so its row shows its name and no `*`.
    const salesNameSpan = nameSpans.find(
      (span) => (span.nativeElement as HTMLElement).textContent?.trim() === sales.name
    )
    expect(salesNameSpan).toBeTruthy()
    const salesRow = rows.find(
      (row) => row.querySelector('.sc-search-config-row-name')?.textContent?.trim() === sales.name
    )!
    expect(salesRow.querySelector('.sc-search-config-modified-marker')).toBeNull()
    expect(salesNameSpan!.injector.get(Tooltip).getOption('tooltipLabel')).toBe(sales.name)
  })

  it('should clear the modified marker and restore the name tooltip when the displayed columns are restored', async () => {
    // Isolate the columns aspect with `onlyColumnsConfig` (`values: {}`), so restoring the stored
    // displayed columns is what clears the flag — not some residual values mismatch. The select points
    // at the saved config (`selectedGroupKey`), which is the config the marker refers to.
    await patchConfigs([onlyColumnsConfig])
    // The column-group remote is active so the displayed-columns divergence is judged (and the marker
    // appears).
    childStore.patchState({
      selectedGroupKey: onlyColumnsConfig.name,
      currentSearchConfig: onlyColumnsConfig,
      displayedColumnsIds: ['col-9'],
      viewMode: basicViewMode,
      columnGroupComponentActive: true
    })
    await settle()

    const h = await harness()
    await (await h.getConfigSelect())?.open()
    await hostFixture.whenStable()
    expect(
      hostFixture.nativeElement.querySelector('.sc-search-config-row .sc-search-config-modified-marker')
    ).toBeTruthy()

    // Restoring the stored displayed columns clears the flag: the marker is gone and the name tooltip
    // is the config name again.
    childStore.patchState({ displayedColumnsIds: onlyColumnsConfig.columns })
    await settle()
    await hostFixture.whenStable()

    expect(
      hostFixture.nativeElement.querySelector('.sc-search-config-row .sc-search-config-modified-marker')
    ).toBeNull()
    expect(
      hostFixture.debugElement
        .query(By.css('.sc-search-config-row .sc-search-config-row-name'))!
        .injector.get(Tooltip)
        .getOption('tooltipLabel')
    ).toBe(onlyColumnsConfig.name)
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

  it('should not delete via the keyboard path when a predefined group is focused', async () => {
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

  it('should not delete a saved config of the same name when the predefined leaf is focused', async () => {
    ;(portalDialogHostMock.openDialog as jest.Mock).mockReturnValue(of(undefined as any))
    // A saved config whose name collides with a host predefined column-group key. The predefined leaf
    // must not resolve to the saved config by name — the `isPredefined` guard stops the delete even
    // though `state.searchConfigs.find((c) => c.name === option.value)` would otherwise match.
    const collidingConfig = { ...config, name: 'default' }
    await patchConfigs([collidingConfig], ['default'])

    const deleteSpy = jest.spyOn(childComponent, 'onColumnGroupDelete').mockImplementation(() => {})
    const select = (childComponent as any).select() as Select
    const combobox = comboboxOf(select)

    await (await (await harness()).getConfigSelect())?.open()
    await hostFixture.whenStable()

    // Both the predefined leaf and the saved-config leaf resolve to `value: 'default'`; PrimeNG keeps
    // the first (predefined, `isPredefined: true`) leaf focused.
    const visibleOptions = select.visibleOptions() as any[]
    const predefinedLeaf = visibleOptions.find((option) => option?.isPredefined && option?.value === 'default')
    expect(predefinedLeaf).toBeTruthy()
    select.focusedOptionIndex.set(visibleOptions.indexOf(predefinedLeaf as any))
    combobox.dispatchEvent(new KeyboardEvent('keydown', { code: 'Delete', bubbles: true, cancelable: true }))
    await hostFixture.whenStable()
    expect(deleteSpy).not.toHaveBeenCalled()
  })

  it('should not delete via the keyboard path when a non-Delete key is pressed on the open combobox', async () => {
    ;(portalDialogHostMock.openDialog as jest.Mock).mockReturnValue(of(undefined as any))

    await patchConfigs([config])

    const deleteSpy = jest.spyOn(childComponent, 'onColumnGroupDelete').mockImplementation(() => {})
    const select = (childComponent as any).select() as Select
    const combobox = comboboxOf(select)

    await (await (await harness()).getConfigSelect())?.open()
    await hostFixture.whenStable()
    expect(select.overlayVisible).toBe(true)

    // A key other than `Delete` (here `Backspace`) is filtered by the `event.code !== 'Delete'` guard
    // (L316-317) and returns early, so no delete is triggered even on the open combobox.
    combobox.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backspace', bubbles: true, cancelable: true }))
    await hostFixture.whenStable()

    expect(deleteSpy).not.toHaveBeenCalled()
  })

  it('should not delete via the keyboard path when Delete is pressed inside the filter input', async () => {
    ;(portalDialogHostMock.openDialog as jest.Mock).mockReturnValue(of(undefined as any))

    await patchConfigs([config])

    const deleteSpy = jest.spyOn(childComponent, 'onColumnGroupDelete').mockImplementation(() => {})
    const select = (childComponent as any).select() as Select
    const combobox = comboboxOf(select)

    // Open the panel and focus an option. With `[filter]="true"`, PrimeNG focuses the filter input,
    // and its keydown bubbles up to the `p-select` host, so a real Delete on the filter input must not
    // trigger the delete shortcut (the `event.target !== focusInputViewChild` guard, L321-322).
    await (await (await harness()).getConfigSelect())?.open()
    await hostFixture.whenStable()
    combobox.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', bubbles: true }))
    await hostFixture.whenStable()
    expect(select.focusedOptionIndex()).toBeGreaterThanOrEqual(0)

    const filterInput = hostFixture.nativeElement.querySelector('p-select input[role="searchbox"]') as HTMLElement
    expect(filterInput).toBeTruthy()
    filterInput.dispatchEvent(new KeyboardEvent('keydown', { code: 'Delete', bubbles: true, cancelable: true }))
    await hostFixture.whenStable()

    expect(deleteSpy).not.toHaveBeenCalled()
  })

  it('should not delete via the keyboard path when the focused saved config is read-only', async () => {
    ;(portalDialogHostMock.openDialog as jest.Mock).mockReturnValue(of(undefined as any))

    await patchConfigs([readonlyConfig])

    const deleteSpy = jest.spyOn(childComponent, 'onColumnGroupDelete').mockImplementation(() => {})
    const select = (childComponent as any).select() as Select
    const combobox = comboboxOf(select)

    await (await (await harness()).getConfigSelect())?.open()
    await hostFixture.whenStable()

    // Focus the read-only saved-config leaf and press Delete on the combobox: the config resolves (the
    // `config &&` side is truthy) but `canDelete(config)` is false (read-only), so the delete is a no-op
    // and the browser default is not consumed — the `canDelete`-false branch of L336.
    const visibleOptions = select.visibleOptions() as any[]
    const readonlyIndex = visibleOptions.findIndex((option) => option?.value === readonlyConfig.name)
    expect(readonlyIndex).toBeGreaterThanOrEqual(0)
    select.focusedOptionIndex.set(readonlyIndex)

    const deleteEvent = new KeyboardEvent('keydown', { code: 'Delete', bubbles: true, cancelable: true })
    combobox.dispatchEvent(deleteEvent)
    await hostFixture.whenStable()

    expect(deleteSpy).not.toHaveBeenCalled()
    expect(deleteEvent.defaultPrevented).toBe(false)
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

  it('should hide the Save As button but still render the select when the SEARCHCONFIG#CREATE permission is missing', async () => {
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
  it('should boot the remote providers and inject a real NgZone (not NoopNgZone) when the remote is mounted', async () => {
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

  it('should reuse the shell NgZone instead of creating a private one when the shell publishes its NgZone before the remote boots', async () => {
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
