export type advancedViewModeType = 'advanced'
export const advancedViewMode = 'advanced'
export type basicViewModeType = 'basic'
export const basicViewMode = 'basic'

export const searchConfigStoreName = 'ocx-search-config-component-store'
export const columngGroupSelectionStoreName = 'ocx-column-group-selection-component-store'

/** Fixed id of the Save As button joined to the config select (stable style/test anchor). */
export const SEARCH_CONFIG_SAVE_AS_BUTTON_ID = 'ocx-search-config-save-as-button'

/**
 * Fixed id of the Delete button in the delete confirm dialog. Cross-remote contract: the column
 * remote reuses the same dialog and Delete button unchanged.
 */
export const SEARCH_CONFIG_DELETE_BUTTON_ID = 'ocx-search-config-delete-button'
