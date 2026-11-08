import { isValidDate } from '@onecx/accelerator'

import { SearchConfigInfo } from './generated'
import { advancedViewMode, basicViewMode, advancedViewModeType, basicViewModeType } from './constants'
import { FieldValues, UnparsedFieldValues } from './search-config.store'

/** The page aspects compared to decide whether a config is modified (field values, view mode, columns). */
export type SearchConfigPageData = {
  fieldValues?: FieldValues
  viewMode?: basicViewModeType | advancedViewModeType
  displayedColumnsIds: Array<string>
}

export function hasValues(config: SearchConfigInfo): boolean {
  return Object.keys(config.values).length > 0
}

export function hasColumns(config: SearchConfigInfo): boolean {
  return config.columns.length > 0
}

export function hasOnlyValues(config: SearchConfigInfo): boolean {
  return !hasColumns(config) && hasValues(config)
}

export function hasOnlyColumns(config: SearchConfigInfo): boolean {
  return !hasValues(config) && hasColumns(config)
}

export function areValuesEqual(v1: FieldValues, v2: FieldValues): boolean {
  return JSON.stringify(v1) === JSON.stringify(v2)
}

/**
 * Whether a saved config is modified relative to the page's current state. A config is modified when
 * any aspect it stores differs, by value comparison, from the page's current state: the criteria
 * (field values plus view mode) when it stores values, and the displayed columns when it stores
 * columns. Aspects the config does not store are ignored, so a config with only values is never
 * modified by a column change and vice versa. The view-mode comparison is only applied when the page
 * reports a view mode — when it does not (a standalone column-group deployment without the header
 * remote leaves `state.viewMode` undefined) the stored view mode is not a stored aspect of that page
 * and cannot be reported modified.
 */
export function isSearchConfigModified(config: SearchConfigInfo | undefined, pageData: SearchConfigPageData): boolean {
  if (config === undefined) return false

  let modified = false
  if (hasValues(config)) {
    modified =
      !areValuesEqual(config.values, pageData.fieldValues ?? {}) ||
      (pageData.viewMode !== undefined && (config.isAdvanced ? advancedViewMode : basicViewMode) !== pageData.viewMode)
  }
  if (hasColumns(config) && !areColumnsEqual(config.columns, pageData.displayedColumnsIds)) {
    modified = true
  }
  return modified
}

export function parseFieldValues(values: UnparsedFieldValues): FieldValues {
  return Object.entries(values)
    .filter(([key, value]) => value)
    .reduce(
      (acc: { [key: string]: string }, [key, value]) => ({
        ...acc,
        [key]: isValidDate(value) ? value.toISOString() : String(value)
      }),
      {}
    )
}

export function areColumnsEqual(c1: Array<string>, c2: Array<string>): boolean {
  return c1.length === c2.length && c1.every((col) => c2.includes(col))
}
