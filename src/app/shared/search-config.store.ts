import { Inject, Injectable, InjectionToken } from '@angular/core'
import { ComponentStore } from '@ngrx/component-store'
import { filter, tap, withLatestFrom } from 'rxjs'

import { Topic } from '@onecx/accelerator'

import { SearchConfigInfo } from 'src/app/shared/generated'
import {
  advancedViewMode,
  advancedViewModeType,
  basicViewMode,
  basicViewModeType,
  columngGroupSelectionStoreName as columnGroupSelectionStoreName,
  searchConfigStoreName
} from './constants'
import {
  areColumnsEqual,
  areValuesEqual,
  hasColumns,
  hasOnlyColumns,
  hasOnlyValues,
  hasValues,
  parseFieldValues
} from './search-config.utils'

export const SEARCH_CONFIG_TOPIC = new InjectionToken<SearchConfigTopic>('searchConfigTopic')

export interface SearchConfigMessage {
  payload: {
    storeName: string
    stateToUpdate: Partial<SearchConfigState>
    wholeState: boolean
  }
}

export class SearchConfigTopic extends Topic<SearchConfigMessage> {
  constructor() {
    super('searchConfig', 1)
  }
}

export type LayoutType = 'table' | 'grid' | 'list'
export type UnparsedFieldValues = { [key: string]: unknown }
export type FieldValues = { [key: string]: string }
export type SearchData = {
  fieldValues: FieldValues | undefined
  viewMode: basicViewModeType | advancedViewModeType | undefined
  displayedColumnsIds: Array<string>
}

export type PageData = SearchData & {
  columnGroupKey: string | undefined
}

interface SearchConfigComponentState {
  currentSearchConfig: SearchConfigInfo | undefined
  selectedGroupKey: string | undefined
  searchConfigs: SearchConfigInfo[]

  pageName: string | undefined
  fieldValues: FieldValues | undefined
  viewMode: basicViewModeType | advancedViewModeType | undefined
}

interface ColumnGroupSelectionComponentState {
  currentSearchConfig: SearchConfigInfo | undefined
  selectedGroupKey: string | undefined
  searchConfigs: SearchConfigInfo[]

  displayedColumnsIds: Array<string>
  layout: LayoutType | undefined
  nonSearchConfigGroupKeys: Array<string>
  customGroupKey: string | undefined
}

export interface SearchConfigState extends SearchConfigComponentState, ColumnGroupSelectionComponentState {
  searchConfigComponentActive: boolean
  displayedSearchData: SearchData | undefined
  columnGroupComponentActive: boolean
}

export interface SearchConfigViewModel {
  searchConfigs: SearchConfigInfo[]
  currentConfig: SearchConfigInfo | undefined
  isColumnGroupComponentActive: boolean
  layout: LayoutType | undefined
}

export interface ColumnSelectionViewModel {
  nonSearchConfigGroupKeys: Array<string>
  customGroupKey: string | undefined

  allGroupKeys: Array<string>
  searchConfigsOnlyColumns: SearchConfigInfo[]
  searchConfigsWithColumns: SearchConfigInfo[]
  selectedGroupKey: string | undefined
  currentConfig: SearchConfigInfo | undefined
  layout: LayoutType | undefined
}

export const SEARCH_CONFIG_STORE_NAME = new InjectionToken<string>('searchConfigStoreName')

export const initialState: SearchConfigState = {
  pageName: undefined,
  nonSearchConfigGroupKeys: [],
  customGroupKey: undefined,

  fieldValues: undefined,
  displayedColumnsIds: [],
  viewMode: undefined,
  layout: undefined,

  searchConfigs: [],
  currentSearchConfig: undefined,
  selectedGroupKey: undefined,

  displayedSearchData: undefined,

  searchConfigComponentActive: false,
  columnGroupComponentActive: false
}

@Injectable()
export class SearchConfigStore extends ComponentStore<SearchConfigState> {
  columnGroupComponentReloading = false

  constructor(
    @Inject(SEARCH_CONFIG_STORE_NAME)
    private readonly storeName: string,
    @Inject(SEARCH_CONFIG_TOPIC)
    private readonly searchConfigTopic$: SearchConfigTopic
  ) {
    super(initialState)
    this.activateStore(storeName)
  }

  // *********** Updaters *********** //

