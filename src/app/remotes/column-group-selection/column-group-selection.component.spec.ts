import { provideHttpClientTesting } from '@angular/common/http/testing'
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing'
import { NoopAnimationsModule } from '@angular/platform-browser/animations'
import { provideHttpClient } from '@angular/common/http'
import { BehaviorSubject, ReplaySubject, Subject, firstValueFrom, of, throwError } from 'rxjs'
import { DialogService } from 'primeng/dynamicdialog'

import { REMOTE_COMPONENT_CONFIG, RemoteComponentConfig } from '@onecx/angular-utils'
import { FakeTopic } from '@onecx/angular-integration-interface/mocks'
import { PortalDialogService } from '@onecx/angular-accelerator'
import { PortalMessageService } from '@onecx/angular-integration-interface'
import { provideTranslateTestingService } from '@onecx/angular-testing'

import {
  SEARCH_CONFIG_STORE_NAME,
  SEARCH_CONFIG_TOPIC,
  SearchConfigMessage,
  SearchConfigStore
} from 'src/app/shared/search-config.store'
import { advancedViewMode, basicViewMode } from 'src/app/shared/constants'
import { CreateOrEditSearchConfigDialogComponent } from 'src/app/shared/components/create-or-edit-search-config-dialog/create-or-edit-search-config-dialog.component'
import { Configuration, SearchConfigAPIService } from 'src/app/shared/generated'
import { OneCXColumnGroupSelectionComponent } from './column-group-selection.component'

