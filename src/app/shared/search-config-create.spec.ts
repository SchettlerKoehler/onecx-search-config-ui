import { BehaviorSubject, Subject, lastValueFrom, of, throwError } from 'rxjs'

import { PortalDialogService } from '@onecx/angular-accelerator'
import { AppStateService, PortalMessageService } from '@onecx/angular-integration-interface'

import { SearchConfigAPIService, SearchConfigInfo } from 'src/app/shared/generated'
import { advancedViewMode, SEARCH_CONFIG_DIALOG_WIDTH } from './constants'
import { loadSearchConfigInfos, saveSearchConfig } from './search-config-create'
import { SearchConfigStore } from './search-config.store'

describe('search-config-create', () => {
  const existingConfig: SearchConfigInfo = {
    id: 'config-id',
    name: 'Config-1',
    columns: ['stored-col'],
    values: {
      k1: 'v1'
    },
    isReadonly: false,
    isAdvanced: false
  }

  const readonlyConfig: SearchConfigInfo = {
    id: 'readonly-id',
    name: 'Locked',
    columns: [],
    values: {
      k1: 'v1'
    },
    isReadonly: true,
    isAdvanced: false
  }

  const createdConfig: SearchConfigInfo = {
    ...existingConfig,
    id: 'new-id',
    name: 'new-config'
  }

  let portalDialogService: PortalDialogService
  let searchConfigService: SearchConfigAPIService
  let messageService: PortalMessageService
  let appStateService: AppStateService
  let store: SearchConfigStore

  const openDialog = jest.fn()
  const getSearchConfigInfos = jest.fn()
  const create = jest.fn()
  const update = jest.fn()
  const info = jest.fn()
  const success = jest.fn()
  const error = jest.fn()

  const baseDialogInputs = {
    existingConfigs: [existingConfig],
    appendTo: 'self' as const,
    panelStyleClass: 'panel-class',
    saveInputValues: true,
    saveColumns: true,
    frozeColumnSaveOption: false,
    frozeColumnSaveOptionExplanation: 'EXPLANATION'
  }

  const pageName = of('page-name')

  beforeEach(() => {
    openDialog.mockReset()
    getSearchConfigInfos.mockReset()
    create.mockReset()
    update.mockReset()
    info.mockReset()
    success.mockReset()
    error.mockReset()

    portalDialogService = { openDialog } as unknown as PortalDialogService
    searchConfigService = {
      getSearchConfigInfos,
      createSearchConfig: create,
      updateSearchConfig: update
    } as unknown as SearchConfigAPIService
    messageService = { info, success, error } as unknown as PortalMessageService
    appStateService = {
      currentMfe$: {
        asObservable: () => of({ appId: 'appId', productName: 'product' } as any)
      }
    } as any
    store = {
      currentPageData$: of({
        fieldValues: { f1: 'v1' },
        viewMode: advancedViewMode,
        displayedColumnsIds: ['col-1'],
        columnGroupKey: undefined
      })
    } as unknown as SearchConfigStore
  })

  describe('loadSearchConfigInfos', () => {
    const baseUrl = of({} as any)

    it('should fetch the configs and emit them when all inputs are available', async () => {
      getSearchConfigInfos.mockReturnValue(of({ configs: [existingConfig] }))

      const configs = await lastValueFrom(
        loadSearchConfigInfos(baseUrl, appStateService, searchConfigService, messageService, of('page-name'))
      )

      expect(configs).toStrictEqual([existingConfig])
      expect(getSearchConfigInfos).toHaveBeenCalledWith({ appId: 'appId', page: 'page-name', productName: 'product' })
    })

    it('should fire an error toast and emit no configs when the fetch fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error')
      const failure = new Error('load-failed')
      getSearchConfigInfos.mockReturnValue(throwError(() => failure))

      const configs = await lastValueFrom(
        loadSearchConfigInfos(baseUrl, appStateService, searchConfigService, messageService, of('page-name'))
      )

      expect(configs).toStrictEqual([])
      expect(error).toHaveBeenCalledWith({ summaryKey: 'SEARCH_CONFIG.LOAD_FAILURE' })
      expect(consoleSpy).toHaveBeenCalledWith(failure)
      consoleSpy.mockRestore()
    })

    it('should not fetch when the load guard is false', () => {
      const guard = new BehaviorSubject(false)
      getSearchConfigInfos.mockReturnValue(of({ configs: [existingConfig] }))

      const emissions: SearchConfigInfo[][] = []
      loadSearchConfigInfos(
        baseUrl,
        appStateService,
        searchConfigService,
        messageService,
        of('page-name'),
        guard
      ).subscribe((configs) => emissions.push(configs))

      expect(getSearchConfigInfos).not.toHaveBeenCalled()
      expect(emissions).toStrictEqual([])
    })

    it('should fetch when the load guard flips to true', () => {
      const guard = new BehaviorSubject(false)
      getSearchConfigInfos.mockReturnValue(of({ configs: [existingConfig] }))

      const emissions: SearchConfigInfo[][] = []
      const subscription = loadSearchConfigInfos(
        baseUrl,
        appStateService,
        searchConfigService,
        messageService,
        of('page-name'),
        guard
      ).subscribe((configs) => emissions.push(configs))

      expect(getSearchConfigInfos).not.toHaveBeenCalled()

      guard.next(true)
      expect(getSearchConfigInfos).toHaveBeenCalledWith({ appId: 'appId', page: 'page-name', productName: 'product' })
      expect(emissions).toStrictEqual([[existingConfig]])
      subscription.unsubscribe()
    })

    it('should cancel and discard a fallback-page fetch when the header becomes active', () => {
      // The gate is projected inside the switchMap, so when the header becomes active (the guard
      // flips to false) before the in-flight fallback-page fetch responds, the stale request is
      // cancelled and its result discarded — a plain `filter` would have let it store the wrong
      // page's configs.
      const guard = new BehaviorSubject(true)
      const inFlight = new Subject<{ configs: SearchConfigInfo[] }>()
      getSearchConfigInfos.mockReturnValue(inFlight)

      const emissions: SearchConfigInfo[][] = []
      const subscription = loadSearchConfigInfos(
        baseUrl,
        appStateService,
        searchConfigService,
        messageService,
        of('page-name'),
        guard
      ).subscribe((configs) => emissions.push(configs))

      expect(getSearchConfigInfos).toHaveBeenCalledTimes(1)

      guard.next(false)

      inFlight.next({ configs: [existingConfig] })
      inFlight.complete()

      expect(emissions).toStrictEqual([])
      expect(getSearchConfigInfos).toHaveBeenCalledTimes(1)
      subscription.unsubscribe()
    })
  })

  describe('saveSearchConfig', () => {
    it('should open the Save As dialog with the new title, button keys, inputs and width', async () => {
      openDialog.mockReturnValue(of(undefined))

      await lastValueFrom(
        saveSearchConfig(
          portalDialogService,
          searchConfigService,
          messageService,
          appStateService,
          store,
          pageName,
          baseDialogInputs
        )
      )

      expect(openDialog).toHaveBeenCalledTimes(1)
      expect(openDialog).toHaveBeenCalledWith(
        'SEARCH_CONFIG.SAVE_AS_DIALOG.HEADER',
        {
          type: expect.anything(),
          inputs: {
            existingConfigs: [existingConfig],
            appendTo: 'self',
            panelStyleClass: 'panel-class',
            saveInputValues: true,
            saveColumns: true,
            frozeColumnSaveOption: false,
            frozeColumnSaveOptionExplanation: 'EXPLANATION'
          }
        },
        'SEARCH_CONFIG.SAVE_AS_DIALOG.SAVE',
        'SEARCH_CONFIG.SAVE_AS_DIALOG.CANCEL',
        { width: SEARCH_CONFIG_DIALOG_WIDTH }
      )
    })

    it('should create the config for a new name and fire a saved success toast', async () => {
      openDialog.mockReturnValue(
        of({
          button: 'primary',
          result: { searchConfigName: 'new-config', saveInputValues: true, saveColumns: true }
        } as any)
      )
      create.mockReturnValue(of({ id: 'new-id', configs: [createdConfig] }))

      const response = await lastValueFrom(
        saveSearchConfig(
          portalDialogService,
          searchConfigService,
          messageService,
          appStateService,
          store,
          pageName,
          baseDialogInputs
        )
      )

      expect(response).toStrictEqual({ id: 'new-id', configs: [createdConfig], overwritten: false })
      expect(create).toHaveBeenCalledWith({
        appId: 'appId',
        productName: 'product',
        fieldListVersion: 0,
        isReadonly: false,
        page: 'page-name',
        name: 'new-config',
        isAdvanced: true,
        columns: ['col-1'],
        values: { f1: 'v1' }
      })
      expect(update).not.toHaveBeenCalled()
      expect(success).toHaveBeenCalledWith({
        summaryKey: 'SEARCH_CONFIG.SAVE_AS_DIALOG.SAVED',
        summaryParameters: { config: 'new-config' }
      })
      expect(error).not.toHaveBeenCalled()
    })

    it('should create with an empty name and no values or columns when the boxes are unchecked', async () => {
      openDialog.mockReturnValue(
        of({
          button: 'primary',
          result: { searchConfigName: undefined, saveInputValues: false, saveColumns: false }
        } as any)
      )
      create.mockReturnValue(of({ id: 'new-id', configs: [createdConfig] }))

      const response = await lastValueFrom(
        saveSearchConfig(
          portalDialogService,
          searchConfigService,
          messageService,
          appStateService,
          store,
          pageName,
          baseDialogInputs
        )
      )

      expect(response).toStrictEqual({ id: 'new-id', configs: [createdConfig], overwritten: false })
      expect(create).toHaveBeenCalledWith({
        appId: 'appId',
        productName: 'product',
        fieldListVersion: 0,
        isReadonly: false,
        page: 'page-name',
        name: '',
        isAdvanced: false,
        columns: [],
        values: {}
      })
      expect(success).toHaveBeenCalledWith({
        summaryKey: 'SEARCH_CONFIG.SAVE_AS_DIALOG.SAVED',
        summaryParameters: { config: '' }
      })
    })

    it('should save only the criteria when "Save columns" is unchecked for a new name', async () => {
      store = {
        ...store,
        currentPageData$: of({
          fieldValues: undefined,
          viewMode: advancedViewMode,
          displayedColumnsIds: ['col-1'],
          columnGroupKey: undefined
        })
      } as any
      openDialog.mockReturnValue(
        of({
          button: 'primary',
          result: { searchConfigName: 'new-config', saveInputValues: true, saveColumns: false }
        } as any)
      )
      create.mockReturnValue(of({ id: 'new-id', configs: [createdConfig] }))

      await lastValueFrom(
        saveSearchConfig(
          portalDialogService,
          searchConfigService,
          messageService,
          appStateService,
          store,
          pageName,
          baseDialogInputs
        )
      )

      expect(create).toHaveBeenCalledWith({
        appId: 'appId',
        productName: 'product',
        fieldListVersion: 0,
        isReadonly: false,
        page: 'page-name',
        name: 'new-config',
        isAdvanced: true,
        columns: [],
        values: {}
      })
    })

    it('should overwrite an existing non-read-only config matched by trimmed case-insensitive name', async () => {
      openDialog.mockReturnValue(
        of({
          button: 'primary',
          result: { searchConfigName: '  CONFIG-1 ', saveInputValues: true, saveColumns: true }
        } as any)
      )
      update.mockReturnValue(of({ configs: [existingConfig] }))

      const response = await lastValueFrom(
        saveSearchConfig(
          portalDialogService,
          searchConfigService,
          messageService,
          appStateService,
          store,
          pageName,
          baseDialogInputs
        )
      )

      expect(response).toStrictEqual({ id: 'config-id', configs: [existingConfig], overwritten: true })
      expect(update).toHaveBeenCalledWith('config-id', {
        searchConfig: {
          appId: 'appId',
          productName: 'product',
          page: 'page-name',
          modificationCount: 0,
          fieldListVersion: 0,
          id: 'config-id',
          name: 'Config-1',
          columns: ['col-1'],
          values: { f1: 'v1' },
          isReadonly: false,
          isAdvanced: true
        }
      })
      expect(create).not.toHaveBeenCalled()
      expect(success).toHaveBeenCalledWith({
        summaryKey: 'SEARCH_CONFIG.SAVE_AS_DIALOG.OVERRIDDEN',
        summaryParameters: { config: 'Config-1' }
      })
      expect(error).not.toHaveBeenCalled()
    })

    it('should drop the columns from an overwrite when "Save columns" is unchecked and not locked', async () => {
      openDialog.mockReturnValue(
        of({
          button: 'primary',
          result: { searchConfigName: 'Config-1', saveInputValues: true, saveColumns: false }
        } as any)
      )
      update.mockReturnValue(of({ configs: [existingConfig] }))

      await lastValueFrom(
        saveSearchConfig(
          portalDialogService,
          searchConfigService,
          messageService,
          appStateService,
          store,
          pageName,
          baseDialogInputs
        )
      )

      expect(update).toHaveBeenCalledWith('config-id', {
        searchConfig: {
          appId: 'appId',
          productName: 'product',
          page: 'page-name',
          modificationCount: 0,
          fieldListVersion: 0,
          id: 'config-id',
          name: 'Config-1',
          columns: [],
          values: { f1: 'v1' },
          isReadonly: false,
          isAdvanced: true
        }
      })
    })

    it('should keep the stored columns and replace only the criteria when "Save columns" is locked', async () => {
      openDialog.mockReturnValue(
        of({
          button: 'primary',
          result: { searchConfigName: 'Config-1', saveInputValues: true, saveColumns: false }
        } as any)
      )
      update.mockReturnValue(of({ configs: [existingConfig] }))

      await lastValueFrom(
        saveSearchConfig(portalDialogService, searchConfigService, messageService, appStateService, store, pageName, {
          ...baseDialogInputs,
          frozeColumnSaveOption: true
        })
      )

      // The displayed columns are ignored while the option is locked: the stored columns survive.
      expect(update).toHaveBeenCalledWith('config-id', {
        searchConfig: {
          appId: 'appId',
          productName: 'product',
          page: 'page-name',
          modificationCount: 0,
          fieldListVersion: 0,
          id: 'config-id',
          name: 'Config-1',
          columns: ['stored-col'],
          values: { f1: 'v1' },
          isReadonly: false,
          isAdvanced: true
        }
      })
    })

    it('should treat a read-only config as new and create instead of overwriting it', async () => {
      openDialog.mockReturnValue(
        of({
          button: 'primary',
          result: { searchConfigName: 'Locked', saveInputValues: true, saveColumns: true }
        } as any)
      )
      create.mockReturnValue(of({ id: 'new-id', configs: [createdConfig] }))

      const response = await lastValueFrom(
        saveSearchConfig(portalDialogService, searchConfigService, messageService, appStateService, store, pageName, {
          ...baseDialogInputs,
          existingConfigs: [readonlyConfig]
        })
      )

      expect(response).toStrictEqual({ id: 'new-id', configs: [createdConfig], overwritten: false })
      expect(create).toHaveBeenCalledTimes(1)
      expect(update).not.toHaveBeenCalled()
      expect(success).toHaveBeenCalledWith({
        summaryKey: 'SEARCH_CONFIG.SAVE_AS_DIALOG.SAVED',
        summaryParameters: { config: 'Locked' }
      })
    })

    it('should not save a config when the dialog was closed without a result', async () => {
      openDialog.mockReturnValue(of({ button: 'primary', result: undefined } as any))

      const response = await lastValueFrom(
        saveSearchConfig(
          portalDialogService,
          searchConfigService,
          messageService,
          appStateService,
          store,
          pageName,
          baseDialogInputs
        )
      )

      expect(response).toBeUndefined()
      expect(create).not.toHaveBeenCalled()
      expect(update).not.toHaveBeenCalled()
      expect(success).not.toHaveBeenCalled()
    })

    it('should not save a config when the cancel (secondary) button was chosen', async () => {
      openDialog.mockReturnValue(
        of({ button: 'secondary', result: { searchConfigName: 'x', saveInputValues: true, saveColumns: true } } as any)
      )

      const response = await lastValueFrom(
        saveSearchConfig(
          portalDialogService,
          searchConfigService,
          messageService,
          appStateService,
          store,
          pageName,
          baseDialogInputs
        )
      )

      expect(response).toBeUndefined()
      expect(create).not.toHaveBeenCalled()
      expect(update).not.toHaveBeenCalled()
      expect(success).not.toHaveBeenCalled()
    })

    it('should fire the error toast and resolve to undefined when the create fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error')
      const failure = new Error('create-failed')
      openDialog.mockReturnValue(
        of({
          button: 'primary',
          result: { searchConfigName: 'new-config', saveInputValues: true, saveColumns: true }
        } as any)
      )
      create.mockReturnValue(throwError(() => failure))

      const response = await lastValueFrom(
        saveSearchConfig(
          portalDialogService,
          searchConfigService,
          messageService,
          appStateService,
          store,
          pageName,
          baseDialogInputs
        )
      )

      expect(response).toBeUndefined()
      expect(success).not.toHaveBeenCalled()
      expect(error).toHaveBeenCalledWith({ summaryKey: 'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CREATE_FAILURE' })
      expect(consoleSpy).toHaveBeenCalledWith(failure)
      consoleSpy.mockRestore()
    })

    it('should fire the error toast and resolve to undefined when the update fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error')
      const failure = new Error('update-failed')
      openDialog.mockReturnValue(
        of({
          button: 'primary',
          result: { searchConfigName: 'Config-1', saveInputValues: true, saveColumns: true }
        } as any)
      )
      update.mockReturnValue(throwError(() => failure))

      const response = await lastValueFrom(
        saveSearchConfig(
          portalDialogService,
          searchConfigService,
          messageService,
          appStateService,
          store,
          pageName,
          baseDialogInputs
        )
      )

      expect(response).toBeUndefined()
      expect(success).not.toHaveBeenCalled()
      expect(error).toHaveBeenCalledWith({ summaryKey: 'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CREATE_FAILURE' })
      expect(consoleSpy).toHaveBeenCalledWith(failure)
      consoleSpy.mockRestore()
    })
  })
})
