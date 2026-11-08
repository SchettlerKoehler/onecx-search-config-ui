import { EMPTY, Observable, catchError, combineLatest, map, of, switchMap, withLatestFrom } from 'rxjs'

import { PortalDialogService } from '@onecx/angular-accelerator'
import { AppStateService, PortalMessageService } from '@onecx/angular-integration-interface'
import { RemoteComponentConfig } from '@onecx/angular-utils'

import {
  CreateSearchConfigRequest,
  CreateSearchConfigResponse,
  SearchConfigAPIService,
  SearchConfigInfo
} from 'src/app/shared/generated'
import { SearchConfigStore } from 'src/app/shared/search-config.store'
import {
  CreateOrEditSearchConfigDialogComponent,
  CreateOrEditSearchDialogContent
} from 'src/app/shared/components/create-or-edit-search-config-dialog/create-or-edit-search-config-dialog.component'
import { advancedViewMode } from 'src/app/shared/constants'
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

/**
 * Opens the reusable create dialog and, when it confirms (`button === 'primary'` with a result), builds
 * and sends the create request. A failed create fires an error toast and resolves to `undefined`; the
 * caller fires the success toast and updates the store once it resolves with a created `id`.
 *
 * `pageName` is the resolved page-name observable (the store's `pageName$` for the header, or the
 * column-group remote's live `pageName ?? applicationPath` selector for standalone use) and is applied
 * to the request. Combining the confirmed dialog result with the current MFE, page data and page name
 * via `withLatestFrom` means a confirmed dialog is never dropped: the confirmed dialog result is what
 * drives the single emission, and the live selector always has a value, so a page name is present in the
 * standalone case too.
 */
export function createSearchConfig(
  portalDialogService: PortalDialogService,
  searchConfigService: SearchConfigAPIService,
  portalMessageService: PortalMessageService,
  appStateService: AppStateService,
  store: SearchConfigStore,
  pageName: Observable<string>,
  dialogInputs: {
    searchConfigName: string
    saveInputValues: boolean
    saveColumns: boolean
    frozeColumnSaveOption: boolean
    frozeColumnSaveOptionExplanation?: string
  }
): Observable<CreateSearchConfigResponse | undefined> {
  return portalDialogService
    .openDialog<CreateOrEditSearchDialogContent>(
      'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CREATE_HEADER',
      {
        type: CreateOrEditSearchConfigDialogComponent,
        inputs: {
          searchConfigName: dialogInputs.searchConfigName,
          saveInputValues: dialogInputs.saveInputValues,
          saveColumns: dialogInputs.saveColumns,
          frozeColumnSaveOption: dialogInputs.frozeColumnSaveOption,
          frozeColumnSaveOptionExplanation: dialogInputs.frozeColumnSaveOptionExplanation
        }
      },
      'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CONFIRM',
      'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CANCEL'
    )
    .pipe(
      withLatestFrom(appStateService.currentMfe$.asObservable(), store.currentPageData$, pageName),
      switchMap(([dialogResult, currentMfe, pageData, page]) => {
        const result = dialogResult?.result
        if (!result || dialogResult.button !== 'primary') {
          return of(undefined as CreateSearchConfigResponse | undefined)
        }
        const request: CreateSearchConfigRequest = {
          appId: currentMfe.appId,
          productName: currentMfe.productName,
          fieldListVersion: 0,
          isReadonly: false,
          page,
          name: result.searchConfigName ?? '',
          isAdvanced: result.saveInputValues ? pageData.viewMode === advancedViewMode : false,
          columns: result.saveColumns ? pageData.displayedColumnsIds : [],
          values: result.saveInputValues ? parseFieldValues(pageData.fieldValues ?? {}) : {}
        }
        return searchConfigService.createSearchConfig(request).pipe(
          catchError((error) => {
            console.error(error)
            portalMessageService.error({
              summaryKey: 'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CREATE_FAILURE'
            })
            return of(undefined as CreateSearchConfigResponse | undefined)
          })
        )
      })
    )
}
