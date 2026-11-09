import { Inject, Injectable, InjectionToken } from '@angular/core'
import { ComponentStore } from '@ngrx/component-store'
import { filter, tap, withLatestFrom } from 'rxjs'

import { Topic } from '@onecx/accelerator'

import { SearchConfigInfo } from 'src/app/shared/generated'
import {
  advancedViewModeType,
  basicViewModeType,
  columngGroupSelectionStoreName as columnGroupSelectionStoreName,
  searchConfigStoreName
} from './constants'
import {
  areColumnsEqual,
  areValuesEqual,
  hasColumns,
  hasOnlyValues,
  hasValues,
  isSearchConfigModified,
  parseFieldValues,
  SearchConfigPageData
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
  /** True when the current config is retained but a stored aspect no longer matches the page. */
  currentConfigModified: boolean
  isColumnGroupComponentActive: boolean
  layout: LayoutType | undefined
}

/**
 * A leaf in the grouped column-group config select: a host predefined column group (`isPredefined`)
 * or a saved config that stores columns (carrying its `config`). Predefined leaves carry the
 * `isPredefined` flag so the template and the keyboard delete path can tell them apart from saved
 * leaves even when a predefined key equals a saved config's name.
 */
export interface ColumnGroupSelectOption {
  label: string
  value: string
  isPredefined?: boolean
  config?: SearchConfigInfo
}

export interface ColumnSelectionViewModel {
  nonSearchConfigGroupKeys: Array<string>
  customGroupKey: string | undefined

  searchConfigsWithColumns: SearchConfigInfo[]
  selectedGroupKey: string | undefined
  /**
   * True when the saved config the select points at (`selectedGroupKey`) is retained but a stored
   * aspect no longer matches the page — the config the `*` marker and the "Modified" tooltip in the
   * column-group select refer to. This is the select's selection, not the header's current config:
   * when the two differ (the "Sales" criteria + a "Wide" column group example) the header marks the
   * retained current config while the column-group select marks the selected one.
   */
  selectedConfigModified: boolean
  /** The grouped options for the config select, with each saved config attached to its leaf. */
  options: Array<{ label: string; value: string; items: ColumnGroupSelectOption[] }>
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

  // Save As lands here: a new name adds a config, an existing (overwritten) name replaces the stored
  // content in place (by id). The response configs always carry the saved config, so a full replace
  // (dropping the aspects that were not checked this time) is reflected in the list for every input.
  readonly upsertSearchConfig = this.updater((state, searchConfig: SearchConfigInfo) => {
    const exists = state.searchConfigs.some((config) => config.id === searchConfig.id)
    const searchConfigs = exists
      ? state.searchConfigs.map((config) => (config.id === searchConfig.id ? searchConfig : config))
      : state.searchConfigs.concat(searchConfig)

    const stateToUpdate: Partial<SearchConfigState> = {
      searchConfigs
    }
    this.sendUpdateMessage(stateToUpdate, state)
    return { ...state, ...stateToUpdate }
  })

