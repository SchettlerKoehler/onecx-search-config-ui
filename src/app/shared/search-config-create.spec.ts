import { BehaviorSubject, lastValueFrom, of, throwError } from 'rxjs'

import { PortalDialogService } from '@onecx/angular-accelerator'
import { AppStateService, PortalMessageService } from '@onecx/angular-integration-interface'

import { SearchConfigAPIService, SearchConfigInfo } from 'src/app/shared/generated'
import { advancedViewMode } from './constants'
import { createSearchConfig, loadSearchConfigInfos, resolveStandalonePageName } from './search-config-create'
import { SearchConfigStore } from './search-config.store'

describe('search-config-create', () => {
  const testConfig: SearchConfigInfo = {
    id: 'config-id',
    name: 'config-1',
    columns: ['col-1'],
    values: {
      k1: 'v1'
    },
    isReadonly: false,
    isAdvanced: false
  }

  let portalDialogService: PortalDialogService
  let searchConfigService: SearchConfigAPIService
  let messageService: PortalMessageService
  let appStateService: AppStateService
  let store: SearchConfigStore

  const openDialog = jest.fn()
  const getSearchConfigInfos = jest.fn()
  const create = jest.fn()
  const info = jest.fn()
  const error = jest.fn()

  beforeEach(() => {
    openDialog.mockReset()
    getSearchConfigInfos.mockReset()
    create.mockReset()
    info.mockReset()
    error.mockReset()

    portalDialogService = { openDialog } as unknown as PortalDialogService
    searchConfigService = { getSearchConfigInfos, createSearchConfig: create } as unknown as SearchConfigAPIService
    messageService = { info, error } as unknown as PortalMessageService
    appStateService = {
      currentMfe$: {
        asObservable: () => of({ appId: 'appId', productName: 'product' } as any)
      }
    } as any
    store = {
      state$: new BehaviorSubject({ pageName: undefined } as any),
      ensureStandalonePageName: jest.fn(),
      pageName$: of('page-name'),
      currentPageData$: of({
        fieldValues: { f1: 'v1' },
        viewMode: advancedViewMode,
        displayedColumnsIds: ['col-1'],
        columnGroupKey: undefined
      })
    } as unknown as SearchConfigStore
  })

  describe('resolveStandalonePageName', () => {
    it('should return the store page name when it is already set', async () => {
      store = { ...store, state$: new BehaviorSubject({ pageName: 'header-page' } as any) } as any

      const page = await lastValueFrom(resolveStandalonePageName(store, 'fallback'))

      expect(page).toBe('header-page')
      expect(store.ensureStandalonePageName).not.toHaveBeenCalled()
    })

    it('should apply and return the fallback while the store page name is undefined', async () => {
      const ensureStandalonePageName = jest.fn()
      store = { ...store, ensureStandalonePageName } as any

      const page = await lastValueFrom(resolveStandalonePageName(store, 'fallback'))

      expect(page).toBe('fallback')
      expect(ensureStandalonePageName).toHaveBeenCalledWith('fallback')
    })
  })

  describe('loadSearchConfigInfos', () => {
    const baseUrl = of({} as any)

    it('should fetch the configs and emit them once all inputs are available', async () => {
      getSearchConfigInfos.mockReturnValue(of({ configs: [testConfig] }))

      const configs = await lastValueFrom(
        loadSearchConfigInfos(baseUrl, appStateService, searchConfigService, messageService, of('page-name'))
      )

      expect(configs).toStrictEqual([testConfig])
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

    it('should not fetch while the load guard is false', () => {
      const guard = new BehaviorSubject(false)
      getSearchConfigInfos.mockReturnValue(of({ configs: [testConfig] }))

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

    it('should fetch once the load guard flips to true', () => {
      const guard = new BehaviorSubject(false)
      getSearchConfigInfos.mockReturnValue(of({ configs: [testConfig] }))

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
      expect(emissions).toStrictEqual([[testConfig]])
      subscription.unsubscribe()
    })
  })

  describe('createSearchConfig', () => {
    const dialogInputs = {
      searchConfigName: '',
      saveInputValues: true,
      saveColumns: true,
      frozeColumnSaveOption: false,
      frozeColumnSaveOptionExplanation: 'EXPLANATION'
    }

    it('should open the create dialog with the resolved inputs', async () => {
      openDialog.mockReturnValue(of(undefined))

      await lastValueFrom(
        createSearchConfig(
          portalDialogService,
          searchConfigService,
          messageService,
          appStateService,
          store,
          of('page-name'),
          dialogInputs
        )
      )

      expect(openDialog).toHaveBeenCalledTimes(1)
      expect(openDialog).toHaveBeenCalledWith(
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CREATE_HEADER',
        {
          type: expect.anything(),
          inputs: dialogInputs
        },
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CONFIRM',
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CANCEL'
      )
    })

    it('should build and send the create request when the dialog is confirmed', async () => {
      const result = { searchConfigName: 'new-config', saveInputValues: true, saveColumns: true }
      openDialog.mockReturnValue(of({ button: 'primary', result } as any))
      create.mockReturnValue(of({ id: testConfig.id, configs: [testConfig] }))

      const response = await lastValueFrom(
        createSearchConfig(
          portalDialogService,
          searchConfigService,
          messageService,
          appStateService,
          store,
          of('page-name'),
          {
            ...dialogInputs,
            frozeColumnSaveOptionExplanation: undefined
          }
        )
      )

      expect(response).toStrictEqual({ id: testConfig.id, configs: [testConfig] })
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
      expect(error).not.toHaveBeenCalled()
    })

    it('should fall back to an empty name and no values when they are absent', async () => {
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
          result: { searchConfigName: undefined, saveInputValues: true, saveColumns: false }
        } as any)
      )
      create.mockReturnValue(of({ id: testConfig.id, configs: [testConfig] }))

      const response = await lastValueFrom(
        createSearchConfig(
          portalDialogService,
          searchConfigService,
          messageService,
          appStateService,
          store,
          of('page-name'),
          dialogInputs
        )
      )

      expect(response).toStrictEqual({ id: testConfig.id, configs: [testConfig] })
      expect(create).toHaveBeenCalledWith({
        appId: 'appId',
        productName: 'product',
        fieldListVersion: 0,
        isReadonly: false,
        page: 'page-name',
        name: '',
        isAdvanced: true,
        columns: [],
        values: {}
      })
    })

    it('should not create a config when the dialog was closed without a result', async () => {
      openDialog.mockReturnValue(of({ button: 'primary', result: undefined } as any))

      const response = await lastValueFrom(
        createSearchConfig(
          portalDialogService,
          searchConfigService,
          messageService,
          appStateService,
          store,
          of('page-name'),
          dialogInputs
        )
      )

      expect(response).toBeUndefined()
      expect(create).not.toHaveBeenCalled()
    })

    it('should not create a config when the cancel (secondary) button was chosen', async () => {
      openDialog.mockReturnValue(of({ button: 'secondary', result: { searchConfigName: 'x' } } as any))

      const response = await lastValueFrom(
        createSearchConfig(
          portalDialogService,
          searchConfigService,
          messageService,
          appStateService,
          store,
          of('page-name'),
          dialogInputs
        )
      )

      expect(response).toBeUndefined()
      expect(create).not.toHaveBeenCalled()
    })

    it('should fire an error toast and resolve to undefined when the create fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error')
      const failure = new Error('create-failed')
      const result = { searchConfigName: 'new-config', saveInputValues: false, saveColumns: false }
      openDialog.mockReturnValue(of({ button: 'primary', result } as any))
      create.mockReturnValue(throwError(() => failure))

      const response = await lastValueFrom(
        createSearchConfig(
          portalDialogService,
          searchConfigService,
          messageService,
          appStateService,
          store,
          of('page-name'),
          dialogInputs
        )
      )

      expect(response).toBeUndefined()
      expect(error).toHaveBeenCalledWith({ summaryKey: 'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CREATE_FAILURE' })
      expect(consoleSpy).toHaveBeenCalledWith(failure)
      consoleSpy.mockRestore()
    })
  })
})
