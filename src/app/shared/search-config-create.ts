import { catchError, combineLatest, filter, map, of, switchMap, take, tap, withLatestFrom, Observable } from 'rxjs'

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
 * Resolves the page name for standalone column-group use, where the host often does not set `pageName`.
 * The store's `pageName` wins once it is defined (a header-provided page name always wins); while it is
 * still `undefined` the fallback (derived from `getLocation().applicationPath`) is applied via
 * `ensureStandalonePageName` and returned.
 *
 * Reads the store once, on the current state, so it resolves to whatever page name is known at the moment
 * the load or Save As runs: the header's page name if it has already arrived, otherwise the fallback.
 */
export function resolveStandalonePageName(store: SearchConfigStore, fallbackPageName: string): Observable<string> {
  return store.state$.pipe(
    take(1),
    switchMap((state) => {
      if (state.pageName !== undefined) {
        return of(state.pageName)
      }
      return of(fallbackPageName).pipe(
        tap(() => {
          store.ensureStandalonePageName(fallbackPageName)
        })
      )
    })
  )
}

/**
 * Fetches the saved configs once the remote base url, the page name and the current MFE are all known,
 * then emits the response configs. A failed request fires an error toast and emits no configs. The
 * caller stores the result (`store.setSearchConfigs`).
 *
 * `pageName` is the page-name observable for the caller: the search header remote passes the store's
 * `pageName$` (so it loads only once a page name is provided), while the column-group remote passes
 * `resolveStandalonePageName` (so it loads in standalone use with a fallback page name). `shouldLoad`
 * optionally gates the whole load — the column-group remote skips it while the search header remote is
 * active, avoiding a duplicate, racing GET for the same page/MFE.
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
    filter(([, , , load]) => load === true),
    switchMap(([, currentMfe, page]) =>
      searchConfigService
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
    )
  )
}

/**
 * Opens the reusable create dialog and, when it confirms (`button === 'primary'` with a result), builds
 * and sends the create request. A failed create fires an error toast and resolves to `undefined`; the
 * caller fires the success toast and updates the store once it resolves with a created `id`.
 *
 * `pageName` is the resolved page-name observable (the store's `pageName$` for the header, or
 * `resolveStandalonePageName` for the standalone column-group use) and is applied to the request.
 * Combining the confirmed dialog result with the current MFE, page data and page name via
 * `withLatestFrom` means a confirmed dialog is never dropped: the confirmed dialog result is what drives
 * the single emission, and the fallback guarantees a page name in the standalone case.
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