const createSpyObj = (baseName: string, methodNames: Array<string>): { [key: string]: any } => {
  const obj: any = {}

  for (let i = 0; i < methodNames.length; i++) {
    obj[methodNames[i]] = jest.fn()
  }

  return obj
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
      imports: [OneCXColumnGroupSelectionComponent, NoopAnimationsModule],
      providers: [
        ...provideTranslateTestingService({
          en: require('./src/assets/i18n/en.json'),
          de: require('./src/assets/i18n/de.json')
        }),
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
  describe('overlay content', () => {
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

    it('should handle optional hide and cleanup branches', () => {
      component.op = undefined
      expect(() => component.onColumnGroupChange('default')).not.toThrow()

      component.dataRevertSub = undefined
      component.selectedGroupKeySub = undefined
      expect(() => component.ngOnDestroy()).not.toThrow()
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

    it('should unsubscribe both subscriptions when component is destroyed', () => {
      const revertSub = { unsubscribe: jest.fn() }
      const selectedSub = { unsubscribe: jest.fn() }

      component.dataRevertSub = revertSub as any
      component.selectedGroupKeySub = selectedSub as any

      component.ngOnDestroy()

      expect(revertSub.unsubscribe).toHaveBeenCalledTimes(1)
      expect(selectedSub.unsubscribe).toHaveBeenCalledTimes(1)
    })

    it('should format overlay text and helper methods for config and key states', () => {
      const vm = {
        editMode: false,
        currentConfig: undefined,
        selectedGroupKey: 'config-3',
        searchConfigsWithColumns: [onlyColumnsConfig],
        customGroupKey: 'custom',
        nonSearchConfigGroupKeys: ['default'],
        allGroupKeys: ['config-3', 'default', 'custom']
      } as any

      expect(
        component.overlayButtonText({
          ...vm,
          editMode: true,
          currentConfig: { name: 'config-3' }
        })
      ).toEqual({
        type: 'config',
        key: 'COLUMN_GROUP_SELECTION.EDITING',
        params: { group: 'config-3' }
      })

      expect(component.overlayButtonText(vm)).toEqual({
        type: 'config',
        key: 'COLUMN_GROUP_SELECTION.ACTIVE',
        params: { group: 'config-3' }
      })

      expect(component.overlayButtonText({ ...vm, selectedGroupKey: 'unknown' })).toEqual({
        type: 'key',
        key: 'COLUMN_GROUP_SELECTION.ACTIVE',
        params: { group: 'unknown' }
      })

      expect(component.isReadonly('config-3', vm)).toBe(false)
      expect(component.isReadonly('missing', vm)).toBe(false)
      expect(component.getConfigByName(vm.searchConfigsWithColumns, 'config-3')).toEqual(onlyColumnsConfig)
      expect(component.getConfigByName(vm.searchConfigsWithColumns, 'missing')).toBeUndefined()
      expect(component.isConfig('config-3', vm)).toBe(true)
      expect(component.isConfig('missing', vm)).toBe(false)
      expect(component.allGroupKeysWithoutCustom(vm)).toEqual(['config-3', 'default'])
    })
  })

  describe('on edit actions', () => {
    it('should cancel edit mode on edit cancel button click', fakeAsync(() => {
      const cancelEditSpy = jest.spyOn(store, 'cancelEdit')
      store.patchState({
        searchConfigs: [onlyColumnsConfig],
        layout: 'table'
      })

      component.onSearchConfigEdit(onlyColumnsConfig)
      component.onSearchConfigCancelEdit()
      tick(500)

      expect(cancelEditSpy).toHaveBeenCalledTimes(1)
    }))

    it('should not set edit mode if config is not set', fakeAsync(() => {
      const enterEditModeSpy = jest.spyOn(store, 'enterEditMode')

      component.onSearchConfigEdit(undefined)

      tick(500)

      expect(enterEditModeSpy).toHaveBeenCalledTimes(0)
    }))
  })

  describe('on delete actions', () => {
    it('should delete config', fakeAsync(() => {
      const deleteSpy = jest.spyOn(store, 'deleteSearchConfig')
      store.patchState({
        searchConfigs: [onlyColumnsConfig],
        layout: 'table'
      })

      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'primary'
        } as any)
      )
      jest.spyOn(searchConfigServiceSpy, 'deleteSearchConfig').mockReturnValue(of({} as any))
      component.onSearchConfigDelete(onlyColumnsConfig)
      tick(500)

      expect(portalDialogSpy.openDialog).toHaveBeenCalled()
      expect(portalMessageSpy.info).toHaveBeenCalledWith({
        summaryKey: 'SEARCH_CONFIG.DELETE_SUCCESS'
      })
      expect(deleteSpy).toHaveBeenCalledWith(onlyColumnsConfig)
    }))

    it('should not delete config if dialog was closed', fakeAsync(() => {
      const deleteSpy = jest.spyOn(store, 'deleteSearchConfig')
      store.patchState({
        searchConfigs: [onlyColumnsConfig],
        layout: 'table'
      })

      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(of(undefined as any))
      component.onSearchConfigDelete(onlyColumnsConfig)
      tick(500)

      expect(deleteSpy).not.toHaveBeenCalled()
    }))

    it('should not delete config if secondary button was chosen', fakeAsync(() => {
      const deleteSpy = jest.spyOn(store, 'deleteSearchConfig')
      store.patchState({
        searchConfigs: [onlyColumnsConfig],
        layout: 'table'
      })

      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'secondary'
        } as any)
      )

      component.onSearchConfigDelete(onlyColumnsConfig)
      tick(500)

      expect(deleteSpy).not.toHaveBeenCalled()
    }))

    it('should not delete config if delete call failed', fakeAsync(() => {
      const deleteSpy = jest.spyOn(store, 'deleteSearchConfig')
      const consoleSpy = jest.spyOn(console, 'error')
      const error = new Error('my-error-msg')
      store.patchState({
        searchConfigs: [onlyColumnsConfig],
        layout: 'table'
      })

      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'primary'
        } as any)
      )
      jest.spyOn(searchConfigServiceSpy, 'deleteSearchConfig').mockReturnValue(throwError(() => error))

      component.onSearchConfigDelete(onlyColumnsConfig)
      tick(500)

      expect(deleteSpy).not.toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalledWith(error)
      expect(portalMessageSpy.error).toHaveBeenCalledWith({
        summaryKey: 'SEARCH_CONFIG.DELETE_FAILURE'
      })
    }))

    it('should not open dialog if config is not set', fakeAsync(() => {
      const dialogSpy = jest.spyOn(portalDialogSpy, 'openDialog')

      component.onSearchConfigDelete(undefined)

      tick(500)

      expect(dialogSpy).toHaveBeenCalledTimes(0)
    }))
  })

  describe('on edit save', () => {
    it('should cancel edit if edit was not confirmed', fakeAsync(() => {
      const cancelEditSpy = jest.spyOn(store, 'cancelEdit')
      store.patchState({
        searchConfigs: [onlyColumnsConfig],
        layout: 'table',
        columnGroupComponentActive: true
      })
      jest.spyOn(searchConfigServiceSpy, 'getSearchConfig').mockReturnValue(
        of({
          config: onlyColumnsConfig
        } as any)
      )

      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'secondary'
        } as any)
      )

      component.onSearchConfigSaveEdit(onlyColumnsConfig)
      tick(500)

      expect(cancelEditSpy).toHaveBeenCalledTimes(1)
    }))

    it('should save edit config if edit was confirmed', fakeAsync(() => {
      const saveEditSpy = jest.spyOn(store, 'saveEdit')
      const updatedConfig = {
        ...onlyColumnsConfig,
        name: 'conf-1',
        values: {
          k: 'v-2'
        }
      }
      store.patchState({
        searchConfigs: [onlyColumnsConfig],
        layout: 'table',
        columnGroupComponentActive: true
      })
      jest.spyOn(searchConfigServiceSpy, 'getSearchConfig').mockReturnValue(
        of({
          config: onlyColumnsConfig
        } as any)
      )
      jest.spyOn(searchConfigServiceSpy, 'updateSearchConfig').mockReturnValue(
        of({
          configs: [updatedConfig]
        } as any)
      )

      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'primary',
          result: { searchConfigName: 'conf-1' }
        } as any)
      )

      component.onSearchConfigSaveEdit(onlyColumnsConfig)
      tick(500)

      expect(portalMessageSpy.info).toHaveBeenCalledWith({
        summaryKey: 'SEARCH_CONFIG.CREATE_EDIT_DIALOG.EDIT_SUCCESS'
      })
      expect(saveEditSpy).toHaveBeenCalledWith(updatedConfig)
    }))

    it('should save inputs and viewMode', fakeAsync(() => {
      const updateSpy = jest.spyOn(searchConfigServiceSpy, 'updateSearchConfig').mockReturnValue(of(undefined as any))
      const initState = {
        searchConfigs: [onlyColumnsConfig],
        layout: 'table',
        columnGroupComponentActive: true
      }
      store.patchState(initState as any)
      jest.spyOn(searchConfigServiceSpy, 'getSearchConfig').mockReturnValue(
        of({
          config: onlyColumnsConfig
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
        fieldValues: {
          k: 'v_2'
        },
        viewMode: advancedViewMode
      } as any)

      component.onSearchConfigSaveEdit(onlyColumnsConfig)
      tick(500)

      expect(updateSpy).toHaveBeenCalledWith(onlyColumnsConfig.id, {
        searchConfig: {
          ...onlyColumnsConfig,
          name: 'new-name',
          columns: [],
          values: {
            k: 'v_2'
          },
          isAdvanced: true
        }
      })
    }))

    it('should save columns', fakeAsync(() => {
      const updateSpy = jest.spyOn(searchConfigServiceSpy, 'updateSearchConfig').mockReturnValue(of(undefined as any))
      const initState = {
        searchConfigs: [onlyColumnsConfig],
        layout: 'table',
        columnGroupComponentActive: true
      }
      store.patchState(initState as any)
      jest.spyOn(searchConfigServiceSpy, 'getSearchConfig').mockReturnValue(
        of({
          config: onlyColumnsConfig
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

      component.onSearchConfigSaveEdit(onlyColumnsConfig)
      tick(500)

      expect(updateSpy).toHaveBeenCalledWith(onlyColumnsConfig.id, {
        searchConfig: {
          ...onlyColumnsConfig,
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
        searchConfigs: [onlyColumnsConfig],
        layout: 'table',
        columnGroupComponentActive: true
      })
      jest.spyOn(searchConfigServiceSpy, 'getSearchConfig').mockReturnValue(throwError(() => error))

      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'primary'
        } as any)
      )

      component.onSearchConfigSaveEdit(onlyColumnsConfig)
      tick(500)

      expect(cancelEditSpy).toHaveBeenCalledTimes(1)
    }))

    it('should cancel edit if update search config call failed', fakeAsync(() => {
      const cancelEditSpy = jest.spyOn(store, 'cancelEdit')
      store.patchState({
        searchConfigs: [onlyColumnsConfig],
        layout: 'table',
        columnGroupComponentActive: true
      })
      const error = new Error('my-msg')
      jest.spyOn(searchConfigServiceSpy, 'getSearchConfig').mockReturnValue(
        of({
          config: onlyColumnsConfig
        } as any)
      )
      jest.spyOn(searchConfigServiceSpy, 'updateSearchConfig').mockReturnValue(throwError(() => error))

      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'primary'
        } as any)
      )

      component.onSearchConfigSaveEdit(onlyColumnsConfig)
      tick(500)

      expect(cancelEditSpy).toHaveBeenCalledTimes(1)
    }))

    it('should use config fallback values when editing with no values or columns', fakeAsync(() => {
      const updateSpy = jest.spyOn(searchConfigServiceSpy, 'updateSearchConfig').mockReturnValue(
        of({
          configs: [{ ...onlyColumnsConfig, values: {}, columns: [] }]
        } as any)
      )
      const configWithoutValuesOrColumns = {
        ...onlyColumnsConfig,
        values: undefined,
        columns: []
      } as any

      store.patchState({
        displayedColumnsIds: ['col-2'],
        fieldValues: { k: 'v_2' },
        viewMode: basicViewMode,
        layout: 'table'
      } as any)

      jest
        .spyOn(searchConfigServiceSpy, 'getSearchConfig')
        .mockReturnValue(of({ config: configWithoutValuesOrColumns } as any))
      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'primary',
          result: {
            searchConfigName: undefined,
            saveInputValues: false,
            saveColumns: false
          }
        } as any)
      )

      component.onSearchConfigSaveEdit(configWithoutValuesOrColumns)
      tick(500)

      expect(updateSpy).toHaveBeenCalledWith(configWithoutValuesOrColumns.id, {
        searchConfig: {
          ...configWithoutValuesOrColumns,
          name: configWithoutValuesOrColumns.name,
          columns: [],
          values: {},
          isAdvanced: false
        }
      })
    }))

    it('should use empty string when dialog name and config name are undefined', fakeAsync(() => {
      const configWithoutName = {
        ...onlyColumnsConfig,
        name: undefined
      } as any

      const updateSpy = jest
        .spyOn(searchConfigServiceSpy, 'updateSearchConfig')
        .mockReturnValue(of({ configs: [] } as any))

      store.patchState({
        displayedColumnsIds: [],
        fieldValues: {},
        viewMode: basicViewMode
      } as any)

      jest.spyOn(searchConfigServiceSpy, 'getSearchConfig').mockReturnValue(of({ config: configWithoutName } as any))

      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'primary',
          result: {
            searchConfigName: undefined,
            saveInputValues: false,
            saveColumns: false
          }
        } as any)
      )

      component.onSearchConfigSaveEdit(configWithoutName)

      tick(500)

      expect(updateSpy).toHaveBeenCalledWith(configWithoutName.id, {
        searchConfig: expect.objectContaining({
          name: ''
        })
      })
    }))

    it('should use empty object when field values are undefined', fakeAsync(() => {
      const updateSpy = jest
        .spyOn(searchConfigServiceSpy, 'updateSearchConfig')
        .mockReturnValue(of({ configs: [] } as any))

      store.patchState({
        displayedColumnsIds: [],
        fieldValues: undefined,
        viewMode: basicViewMode
      } as any)

      jest.spyOn(searchConfigServiceSpy, 'getSearchConfig').mockReturnValue(of({ config: onlyColumnsConfig } as any))

      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'primary',
          result: {
            searchConfigName: 'new-name',
            saveInputValues: true,
            saveColumns: false
          }
        } as any)
      )

      component.onSearchConfigSaveEdit(onlyColumnsConfig)

      tick(500)

      expect(updateSpy).toHaveBeenCalledWith(
        onlyColumnsConfig.id,
        expect.objectContaining({
          searchConfig: expect.objectContaining({
            values: {}
          })
        })
      )
    }))

    it('should set saveColumns to false when config columns are undefined', fakeAsync(() => {
      const configWithoutData = {
        ...config,
        values: undefined,
        columns: undefined
      } as any
      jest.spyOn(searchConfigServiceSpy, 'getSearchConfig').mockReturnValue(
        of({
          config: configWithoutData
        } as any)
      )

      jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'secondary'
        } as any)
      )
      const configWithoutColumns = {
        ...onlyColumnsConfig,
        columns: undefined
      } as any

      const openDialogSpy = jest.spyOn(portalDialogSpy, 'openDialog').mockReturnValue(
        of({
          button: 'secondary'
        } as any)
      )

      component.onSearchConfigSaveEdit(configWithoutColumns)

      tick(500)

      expect(openDialogSpy).toHaveBeenCalledWith(
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.EDIT_HEADER',
        {
          type: CreateOrEditSearchConfigDialogComponent,
          inputs: {
            searchConfigName: configWithoutColumns.name,
            saveInputValues: false,
            saveColumns: false
          }
        },
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CONFIRM',
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CANCEL'
      )
    }))

    it('should cancel edit if config is not set', fakeAsync(() => {
      const cancelEditSpy = jest.spyOn(store, 'cancelEdit')

      component.onSearchConfigSaveEdit(undefined)

      tick(500)

      expect(cancelEditSpy).toHaveBeenCalledTimes(1)
    }))
  })

  describe('on dataToRevert change', () => {
    it('should not emit if data does not contain columnGroupKey', fakeAsync(() => {
      const emitterSpy = jest.spyOn(component.groupSelectionChanged, 'emit')

      store.patchState({
        dataToRevert: {
          fieldValues: { k: 'v' },
          viewMode: advancedViewMode,
          displayedColumnsIds: ['col-2'],
          columnGroupKey: undefined
        }
      })

      tick(500)

      expect(emitterSpy).toHaveBeenCalledTimes(0)
    }))

    it('should emit searchConfigSelected', fakeAsync(() => {
      component.columns = [
        {
          id: 'col-1'
        } as any,
        {
          id: 'col-2'
        },
        {
          id: 'col-3'
        } as any
      ]
      const emitterSpy = jest.spyOn(component.groupSelectionChanged, 'emit')

      store.patchState({
        dataToRevert: {
          fieldValues: {
            k: 'v_1'
          },
          viewMode: advancedViewMode,
          displayedColumnsIds: ['col-2'],
          columnGroupKey: 'default'
        }
      })

      tick(500)

      expect(emitterSpy).toHaveBeenCalledWith({
        activeColumns: [{ id: 'col-2' }],
        groupKey: 'default'
      })
    }))
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
        dataToRevert$: of(undefined),
        selectedGroupKey$,
        columnSelectionVm$: vm$,
        setSelectedGroupKey: jest.fn(),
        setCustomGroupKey: jest.fn(),
        updateDisplayedColumnsIds: jest.fn(),
        updateLayout: jest.fn(),
        setNonSearchConfigGroupKeys: jest.fn()
      } as any

      const fakeComponent = new OneCXColumnGroupSelectionComponent(
        new ReplaySubject<RemoteComponentConfig>(1),
        { lang$: new BehaviorSubject('en') } as any,
        { use: jest.fn() } as any,
        { configuration: new Configuration({ basePath: '' }) } as any,
        fakeStore,
        { openDialog: jest.fn() } as any,
        { info: jest.fn(), error: jest.fn() } as any
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
        dataToRevert$: of(undefined),
        selectedGroupKey$,
        columnSelectionVm$: vm$,
        setSelectedGroupKey: jest.fn(),
        setCustomGroupKey: jest.fn(),
        updateDisplayedColumnsIds: jest.fn(),
        updateLayout: jest.fn(),
        setNonSearchConfigGroupKeys: jest.fn()
      } as any

      const fakeComponent = new OneCXColumnGroupSelectionComponent(
        new ReplaySubject<RemoteComponentConfig>(1),
        { lang$: new BehaviorSubject('en') } as any,
        { use: jest.fn() } as any,
        { configuration: new Configuration({ basePath: '' }) } as any,
        fakeStore,
        { openDialog: jest.fn() } as any,
        { info: jest.fn(), error: jest.fn() } as any
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
        dataToRevert$: of(undefined),
        selectedGroupKey$,
        columnSelectionVm$: vm$,
        setSelectedGroupKey: jest.fn(),
        setCustomGroupKey: jest.fn(),
        updateDisplayedColumnsIds: jest.fn(),
        updateLayout: jest.fn(),
        setNonSearchConfigGroupKeys: jest.fn()
      } as any

      const fakeComponent = new OneCXColumnGroupSelectionComponent(
        new ReplaySubject<RemoteComponentConfig>(1),
        { lang$: new BehaviorSubject('en') } as any,
        { use: jest.fn() } as any,
        { configuration: new Configuration({ basePath: '' }) } as any,
        fakeStore,
        { openDialog: jest.fn() } as any,
        { info: jest.fn(), error: jest.fn() } as any
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

  describe('focusManageButton', () => {
    it('should not throw when manage button is undefined', () => {
      component.manageButton = undefined

      expect(() => component.focusManageButton()).not.toThrow()
    })
  })
})