  readonly activateStore = this.updater((state, storeName: string) => {
    let stateToUpdate: Partial<SearchConfigState> = {}
    if (storeName === searchConfigStoreName) {
      stateToUpdate = {
        searchConfigComponentActive: true
      }
    } else if (storeName === columnGroupSelectionStoreName) {
      stateToUpdate = {
        columnGroupComponentActive: true
      }
    }
    this.sendUpdateMessage(stateToUpdate, state)
    return { ...state, ...stateToUpdate }
  })

  readonly deactivateColumnGroupStore = this.updater((state) => {
    return {
      ...state,
      columnGroupComponentActive: false
    }
  })

  readonly setPageName = this.updater((state, newPageName: string) => {
    const stateToUpdate: Partial<SearchConfigState> = {
      pageName: newPageName
    }
    this.sendUpdateMessage(stateToUpdate, state)
    return { ...state, ...stateToUpdate }
  })

  readonly setCustomGroupKey = this.updater((state, customGroupKey: string) => {
    const stateToUpdate: Partial<SearchConfigState> = {
      customGroupKey: customGroupKey
    }
    this.sendUpdateMessage(stateToUpdate, state)
    return { ...state, ...stateToUpdate }
  })

  readonly setSearchConfigs = this.updater((state, searchConfigs: SearchConfigInfo[]) => {
    const stateToUpdate: Partial<SearchConfigState> = {
      searchConfigs: searchConfigs
    }
    this.sendUpdateMessage(stateToUpdate, state)
    return { ...state, ...stateToUpdate }
  })

  readonly setNonSearchConfigGroupKeys = this.updater((state, nonSearchConfigGroupKeys: Array<string>) => {
    const stateToUpdate: Partial<SearchConfigState> = {
      nonSearchConfigGroupKeys: nonSearchConfigGroupKeys
    }

    this.sendUpdateMessage(stateToUpdate, state)
    return { ...state, ...stateToUpdate }
  })

  readonly addSearchConfig = this.updater((state, searchConfig: SearchConfigInfo) => {
    const stateToUpdate: Partial<SearchConfigState> = {
      searchConfigs: state.searchConfigs.concat(searchConfig)
    }
    this.sendUpdateMessage(stateToUpdate, state)
    return { ...state, ...stateToUpdate }
  })

  readonly deleteSearchConfig = this.updater((state, searchConfig: SearchConfigInfo) => {
    const isCurrentSearchConfigDeleted = state.currentSearchConfig?.id === searchConfig.id

    const currentSearchConfig = isCurrentSearchConfigDeleted ? undefined : state.currentSearchConfig

    const selectedGroupKey = this.updateSelectedGroupKeyByConfig(state, currentSearchConfig)

    const stateToUpdate: Partial<SearchConfigState> = {
      ...(isCurrentSearchConfigDeleted && {
        currentSearchConfig: currentSearchConfig
      }),
      ...(isCurrentSearchConfigDeleted && {
        selectedGroupKey: selectedGroupKey
      }),
      searchConfigs: state.searchConfigs.filter((config) => config.id !== searchConfig.id)
    }
    this.sendUpdateMessage(stateToUpdate, state)
    return { ...state, ...stateToUpdate }
  })

  readonly setCurrentConfig = this.updater((state, config: SearchConfigInfo | undefined) => {
    const selectedGroupKey = this.updateSelectedGroupKeyByConfig(state, config)

    const stateToUpdate: Partial<SearchConfigState> = {
      ...(selectedGroupKey !== state.selectedGroupKey && {
        selectedGroupKey: selectedGroupKey
      }),
      currentSearchConfig: config
    }
    this.sendUpdateMessage(stateToUpdate, state)
    return { ...state, ...stateToUpdate }
  })

  readonly setSelectedGroupKey = this.updater((state, selectedGroupKey: string) => {
    const currentConfig = this.updateConfigBySelectedGroupKey(state, selectedGroupKey)

    const stateToUpdate: Partial<SearchConfigState> = {
      ...(currentConfig !== state.currentSearchConfig && {
        currentSearchConfig: currentConfig
      }),
      selectedGroupKey: selectedGroupKey
    }
    this.sendUpdateMessage(stateToUpdate, state)
    return { ...state, ...stateToUpdate }
  })

