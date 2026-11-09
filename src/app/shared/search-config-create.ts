import { EMPTY, Observable, catchError, combineLatest, map, of, switchMap, withLatestFrom } from 'rxjs'

import { PortalDialogService } from '@onecx/angular-accelerator'
import { AppStateService, PortalMessageService } from '@onecx/angular-integration-interface'
import { RemoteComponentConfig } from '@onecx/angular-utils'

import {
  CreateSearchConfigRequest,
  SearchConfigAPIService,
  SearchConfigInfo,
  UpdateSearchConfigRequest
} from 'src/app/shared/generated'
import { SearchConfigStore } from 'src/app/shared/search-config.store'
import {
  CreateOrEditSearchConfigDialogComponent,
  CreateOrEditSearchDialogContent
} from 'src/app/shared/components/create-or-edit-search-config-dialog/create-or-edit-search-config-dialog.component'
import { advancedViewMode, SEARCH_CONFIG_DIALOG_WIDTH } from 'src/app/shared/constants'
import { parseFieldValues } from 'src/app/shared/search-config.utils'

/**
 * Fetches the saved configs once the remote base url, the page name and the current MFE are all known,
 * then emits the response configs. A failed request fires an error toast and emits no configs. The
 * caller stores the result (`store.setSearchConfigs`).
 *
 * `pageName` is the page-name observable for the caller: the search header remote passes the store's
 * `pageName$` (so it loads only once a page name is provided), while the column-group remote passes a
 * live selector over the store (`pageName ?? applicationPath`), so it loads in standalone use with a
 * fallback page name that a header-provided page name replaces the moment it arrives — without ever
 * writing the fallback into the shared store.
 *
 * `shouldLoad` optionally gates the load from inside the `switchMap`: the column-group remote passes
 * `!isSearchConfigComponentActive$` so the GET is skipped (and any in-flight request cancelled) as soon
 * as the search header remote becomes active. Because the gate is projected rather than filtered in
 * front of the `switchMap`, a stale request started while the gate was open is cancelled and its result
 * discarded — a plain `filter` neither cancels the request nor drops the response, which let the column
 * remote's fallback-page GET race the header's and, on last-write-wins, store the wrong page's configs.
 */
export function loadSearchConfigInfos(
  baseUrl: Observable<RemoteComponentConfig>,
  appStateService: AppStateService,
  searchConfigService: SearchConfigAPIService,
  portalMessageService: PortalMessageService,
  pageName: Observable<string>,
  shouldLoad?: Observable<boolean>
): Observable<SearchConfigInfo[]> {
  const gate$ = shouldLoad ?? of(true)
  return combineLatest([baseUrl, appStateService.currentMfe$.asObservable(), pageName, gate$]).pipe(
    switchMap(([, currentMfe, page, load]) => {
      if (!load) {
        return EMPTY
      }
      return searchConfigService
        .getSearchConfigInfos({
          appId: currentMfe.appId,
          page,
          productName: currentMfe.productName
        })
        .pipe(
          map((response) => response.configs),
          catchError((error) => {
            console.error(error)
            portalMessageService.error({
              summaryKey: 'SEARCH_CONFIG.LOAD_FAILURE'
            })
            return of([] as SearchConfigInfo[])
          })
        )
    })
  )
}

/** The save outcome the remotes consume: the saved config's id, the response configs, and whether an
 * existing config was overwritten (a new name is a create). */
export type SaveSearchConfigResult = {
  id: string
  configs: SearchConfigInfo[]
  overwritten: boolean
}

/**
 * Opens the reusable Save As dialog and, when it confirms (`button === 'primary'` with a result),
 * creates the config for a new name or overwrites the matched existing (non-read-only) config. The
 * matched config is resolved here against `dialogInputs.existingConfigs` (trimmed, case-insensitive),
 * so the helper and the dialog's inline warning agree on the overwrite target without the dialog having
 * to carry the id through its result. A failed create or update fires the shared error toast and
 * resolves to `undefined`; the success toast (`saved` / `overwritten`, `success` severity) is fired
 * here per path.
 *
 * Overwrite semantics: the saved aspects fully replace the stored content. The single exception is when
 * "Save columns" is locked (`frozeColumnSaveOption`): the stored columns are kept (the box is forced
 * off, so they can never be re-checked) and only the search criteria are replaced.
 *
 * `pageName` is the resolved page-name observable (the store's `pageName$` for the header, or the
 * column-group remote's live `pageName ?? applicationPath` selector for standalone use) and is applied
 * to the request. Combining the confirmed dialog result with the current MFE, page data and page name
 * via `withLatestFrom` means a confirmed dialog is never dropped: the confirmed dialog result is what
 * drives the single emission, and the live selector always has a value, so a page name is present in the
 * standalone case too.
 */
