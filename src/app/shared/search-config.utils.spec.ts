import { SearchConfigInfo } from './generated'
import { advancedViewMode, basicViewMode } from './constants'
import {
  areColumnsEqual,
  areValuesEqual,
  hasColumns,
  hasOnlyColumns,
  hasOnlyValues,
  hasValues,
  isSearchConfigModified,
  parseFieldValues,
  SearchConfigPageData
} from './search-config.utils'

describe('search-config.utils', () => {
  const valuesConfig: SearchConfigInfo = {
    id: 'values',
    name: 'values',
    columns: [],
    values: { key_1: 'val_1', key_2: 'val_2' },
    isReadonly: false,
    isAdvanced: false
  }

  const advancedValuesConfig: SearchConfigInfo = {
    ...valuesConfig,
    id: 'advanced-values',
    name: 'advanced-values',
    isAdvanced: true
  }

  const columnsConfig: SearchConfigInfo = {
    id: 'columns',
    name: 'columns',
    columns: ['col_1', 'col_2'],
    values: {},
    isReadonly: false,
    isAdvanced: false
  }

  const combinedConfig: SearchConfigInfo = {
    id: 'combined',
    name: 'combined',
    columns: ['col_1', 'col_2'],
    values: { key_1: 'val_1', key_2: 'val_2' },
    isReadonly: false,
    isAdvanced: false
  }

  describe('hasValues', () => {
    it('should be true when the config stores at least one value', () => {
      expect(hasValues(valuesConfig)).toBe(true)
      expect(hasValues(combinedConfig)).toBe(true)
    })

    it('should be false when the config stores no values', () => {
      expect(hasValues(columnsConfig)).toBe(false)
    })
  })

  describe('hasColumns', () => {
    it('should be true when the config stores at least one column', () => {
      expect(hasColumns(columnsConfig)).toBe(true)
      expect(hasColumns(combinedConfig)).toBe(true)
    })

    it('should be false when the config stores no columns', () => {
      expect(hasColumns(valuesConfig)).toBe(false)
    })
  })

  describe('hasOnlyValues', () => {
    it('should be true when the config stores values and no columns', () => {
      expect(hasOnlyValues(valuesConfig)).toBe(true)
    })

    it('should be false when the config stores columns or no values', () => {
      expect(hasOnlyValues(columnsConfig)).toBe(false)
      expect(hasOnlyValues(combinedConfig)).toBe(false)
    })
  })

  describe('hasOnlyColumns', () => {
    it('should be true when the config stores columns and no values', () => {
      expect(hasOnlyColumns(columnsConfig)).toBe(true)
    })

    it('should be false when the config stores values or no columns', () => {
      expect(hasOnlyColumns(valuesConfig)).toBe(false)
      expect(hasOnlyColumns(combinedConfig)).toBe(false)
    })
  })

  describe('areValuesEqual', () => {
    it('should be true when the serialized field values are equal', () => {
      expect(areValuesEqual({ a: '1', b: '2' }, { a: '1', b: '2' })).toBe(true)
      expect(areValuesEqual({}, {})).toBe(true)
    })

    it('should be false when the field values differ', () => {
      expect(areValuesEqual({ a: '1' }, { a: '2' })).toBe(false)
      expect(areValuesEqual({ a: '1' }, {})).toBe(false)
    })
  })

  describe('areColumnsEqual', () => {
    it('should be true when the column ids match as a set regardless of order', () => {
      expect(areColumnsEqual(['a', 'b'], ['b', 'a'])).toBe(true)
      expect(areColumnsEqual([], [])).toBe(true)
    })

    it('should be false when the column id sets differ', () => {
      expect(areColumnsEqual(['a', 'b'], ['a', 'c'])).toBe(false)
      expect(areColumnsEqual(['a', 'b'], ['a'])).toBe(false)
    })
  })

  describe('parseFieldValues', () => {
    it('should drop falsy values and keep the remaining ones as strings when parsing field values', () => {
      const parsed = parseFieldValues({ a: '1', empty: '' })
      expect(parsed).toEqual({ a: '1' })
    })

    it('should normalize date values to ISO strings when a value is a date', () => {
      const parsed = parseFieldValues({ date: new Date(Date.UTC(2024, 0, 15, 12, 0, 0)) })
      expect(parsed).toEqual({ date: '2024-01-15T12:00:00.000Z' })
    })
  })

  describe('isSearchConfigModified', () => {
    it('should be false when the config is undefined', () => {
      expect(isSearchConfigModified(undefined, { displayedColumnsIds: ['x'] })).toBe(false)
    })

    it('should not be modified by a column change when the config stores values only', () => {
      const page: SearchConfigPageData = {
        fieldValues: { key_1: 'val_1', key_2: 'val_2' },
        viewMode: basicViewMode,
        displayedColumnsIds: ['unrelated', 'columns']
      }
      expect(isSearchConfigModified(valuesConfig, page)).toBe(false)
    })

    it('should be modified when a values-only config field value differs from the page values', () => {
      const page: SearchConfigPageData = {
        fieldValues: { key_1: 'val_1', key_2: 'val_2-changed' },
        viewMode: basicViewMode,
        displayedColumnsIds: []
      }
      expect(isSearchConfigModified(valuesConfig, page)).toBe(true)
    })

    it('should be modified when a values-only config view mode differs from its isAdvanced mapping', () => {
      // Basic values config (isAdvanced false) while the page is in advanced mode.
      expect(
        isSearchConfigModified(valuesConfig, {
          fieldValues: { key_1: 'val_1', key_2: 'val_2' },
          viewMode: advancedViewMode,
          displayedColumnsIds: []
        })
      ).toBe(true)
      // Advanced values config (isAdvanced true) while the page is in basic mode.
      expect(
        isSearchConfigModified(advancedValuesConfig, {
          fieldValues: { key_1: 'val_1', key_2: 'val_2' },
          viewMode: basicViewMode,
          displayedColumnsIds: []
        })
      ).toBe(true)
    })

    it('should not be modified when a values-only config matches its field values and view mode', () => {
      expect(
        isSearchConfigModified(valuesConfig, {
          fieldValues: { key_1: 'val_1', key_2: 'val_2' },
          viewMode: basicViewMode,
          displayedColumnsIds: []
        })
      ).toBe(false)
      expect(
        isSearchConfigModified(advancedValuesConfig, {
          fieldValues: { key_1: 'val_1', key_2: 'val_2' },
          viewMode: advancedViewMode,
          displayedColumnsIds: []
        })
      ).toBe(false)
    })

    it('should not mark a values-only config modified by its stored view mode when the page reports no view mode', () => {
      // The page does not track the view mode (the header remote reports field values but no view
      // mode), so the stored view mode is not a stored aspect of that page and cannot be compared.
      expect(
        isSearchConfigModified(valuesConfig, {
          fieldValues: { key_1: 'val_1', key_2: 'val_2' },
          displayedColumnsIds: []
        })
      ).toBe(false)
      expect(
        isSearchConfigModified(advancedValuesConfig, {
          fieldValues: { key_1: 'val_1', key_2: 'val_2' },
          displayedColumnsIds: []
        })
      ).toBe(false)
    })

    it('should be modified when a values-only config field value differs even if the page reports no view mode', () => {
      expect(
        isSearchConfigModified(valuesConfig, {
          fieldValues: { key_1: 'val_1', key_2: 'val_2-changed' },
          displayedColumnsIds: []
        })
      ).toBe(true)
    })

    it('should not be modified when the page tracks no field values (standalone column-group deployment)', () => {
      // Without the header remote the page never reports field values, so the criteria aspect is not
      // tracked and a values-storing config must not be reported modified by it.
      expect(
        isSearchConfigModified(valuesConfig, {
          displayedColumnsIds: []
        })
      ).toBe(false)
      expect(
        isSearchConfigModified(combinedConfig, {
          displayedColumnsIds: ['col_2', 'col_1']
        })
      ).toBe(false)
    })

    it('should be modified when a columns-only config displayed columns differ from the page columns', () => {
      expect(
        isSearchConfigModified(columnsConfig, {
          fieldValues: { some: 'page-value' },
          viewMode: basicViewMode,
          displayedColumnsIds: ['col_1']
        })
      ).toBe(true)
    })

    it('should not be modified when a columns-only config matches its displayed columns', () => {
      expect(
        isSearchConfigModified(columnsConfig, {
          fieldValues: { some: 'page-value' },
          viewMode: advancedViewMode,
          displayedColumnsIds: ['col_2', 'col_1']
        })
      ).toBe(false)
    })

    it('should not be modified when the page tracks no displayed columns (standalone header deployment)', () => {
      // Without the column-group remote the page never reports displayed columns, so the columns
      // aspect is not tracked and a columns-storing config must not be reported modified by it.
      expect(
        isSearchConfigModified(columnsConfig, {
          fieldValues: { some: 'page-value' },
          viewMode: basicViewMode
        })
      ).toBe(false)
      expect(
        isSearchConfigModified(combinedConfig, {
          fieldValues: { key_1: 'val_1', key_2: 'val_2' },
          viewMode: basicViewMode
        })
      ).toBe(false)
    })

    it('should be modified when a combined config field value differs while its columns match', () => {
      expect(
        isSearchConfigModified(combinedConfig, {
          fieldValues: { key_1: 'val_1', key_2: 'different' },
          viewMode: basicViewMode,
          displayedColumnsIds: ['col_1', 'col_2']
        })
      ).toBe(true)
    })

    it('should be modified when a combined config columns differ while its values match', () => {
      expect(
        isSearchConfigModified(combinedConfig, {
          fieldValues: { key_1: 'val_1', key_2: 'val_2' },
          viewMode: basicViewMode,
          displayedColumnsIds: ['col_1', 'col_3']
        })
      ).toBe(true)
    })

    it('should be modified when a combined config view mode differs while its values and columns match', () => {
      expect(
        isSearchConfigModified(combinedConfig, {
          fieldValues: { key_1: 'val_1', key_2: 'val_2' },
          viewMode: advancedViewMode,
          displayedColumnsIds: ['col_1', 'col_2']
        })
      ).toBe(true)
    })

    it('should not be modified when a combined config matches its values, view mode and columns', () => {
      expect(
        isSearchConfigModified(combinedConfig, {
          fieldValues: { key_1: 'val_1', key_2: 'val_2' },
          viewMode: basicViewMode,
          displayedColumnsIds: ['col_2', 'col_1']
        })
      ).toBe(false)
    })

    it('should not be modified when a combined config matches its values and columns and the page reports no view mode', () => {
      // A standalone column-group deployment: the page does not track view mode. The combined config
      // still has its values and columns matching, so it must not be reported modified just because
      // `pageData.viewMode` is undefined.
      expect(
        isSearchConfigModified(combinedConfig, {
          fieldValues: { key_1: 'val_1', key_2: 'val_2' },
          displayedColumnsIds: ['col_2', 'col_1']
        })
      ).toBe(false)
    })
  })
})
