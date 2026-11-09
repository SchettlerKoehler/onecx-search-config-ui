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
 * Dialog width (shared by the delete-confirm and Save As dialogs), applied through
 * `PortalDialogConfig.width`. Part of the same cross-remote contract as the fixed Delete id (see
 * `--onecx-search-config-dialog-width` in `src/styles.scss`); both remotes open the dialogs at this
 * width unchanged.
 */
export const SEARCH_CONFIG_DIALOG_WIDTH = 'var(--onecx-search-config-dialog-width)'

/**
 * Stable hook for the Save As dialog's name-field suggestion panel, applied by the host through the
 * remote's `data-style-id` scoping. Both remotes pass it unchanged so the panel is styled the same
 * from either entry point (and reaches it even if PrimeNG is forced to append it to `body`).
 */
export const SEARCH_CONFIG_AUTOCOMPLETE_PANEL_STYLE_CLASS = 'sc-search-config-save-as-panel'