  readonly updateFieldValues = this.updater((state, values: UnparsedFieldValues) => {
    const parsedValues = parseFieldValues(values ?? {})
    if (areValuesEqual(parsedValues, state.fieldValues ?? {})) {
      return { ...state }
    }

    const searchConfig = this.isCurrentConfigOutdated(state, {
      fieldValues: parsedValues
    })
      ? undefined
      : state.currentSearchConfig

    const selectedGroupKey = this.updateSelectedGroupKeyByConfig(state, searchConfig)

    const stateToUpdate: Partial<SearchConfigState> = {
      ...(searchConfig !== state.currentSearchConfig && {
        currentSearchConfig: searchConfig
      }),
      ...(selectedGroupKey !== state.selectedGroupKey && {
        selectedGroupKey: selectedGroupKey
      }),
      fieldValues: parsedValues,
      displayedSearchData: {
        fieldValues: parsedValues,
        displayedColumnsIds: state.displayedSearchData?.displayedColumnsIds ?? [],
        viewMode: state.displayedSearchData?.viewMode
      }
    }
    this.sendUpdateMessage(stateToUpdate, state)
    return { ...state, ...stateToUpdate }
  })

  readonly updateDisplayedColumnsIds = this.updater((state, displayedColumnsIds: string[]) => {
    if (areColumnsEqual(displayedColumnsIds, state.displayedColumnsIds)) {
      return { ...state }
    }

    const searchConfig = this.isCurrentConfigOutdated(state, {
      displayedColumIds: displayedColumnsIds
    })
      ? undefined
      : state.currentSearchConfig

    const selectedGroupKey = this.updateSelectedGroupKeyByConfig(state, searchConfig)

    const stateToUpdate: Partial<SearchConfigState> = {
      ...(searchConfig !== state.currentSearchConfig && {
        currentSearchConfig: searchConfig
      }),
      ...(selectedGroupKey !== state.selectedGroupKey && {
        selectedGroupKey: selectedGroupKey
      }),
      displayedColumnsIds: displayedColumnsIds,
      displayedSearchData: {
        fieldValues: state.displayedSearchData?.fieldValues,
        displayedColumnsIds: displayedColumnsIds,
        viewMode: state.displayedSearchData?.viewMode
      }
    }
    this.sendUpdateMessage(stateToUpdate, state)
    return { ...state, ...stateToUpdate }
  })

  readonly updateViewMode = this.updater((state, viewMode: basicViewModeType | advancedViewModeType) => {
    if (viewMode === state.viewMode) {
      return { ...state }
    }

    const searchConfig = this.isCurrentConfigOutdated(state, {
      viewMode: viewMode
    })
      ? undefined
      : state.currentSearchConfig

    const selectedGroupKey = this.updateSelectedGroupKeyByConfig(state, searchConfig)

    const stateToUpdate: Partial<SearchConfigState> = {
      ...(searchConfig !== state.currentSearchConfig && {
        currentSearchConfig: searchConfig
      }),
      ...(selectedGroupKey !== state.selectedGroupKey && {
        selectedGroupKey: selectedGroupKey
      }),
      viewMode: viewMode,
      displayedSearchData: {
        fieldValues: state.displayedSearchData?.fieldValues,
        displayedColumnsIds: state.displayedSearchData?.displayedColumnsIds ?? [],
        viewMode: viewMode
      }
    }
    this.sendUpdateMessage(stateToUpdate, state)
    return { ...state, ...stateToUpdate }
  })

  readonly updateLayout = this.updater((state, layout: 'table' | 'grid' | 'list') => {
    if (layout === state.layout) {
      return { ...state }
    }

    const stateToUpdate: Partial<SearchConfigState> = {
      layout: layout
    }
    this.sendUpdateMessage(stateToUpdate, state)
    return { ...state, ...stateToUpdate }
  })

  // *********** Selectors *********** //

  readonly isSearchConfigComponentActive$ = this.select(
    ({ searchConfigComponentActive }): boolean => searchConfigComponentActive
  )

  readonly isColumnGroupComponentActive$ = this.select(
    ({ columnGroupComponentActive }): boolean => columnGroupComponentActive
  )

  readonly pageName$ = this.select(this.state$, (state) => state.pageName).pipe(filter(this.isNotUndefined))

  readonly selectedGroupKey$ = this.select(({ selectedGroupKey }) => selectedGroupKey).pipe(filter(this.isNotUndefined))

  readonly currentConfig$ = this.select(({ currentSearchConfig }): SearchConfigInfo | undefined => currentSearchConfig)

  readonly currentPageData$ = this.select(this.state$, (state): PageData => ({
    fieldValues: state.fieldValues,
    viewMode: state.viewMode,
    displayedColumnsIds: state.displayedColumnsIds,
    columnGroupKey: state.selectedGroupKey
  }))

