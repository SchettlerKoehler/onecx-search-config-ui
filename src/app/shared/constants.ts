export type advancedViewModeType = 'advanced'
export const advancedViewMode = 'advanced'
export type basicViewModeType = 'basic'
export const basicViewMode = 'basic'

export const searchConfigStoreName = 'ocx-search-config-component-store'
export const columngGroupSelectionStoreName = 'ocx-column-group-selection-component-store'

/** Fixed id of the Save As button joined to the search header config select (stable style/test anchor). */
export const SEARCH_CONFIG_SAVE_AS_BUTTON_ID = 'ocx-search-config-save-as-button'

/** Fixed id of the Save As button joined to the column-group config select (stable style/test anchor). */
export const COLUMN_GROUP_SAVE_AS_BUTTON_ID = 'ocx-column-group-save-as-button'

/**
 * Fixed id of the Delete button in the delete confirm dialog. Cross-remote contract: the column
 * remote reuses the same dialog and Delete button unchanged.
 */
export const SEARCH_CONFIG_DELETE_BUTTON_ID = 'ocx-search-config-delete-button'

/**
 * Delete-confirm dialog width, applied through `PortalDialogConfig.width`. Part of the same
 * cross-remote contract as the fixed Delete id (see `--onecx-search-config-dialog-width` in
 * `src/styles.scss`); both remotes open the dialog at this width unchanged.
 */
export const SEARCH_CONFIG_DIALOG_WIDTH = 'var(--onecx-search-config-dialog-width)'