  readonly deleteSearchConfig = this.updater((state, searchConfig: SearchConfigInfo) => {
    const isCurrentSearchConfigDeleted = state.currentSearchConfig?.id === searchConfig.id
    // Standalone (column-group) use: the select shows `selectedGroupKey` directly. When it points at the
    // deleted saved config, the selection is dropped too and falls back to the host custom group.
    const isSelectedGroupDeleted = state.selectedGroupKey === searchConfig.name

    const currentSearchConfig = isCurrentSearchConfigDeleted ? undefined : state.currentSearchConfig
    const selectedGroupKey = isSelectedGroupDeleted ? state.customGroupKey : state.selectedGroupKey

    const stateToUpdate: Partial<SearchConfigState> = {
      ...(isCurrentSearchConfigDeleted && {
        currentSearchConfig: currentSearchConfig
      }),
      ...(isSelectedGroupDeleted && {
        selectedGroupKey
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

    // A page state change never re-points the column-group selection at the retained config: the
    // selection is driven by an explicit selection change, so `selectedGroupKey` is left untouched
    // (re-syncing it would snap the select back to the config's own column group). The current config
    // is retained even when its stored aspects no longer match the page — the mismatch surfaces as a
    // derived `modified` flag (see `isSearchConfigModified`), not a deselection.
    const stateToUpdate: Partial<SearchConfigState> = {
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

    const stateToUpdate: Partial<SearchConfigState> = {
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

    const stateToUpdate: Partial<SearchConfigState> = {
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
      currentConfigModified: isSearchConfigModified(currentConfig, this.pageDataFor(state)),
      isColumnGroupComponentActive: state.columnGroupComponentActive,
      layout: state.layout
    })
  )

  // Grouped options for the column-group config select, built here so the template binds them and the
  // leaf carries its saved `config` (no name-based lookup in the row). Predefined leaves are marked
  // `isPredefined` so they are never confused with a saved config of the same name.
  //
  // The group and predefined-leaf labels are emitted as raw i18n keys (the saved-leaf labels are the
  // config's own `name`); the consuming remote translates them reactively so a language switch is
  // reflected without any store round-trip.
  readonly columnSelectionVm$ = this.select(this.state$, (state): ColumnSelectionViewModel => {
    const searchConfigsWithColumns = state.searchConfigs.filter((config) => hasColumns(config))
    const pageData = this.pageDataFor(state)
    // The config the select points at (`selectedGroupKey`), not the header's current config: when the
    // two differ the column-group select marks the selection it shows, the header marks the retained
    // current config. The lookup is by name, so a predefined (or custom) key whose name collides with
    // a saved config's name resolves to the saved config — a pre-existing ambiguity, because the name
    // alone cannot tell the two apart here. That leaves the marker unresolved rather than wrong: both
    // the option row and the collapsed label guard it with `isPredefined`, so the predefined leaf is
    // never marked. In the collapsed label PrimeNG resolves the selected option with `findIndex` over
    // the visible options, so the first matching leaf (the predefined one) wins, and a saved config
    // whose name equals a predefined key is never marked there. Predefined/custom keys that match no
    // saved config resolve to no config and are therefore never modified.
    const selectedConfig = searchConfigsWithColumns.find((config) => config.name === state.selectedGroupKey)
    return {
      searchConfigsWithColumns: searchConfigsWithColumns,
      nonSearchConfigGroupKeys: state.nonSearchConfigGroupKeys,
      selectedGroupKey: state.selectedGroupKey,
      customGroupKey: state.customGroupKey,
      selectedConfigModified: isSearchConfigModified(selectedConfig, pageData),
      options: [
        {
          label: 'COLUMN_GROUP_SELECTION.GROUPS.PREDEFINED',
          value: 'predefined',
          items: state.nonSearchConfigGroupKeys.map((key) => ({
            label: key,
            value: key,
            isPredefined: true
          }))
        },
        {
          label: 'COLUMN_GROUP_SELECTION.GROUPS.SAVED',
          value: 'saved',
          items: searchConfigsWithColumns.map((config) => ({
            label: config.name,
            value: config.name,
            config
          }))
        }
      ]
    }
  })

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

  // Each page aspect is only judged while its owning remote reports it: the criteria while the
  // header remote is active, the columns while the column-group remote is active — so a
  // single-remote deployment is not reported modified by aspects it does not track.
  private pageDataFor(state: SearchConfigState): SearchConfigPageData {
    return {
      fieldValues: state.searchConfigComponentActive ? state.fieldValues : undefined,
      viewMode: state.searchConfigComponentActive ? state.viewMode : undefined,
      displayedColumnsIds: state.columnGroupComponentActive ? state.displayedColumnsIds : undefined
    }
  }

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
   *
   * The header's current config is retained whenever the new key is a host predefined/custom column
   * group (those never change the header criteria config — they only affect the column-group
   * selection) or selects a saved config that stores no values (columns-only picks keep the header
   * criteria config, surfacing as a derived `modified` flag). Adopting a saved config that stores
   * values replaces the current config.
   */
  private updateConfigBySelectedGroupKey(
    state: SearchConfigState,
    selectedGroupKey: string
  ): SearchConfigInfo | undefined {
    if (
      !state.searchConfigComponentActive ||
      state.nonSearchConfigGroupKeys.includes(selectedGroupKey) ||
      selectedGroupKey === state.customGroupKey
    ) {
      return state.currentSearchConfig
    }

    const picked = state.searchConfigs.find((c) => c.name === selectedGroupKey)
    return picked && hasValues(picked) ? picked : state.currentSearchConfig
  }

  private isNotUndefined<T>(val: T | undefined): val is T {
    return val !== undefined
  }
}