export function saveSearchConfig(
  portalDialogService: PortalDialogService,
  searchConfigService: SearchConfigAPIService,
  portalMessageService: PortalMessageService,
  appStateService: AppStateService,
  store: SearchConfigStore,
  pageName: Observable<string>,
  dialogInputs: {
    existingConfigs: SearchConfigInfo[]
    appendTo?: 'body' | 'self' | HTMLElement | null
    panelStyleClass?: string
    saveInputValues: boolean
    saveColumns: boolean
    frozeColumnSaveOption: boolean
    frozeColumnSaveOptionExplanation?: string
  }
): Observable<SaveSearchConfigResult | undefined> {
  return portalDialogService
    .openDialog<CreateOrEditSearchDialogContent>(
      'SEARCH_CONFIG.SAVE_AS_DIALOG.HEADER',
      {
        type: CreateOrEditSearchConfigDialogComponent,
        inputs: {
          existingConfigs: dialogInputs.existingConfigs,
          appendTo: dialogInputs.appendTo,
          panelStyleClass: dialogInputs.panelStyleClass,
          saveInputValues: dialogInputs.saveInputValues,
          saveColumns: dialogInputs.saveColumns,
          frozeColumnSaveOption: dialogInputs.frozeColumnSaveOption,
          frozeColumnSaveOptionExplanation: dialogInputs.frozeColumnSaveOptionExplanation
        }
      },
      'SEARCH_CONFIG.SAVE_AS_DIALOG.SAVE',
      'SEARCH_CONFIG.SAVE_AS_DIALOG.CANCEL',
      { width: SEARCH_CONFIG_DIALOG_WIDTH }
    )
    .pipe(
      withLatestFrom(appStateService.currentMfe$.asObservable(), store.currentPageData$, pageName),
      switchMap(([dialogResult, currentMfe, pageData, page]) => {
        const result = dialogResult?.result
        if (!result || dialogResult.button !== 'primary') {
          return of(undefined as SaveSearchConfigResult | undefined)
        }
        const typedName = (result.searchConfigName ?? '').trim().toLowerCase()
        const existingConfig = dialogInputs.existingConfigs.find(
          (config) => !config.isReadonly && config.name.trim().toLowerCase() === typedName
        )
        const isOverwrite = existingConfig !== undefined
        // The columns the request carries: the displayed ones when the box is checked, otherwise the
        // stored columns of the matched config only while "Save columns" is locked (kept, not dropped),
        // and none otherwise.
        const columns = result.saveColumns
          ? pageData.displayedColumnsIds
          : isOverwrite && dialogInputs.frozeColumnSaveOption
            ? existingConfig.columns
            : []
        const values = result.saveInputValues ? parseFieldValues(pageData.fieldValues ?? {}) : {}
        const isAdvanced = result.saveInputValues ? pageData.viewMode === advancedViewMode : false

        if (isOverwrite) {
          const updateRequest: UpdateSearchConfigRequest = {
            searchConfig: {
              appId: currentMfe.appId,
              productName: currentMfe.productName,
              page,
              modificationCount: 0,
              fieldListVersion: 0,
              id: existingConfig.id,
              name: existingConfig.name,
              columns,
              values,
              isReadonly: existingConfig.isReadonly,
              isAdvanced
            }
          }
          return searchConfigService.updateSearchConfig(existingConfig.id, updateRequest).pipe(
            map((response) => {
              portalMessageService.success({
                summaryKey: 'SEARCH_CONFIG.SAVE_AS_DIALOG.OVERRIDDEN',
                summaryParameters: { config: existingConfig.name }
              })
              return { id: existingConfig.id, configs: response.configs, overwritten: true } as SaveSearchConfigResult
            }),
            catchError(saveSearchConfigFailure(portalMessageService))
          )
        }

        const createRequest: CreateSearchConfigRequest = {
          appId: currentMfe.appId,
          productName: currentMfe.productName,
          fieldListVersion: 0,
          isReadonly: false,
          page,
          name: result.searchConfigName ?? '',
          isAdvanced,
          columns,
          values
        }
        return searchConfigService.createSearchConfig(createRequest).pipe(
          map((response) => {
            portalMessageService.success({
              summaryKey: 'SEARCH_CONFIG.SAVE_AS_DIALOG.SAVED',
              summaryParameters: { config: result.searchConfigName ?? '' }
            })
            return { id: response.id, configs: response.configs, overwritten: false } as SaveSearchConfigResult
          }),
          catchError(saveSearchConfigFailure(portalMessageService))
        )
      })
    )
}

/**
 * The shared failure path for the create and update requests: log the error, fire the create/edit
 * error toast (a failed Save As is still a failed create-or-update of the config) and resolve to
 * `undefined`.
 */
function saveSearchConfigFailure(
  portalMessageService: PortalMessageService
): (error: unknown) => Observable<undefined> {
  return (error: unknown) => {
    console.error(error)
    portalMessageService.error({
      summaryKey: 'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CREATE_FAILURE'
    })
    return of(undefined)
  }
}