  readonly currentDisplayedData$ = this.select(({ displayedSearchData }) => displayedSearchData).pipe(
    filter(this.isNotUndefined)
  )

  readonly searchConfigVm$ = this.select(
    this.state$,
    this.currentConfig$,
    (state, currentConfig): SearchConfigViewModel => ({
      searchConfigs: state.searchConfigs.filter((config) => hasValues(config)),
      currentConfig: currentConfig,
      isColumnGroupComponentActive: state.columnGroupComponentActive,
      layout: state.layout
    })
  )

  readonly columnSelectionVm$ = this.select(
    this.state$,
    this.currentConfig$,
    (state, currentConfig): ColumnSelectionViewModel => {
      const searchConfigsOnlyColumns = state.searchConfigs.filter((config) => hasOnlyColumns(config))
      return {
        searchConfigsOnlyColumns: searchConfigsOnlyColumns,
        searchConfigsWithColumns: state.searchConfigs.filter((config) => hasColumns(config)),
        nonSearchConfigGroupKeys: state.nonSearchConfigGroupKeys,
        allGroupKeys: state.nonSearchConfigGroupKeys
          .concat(
            searchConfigsOnlyColumns.map((config) => config.name),
            state.selectedGroupKey === undefined ? [] : [state.selectedGroupKey]
          )
          .filter((value, index, self) => self.indexOf(value) === index && value != null),
        selectedGroupKey: state.selectedGroupKey,
        currentConfig: currentConfig,
        customGroupKey: state.customGroupKey,
        layout: state.layout
      }
    }
  )

  // *********** Effects *********** //

  private readonly storeUpdate = this.effect(() => {
    return this.searchConfigTopic$.pipe(
      filter((msg) => msg !== undefined),
      filter((msg) => msg.payload.storeName !== this.storeName),
      withLatestFrom(this.state$),
      tap(([msg, state]) => {
        if (msg.payload.storeName === columnGroupSelectionStoreName && msg.payload.wholeState) {
          const displayedSearchData = {
            ...(state.displayedSearchData && {
              fieldValues: state.displayedSearchData.fieldValues,
              viewMode: state.displayedSearchData.viewMode
            }),
            ...(msg.payload.stateToUpdate.displayedSearchData && {
              displayedColumnsIds: msg.payload.stateToUpdate.displayedSearchData.displayedColumnsIds
            })
          }
          this.patchState({
            ...state,
            columnGroupComponentActive: true,
            selectedGroupKey: msg.payload.stateToUpdate.selectedGroupKey,
            customGroupKey: msg.payload.stateToUpdate.customGroupKey,
            displayedColumnsIds: msg.payload.stateToUpdate.displayedColumnsIds,
            layout: msg.payload.stateToUpdate.layout,
            nonSearchConfigGroupKeys: msg.payload.stateToUpdate.nonSearchConfigGroupKeys,
            displayedSearchData:
              Object.keys(displayedSearchData).length === 0
                ? undefined
                : {
                    fieldValues: displayedSearchData.fieldValues,
                    viewMode: displayedSearchData.viewMode,
                    displayedColumnsIds: displayedSearchData.displayedColumnsIds ?? []
                  }
          })
          return
        }
        if (msg.payload.storeName === searchConfigStoreName && msg.payload.wholeState) {
          const displayedSearchData = {
            ...(state.displayedSearchData && {
              displayedColumnsIds: state.displayedSearchData.displayedColumnsIds
            }),
            ...(msg.payload.stateToUpdate.displayedSearchData && {
              fieldValues: msg.payload.stateToUpdate.displayedSearchData.fieldValues,
              viewMode: msg.payload.stateToUpdate.displayedSearchData.viewMode
            })
          }
          this.patchState({
            ...state,
            searchConfigComponentActive: true,
            pageName: msg.payload.stateToUpdate.pageName,
            fieldValues: msg.payload.stateToUpdate.fieldValues,
            viewMode: msg.payload.stateToUpdate.viewMode,
            searchConfigs: msg.payload.stateToUpdate.searchConfigs,
            currentSearchConfig: msg.payload.stateToUpdate.currentSearchConfig,
            displayedSearchData:
              Object.keys(displayedSearchData).length === 0
                ? undefined
                : {
                    fieldValues: displayedSearchData.fieldValues,
                    viewMode: displayedSearchData.viewMode,
                    displayedColumnsIds: displayedSearchData.displayedColumnsIds ?? []
                  }
          })
          return
        }
        this.patchState({
          ...state,
          ...msg.payload.stateToUpdate,
          selectedGroupKey:
            (msg.payload.stateToUpdate.selectedGroupKey ?? '') !== ''
              ? msg.payload.stateToUpdate.selectedGroupKey
              : state.selectedGroupKey,
          columnGroupComponentActive:
            msg.payload.storeName === columnGroupSelectionStoreName ? true : state.columnGroupComponentActive,
          searchConfigComponentActive:
            msg.payload.storeName === searchConfigStoreName ? true : state.searchConfigComponentActive
        })
      })
    )
  })

