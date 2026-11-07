import { Observable, of } from 'rxjs'
import { catchError, map, mergeMap } from 'rxjs/operators'

import { PortalDialogService } from '@onecx/angular-accelerator'
import { PortalMessageService } from '@onecx/angular-integration-interface'

import { SearchConfigAPIService, SearchConfigInfo } from 'src/app/shared/generated'

// The delete-confirm dialog width token (see `--onecx-search-config-dialog-width` in `src/styles.scss`).
// Applied through `PortalDialogConfig.width` so the dialog is the fixed width without a `#962` follow-up.
export const SEARCH_CONFIG_DIALOG_WIDTH = 'var(--onecx-search-config-dialog-width)'

// TODO(#960): The `SEARCH_CONFIG.DELETE_DIALOG.{HEADER,MESSAGE,CONFIRM}` and `SEARCH_CONFIG.DELETE_SUCCESS`
// i18n keys are legacy, kept only for the column remote until it reuses this helper and switches to the
// `DELETE_CONFIRM.*` keys. Remove them (and the column remote's inline dialog) in #960.

/**
 * Opens the reusable delete-confirm dialog and deletes the config when it is confirmed.
 *
 * Encapsulates the dialog (title, body and the Delete/Cancel buttons with their fixed id and danger
 * severity), the delete call and the success/error toasts, so both the search-config header remote and
 * the column remote (#960) open the same dialog unchanged by calling this single function.
 *
 * @param portalDialogService  the accelerator dialog service that renders the portal dialog.
 * @param searchConfigService  the API service that deletes the config.
 * @param messageService       the portal message service for the success and error toasts.
 * @param config               the search config to delete.
 * @param deleteButtonId       the fixed id of the Delete button (stable test/style anchor).
 * @returns an `Observable` that emits `true` once the config is deleted, `false` otherwise.
 */
export function confirmAndDeleteSearchConfig(
  portalDialogService: PortalDialogService,
  searchConfigService: SearchConfigAPIService,
  messageService: PortalMessageService,
  config: SearchConfigInfo,
  deleteButtonId: string
): Observable<boolean> {
  return portalDialogService
    .openDialog(
      'SEARCH_CONFIG.DELETE_CONFIRM.HEADER',
      {
        key: 'SEARCH_CONFIG.DELETE_CONFIRM.MESSAGE',
        parameters: {
          config: config.name
        }
      },
      {
        key: 'SEARCH_CONFIG.DELETE_CONFIRM.DELETE',
        id: deleteButtonId,
        severity: 'danger'
      },
      'SEARCH_CONFIG.DELETE_DIALOG.CANCEL',
      { width: SEARCH_CONFIG_DIALOG_WIDTH }
    )
    .pipe(
      mergeMap((dialogResult) => {
        if (!dialogResult || dialogResult.button !== 'primary') {
          return of(false)
        }
        return searchConfigService.deleteSearchConfig(config.id).pipe(
          map(() => {
            messageService.success({
              summaryKey: 'SEARCH_CONFIG.DELETE_CONFIRM.SUCCESS',
              summaryParameters: {
                config: config.name
              }
            })
            return true
          }),
          catchError((error) => {
            console.error(error)
            messageService.error({
              summaryKey: 'SEARCH_CONFIG.DELETE_FAILURE'
            })
            return of(false)
          })
        )
      })
    )
}