  // *********** Utilities *********** //

  sendUpdateMessage(stateToUpdate: Partial<SearchConfigState>, state: SearchConfigState) {
    let wholeState = false
    if (this.storeName === searchConfigStoreName && !state.columnGroupComponentActive) {
      stateToUpdate = {
        ...state,
        ...stateToUpdate
      }
      wholeState = true
    }
    if (this.storeName === columnGroupSelectionStoreName && !state.searchConfigComponentActive) {
      stateToUpdate = {
        ...state,
        ...stateToUpdate
      }
      wholeState = true
    }
    this.searchConfigTopic$
      .publish({
        payload: {
          storeName: this.storeName,
          stateToUpdate: stateToUpdate,
          wholeState: wholeState
        }
      })
      .catch((err) => console.error(err))
  }

  private isCurrentConfigOutdated(
    state: SearchConfigState,
    change: {
      fieldValues?: FieldValues
      viewMode?: basicViewModeType | advancedViewModeType
      displayedColumIds?: Array<string>
      layout?: 'table' | 'grid' | 'list'
    }
  ) {
    if (state.currentSearchConfig === undefined) return true

    if (
      hasColumns(state.currentSearchConfig) &&
      change.displayedColumIds &&
      !areColumnsEqual(state.currentSearchConfig.columns, change.displayedColumIds) &&
      // treat values and columns config as solumns only when column group component is not active
      state.columnGroupComponentActive
    )
      return true

    if (
      hasValues(state.currentSearchConfig) &&
      change.fieldValues &&
      !areValuesEqual(state.currentSearchConfig.values, change.fieldValues)
    ) {
      return true
    }

    if (
      hasValues(state.currentSearchConfig) &&
      change.viewMode &&
      (state.currentSearchConfig.isAdvanced ? advancedViewMode : basicViewMode) !== change.viewMode
    )
      return true

    return false
  }

  /**
   * update selectedGroupKey using new config
   */
  private updateSelectedGroupKeyByConfig(state: SearchConfigState, config: SearchConfigInfo | undefined) {
    if (!state.columnGroupComponentActive) return state.selectedGroupKey

    if (config && config.name === state.selectedGroupKey) return state.selectedGroupKey

    if (config && hasColumns(config)) return config.name

    const searchConfigForSelectedKey = state.searchConfigs.find((c) => c.name === state.selectedGroupKey)

    if (config && hasValues(config) && searchConfigForSelectedKey) {
      return state.customGroupKey
    }

    if (config === undefined && searchConfigForSelectedKey && !hasOnlyValues(searchConfigForSelectedKey)) {
      return state.customGroupKey
    }
    return state.selectedGroupKey
  }

  /**
   * update currentSearchConfig using new selectedGroupKey
   */
  private updateConfigBySelectedGroupKey(
    state: SearchConfigState,
    selectedGroupKey: string
  ): SearchConfigInfo | undefined {
    if (!state.searchConfigComponentActive) return state.currentSearchConfig

    const searchConfigForSelectedKey = state.searchConfigs.some((c) => c.name === state.selectedGroupKey)

    if (
      searchConfigForSelectedKey &&
      (state.nonSearchConfigGroupKeys.includes(selectedGroupKey) || selectedGroupKey === state.customGroupKey)
    ) {
      return undefined
    }

    if (
      !state.nonSearchConfigGroupKeys
        .concat(state.customGroupKey ? [state.customGroupKey] : [])
        .includes(selectedGroupKey)
    ) {
      return state.searchConfigs.find((c) => c.name === selectedGroupKey)
    }

    return state.currentSearchConfig
  }

  private isNotUndefined<T>(val: T | undefined): val is T {
    return val !== undefined
  }
}
