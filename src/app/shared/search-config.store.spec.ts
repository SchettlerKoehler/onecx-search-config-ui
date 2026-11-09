import { TestBed } from '@angular/core/testing'
import { firstValueFrom, take } from 'rxjs'

import { FakeTopic } from '@onecx/accelerator'

import {
  SearchConfigMessage,
  SearchConfigState,
  SearchConfigStore,
  SearchConfigTopic,
  initialState
} from './search-config.store'
import { SearchConfigInfo } from './generated'
import { advancedViewMode, basicViewMode, columngGroupSelectionStoreName, searchConfigStoreName } from './constants'
import { parseFieldValues } from './search-config.utils'

describe('SearchConfigStore', () => {
  let store: SearchConfigStore
  let secondStore: SearchConfigStore

  const testConfigBase: SearchConfigInfo = {
    id: 'test_id',
    name: 'test_name',
    columns: ['col_1', 'col_2'],
    values: {
      key_1: 'val_1',
      key_2: 'val_2'
    },
    isReadonly: false,
    isAdvanced: false
  }

  const testConfigOnlyValues: SearchConfigInfo = {
    ...testConfigBase,
    id: 'testConfigOnlyValues',
    name: 'testConfigOnlyValues',
    columns: [],
    values: {
      key_1: 'val_1',
      key_2: 'val_2'
    }
  }

  const testConfigValuesAndColumns: SearchConfigInfo = {
    ...testConfigBase,
    id: 'testConfigValuesAndColumns',
    name: 'testConfigValuesAndColumns',
    columns: ['col_1', 'col_2'],
    values: {
      key_1: 'val_1',
      key_2: 'val_2'
    }
  }

  const testConfigOnlyColumns: SearchConfigInfo = {
    ...testConfigBase,
    id: 'testConfigOnlyColumns',
    name: 'testConfigOnlyColumns',
    columns: ['col_1', 'col_2'],
    values: {}
  }

  let mockSearchConfigStoreTopic: FakeTopic<SearchConfigMessage>

  beforeEach(() => {
    mockSearchConfigStoreTopic = new FakeTopic<SearchConfigMessage>()
    TestBed.configureTestingModule({
      imports: [],
      providers: []
    })

    store = new SearchConfigStore('store-1', mockSearchConfigStoreTopic as any as SearchConfigTopic)

    secondStore = new SearchConfigStore('store-2', mockSearchConfigStoreTopic as any as SearchConfigTopic)
  })

  describe('searchConfigVm$ selector', () => {
    it('should expose only configs with values and no current config in the view model when the store holds value- and column-storing configs', async () => {
      store.patchState({
        searchConfigs: [testConfigBase, testConfigOnlyValues, testConfigOnlyColumns],
        currentSearchConfig: undefined
      })

      const vm = await firstValueFrom(store.searchConfigVm$)

      expect(vm.searchConfigs.map((item) => item.name)).toEqual([testConfigBase.name, testConfigOnlyValues.name])
      expect(vm.currentConfig).toBeUndefined()
      expect(vm.currentConfigModified).toBe(false)
    })

    it('should mark the current config modified when a criteria-only config field value differs', async () => {
      store.patchState({
        currentSearchConfig: testConfigOnlyValues,
        fieldValues: { key_1: 'val_1', key_2: 'val_2-changed' },
        viewMode: basicViewMode,
        searchConfigComponentActive: true
      })

      const vm = await firstValueFrom(store.searchConfigVm$)

      expect(vm.currentConfig).toBe(testConfigOnlyValues)
      expect(vm.currentConfigModified).toBe(true)
    })

    it('should not mark the current config modified when the header remote is inactive and the criteria differ', async () => {
      // Standalone column-group deployment: no header remote, so the criteria aspect is not judged.
      store.patchState({
        currentSearchConfig: testConfigOnlyValues,
        fieldValues: { key_1: 'val_1', key_2: 'val_2-changed' },
        viewMode: basicViewMode,
        searchConfigComponentActive: false
      })

      const vm = await firstValueFrom(store.searchConfigVm$)

      expect(vm.currentConfigModified).toBe(false)
    })

    it('should mark the current config modified when a criteria-only config view mode differs', async () => {
      store.patchState({
        currentSearchConfig: testConfigOnlyValues,
        fieldValues: { key_1: 'val_1', key_2: 'val_2' },
        viewMode: advancedViewMode,
        searchConfigComponentActive: true
      })

      const vm = await firstValueFrom(store.searchConfigVm$)

      expect(vm.currentConfigModified).toBe(true)
    })

    it('should not mark the current config modified when a criteria-only config matches the page', async () => {
      store.patchState({
        currentSearchConfig: testConfigOnlyValues,
        fieldValues: { key_1: 'val_1', key_2: 'val_2' },
        viewMode: basicViewMode,
        searchConfigComponentActive: true
      })

      const vm = await firstValueFrom(store.searchConfigVm$)

      expect(vm.currentConfigModified).toBe(false)
    })

    it('should mark a combined config modified when its stored columns differ from the displayed columns', async () => {
      store.patchState({
        currentSearchConfig: testConfigValuesAndColumns,
        fieldValues: { key_1: 'val_1', key_2: 'val_2' },
        viewMode: basicViewMode,
        displayedColumnsIds: ['col_1'],
        searchConfigComponentActive: true,
        columnGroupComponentActive: true
      })

      const vm = await firstValueFrom(store.searchConfigVm$)

      expect(vm.currentConfigModified).toBe(true)
    })

    it('should not mark the current config modified when the column-group remote is inactive and the columns differ', async () => {
      // Standalone header deployment: no column-group remote, so the columns aspect is not judged.
      store.patchState({
        currentSearchConfig: testConfigValuesAndColumns,
        fieldValues: { key_1: 'val_1', key_2: 'val_2' },
        viewMode: basicViewMode,
        displayedColumnsIds: ['col_1'],
        searchConfigComponentActive: true,
        columnGroupComponentActive: false
      })

      const vm = await firstValueFrom(store.searchConfigVm$)

      expect(vm.currentConfigModified).toBe(false)
    })
  })

  describe('activate store', () => {
    it('should update isSearchConfigComponentActive$ selector when the store is activated', (done) => {
      store.patchState({})

      store.activateStore(searchConfigStoreName)

      store.isSearchConfigComponentActive$.pipe(take(1)).subscribe((isActive) => {
        expect(isActive).toBeTruthy()
        done()
      })
    })
  })

  describe('set page name', () => {
    it('should update the pageName$ selector when the page name is set', (done) => {
      store.patchState({})

      store.setPageName('my-page')

      store.pageName$.pipe(take(1)).subscribe((page) => {
        expect(page).toBe('my-page')
        done()
      })
    })

    it('should catch the publish error and log it when the topic publish rejects', async () => {
      const error = new Error('publish failed')
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
      jest.spyOn(mockSearchConfigStoreTopic, 'publish').mockRejectedValue(error)

      store.setPageName('my-page')
      await Promise.resolve()

      expect(consoleErrorSpy).toHaveBeenCalledWith(error)
      consoleErrorSpy.mockRestore()
    })
  })

  describe('set custom group key', () => {
    it('should update the columnSelectionVm$ selector when the custom group key is set', (done) => {
      store.patchState({})

      store.setCustomGroupKey('custom-key')

      store.columnSelectionVm$.pipe(take(1)).subscribe((vm) => {
        expect(vm.customGroupKey).toBe('custom-key')
        done()
      })
    })
  })

  describe('set non search config group keys', () => {
    it('should update the columnSelectionVm$ selector when the non-search-config group keys are set', (done) => {
      store.patchState({})

      store.setNonSearchConfigGroupKeys(['1'])

      store.columnSelectionVm$.pipe(take(1)).subscribe((vm) => {
        expect(vm.nonSearchConfigGroupKeys).toStrictEqual(['1'])
        expect(vm.options[0].items).toStrictEqual([{ label: '1', value: '1', isPredefined: true }])
        done()
      })
    })
  })

  describe('add search config', () => {
    it('should send an update message when a search config is added', (done) => {
      store.patchState({})

      store.addSearchConfig(testConfigValuesAndColumns)

      mockSearchConfigStoreTopic.subscribe((msg) => {
        expect(msg.payload.storeName).toBe('store-1')
        expect(msg.payload.stateToUpdate).toStrictEqual({
          searchConfigs: [testConfigValuesAndColumns]
        })
        done()
      })
    })
  })

  describe('upsert search config', () => {
    it('should append a config with a new id', () => {
      store.patchState({
        searchConfigs: [testConfigOnlyValues]
      })

      store.upsertSearchConfig(testConfigValuesAndColumns)

      expect(store.state().searchConfigs).toStrictEqual([testConfigOnlyValues, testConfigValuesAndColumns])
    })

    it('should replace the stored content of a config with an existing id', () => {
      store.patchState({
        searchConfigs: [testConfigOnlyValues, testConfigValuesAndColumns]
      })

      // A full overwrite: the response config carries the same id with reduced content (columns dropped).
      const overwrittenConfig: SearchConfigInfo = {
        ...testConfigValuesAndColumns,
        columns: [],
        values: { key_1: 'val_1-updated' }
      }

      store.upsertSearchConfig(overwrittenConfig)

      expect(store.state().searchConfigs).toStrictEqual([testConfigOnlyValues, overwrittenConfig])
      expect(store.state().searchConfigs.map((item) => item.id)).toStrictEqual([
        testConfigOnlyValues.id,
        testConfigValuesAndColumns.id
      ])
    })

    it('should send an update message when a config is upserted', (done) => {
      store.patchState({
        searchConfigs: [testConfigOnlyValues, testConfigValuesAndColumns]
      })

      store.upsertSearchConfig(testConfigOnlyColumns)

      mockSearchConfigStoreTopic.subscribe((msg) => {
        expect(msg.payload.storeName).toBe('store-1')
        expect(msg.payload.stateToUpdate).toStrictEqual({
          searchConfigs: [testConfigOnlyValues, testConfigValuesAndColumns, testConfigOnlyColumns]
        })
        done()
      })
    })
  })

  describe('delete search config', () => {
    it('should update the searchConfigVm$ selector when a search config is deleted', (done) => {
      store.patchState({
        searchConfigs: [testConfigOnlyValues, testConfigValuesAndColumns, testConfigOnlyColumns]
      })

      store.deleteSearchConfig(testConfigOnlyValues)

      store.searchConfigVm$.pipe(take(1)).subscribe((vm) => {
        expect(vm.searchConfigs).toStrictEqual([testConfigValuesAndColumns])
        done()
      })
    })

    it('should clear the selected group key when the deleted config is the selected one (standalone use)', () => {
      store.patchState({
        searchConfigs: [testConfigOnlyValues, testConfigValuesAndColumns],
        selectedGroupKey: testConfigValuesAndColumns.name,
        customGroupKey: 'custom-key'
      })

      store.deleteSearchConfig(testConfigValuesAndColumns)

      expect(store.state().selectedGroupKey).toBe('custom-key')
    })

    it('should keep the selected group key when the deleted config is not the selected one', () => {
      store.patchState({
        searchConfigs: [testConfigOnlyValues, testConfigValuesAndColumns],
        selectedGroupKey: testConfigOnlyValues.name,
        customGroupKey: 'custom-key'
      })

      store.deleteSearchConfig(testConfigValuesAndColumns)

      expect(store.state().selectedGroupKey).toBe(testConfigOnlyValues.name)
    })

    it('should send an update message with all changes when a config is deleted', (done) => {
      store.patchState({
        currentSearchConfig: testConfigOnlyColumns,
        searchConfigs: [testConfigOnlyValues, testConfigValuesAndColumns, testConfigOnlyColumns],
        selectedGroupKey: testConfigOnlyColumns.name,
        customGroupKey: 'custom-key',
        columnGroupComponentActive: true
      })

      store.deleteSearchConfig(testConfigOnlyColumns)

      mockSearchConfigStoreTopic.subscribe((msg) => {
        expect(msg.payload.storeName).toBe('store-1')
        expect(msg.payload.stateToUpdate).toStrictEqual({
          searchConfigs: [testConfigOnlyValues, testConfigValuesAndColumns],
          currentSearchConfig: undefined,
          selectedGroupKey: 'custom-key'
        })
        done()
      })
    })
  })

  describe('set search config', () => {
    it('should update when the config has only values and the key is a search config', (done) => {
      store.patchState({
        searchConfigs: [testConfigOnlyValues, testConfigOnlyColumns],
        currentSearchConfig: testConfigOnlyColumns,
        selectedGroupKey: testConfigOnlyColumns.name,
        customGroupKey: 'custom-key',
        columnGroupComponentActive: true
      })

      store.setCurrentConfig(testConfigOnlyValues)

      store.selectedGroupKey$.pipe(take(1)).subscribe((key) => {
        expect(key).toBe('custom-key')
        done()
      })
    })
  })

  describe('set selected group key', () => {
    describe('columnSelectionVm$ selector', () => {
      it('should update when a config and its selected key are set and the new key is predefined', (done) => {
        store.patchState({
          selectedGroupKey: testConfigValuesAndColumns.name,
          currentSearchConfig: testConfigValuesAndColumns,
          nonSearchConfigGroupKeys: ['default'],
          searchConfigs: [testConfigValuesAndColumns],
          searchConfigComponentActive: true
        })

        store.setSelectedGroupKey('default')

        store.columnSelectionVm$.pipe(take(1)).subscribe((vm) => {
          expect(vm.selectedGroupKey).toBe('default')
          done()
        })
      })

      it('should update when a config and its selected key are set and the new key is a custom group key', (done) => {
        store.patchState({
          selectedGroupKey: testConfigValuesAndColumns.name,
          currentSearchConfig: testConfigValuesAndColumns,
          nonSearchConfigGroupKeys: ['default'],
          searchConfigs: [testConfigValuesAndColumns],
          customGroupKey: 'custom-key',
          searchConfigComponentActive: true
        })

        store.setSelectedGroupKey('custom-key')

        store.columnSelectionVm$.pipe(take(1)).subscribe((vm) => {
          expect(vm.selectedGroupKey).toBe('custom-key')
          done()
        })
      })
    })

    describe('currentConfig$ selector', () => {
      it('should keep the header current config when the selected saved config stores no values', (done) => {
        // A columns-only saved config only re-scopes the displayed columns; the header criteria
        // config is retained (the column change surfaces as a derived `modified` flag).
        store.patchState({
          selectedGroupKey: 'default',
          currentSearchConfig: testConfigOnlyValues,
          nonSearchConfigGroupKeys: ['default'],
          searchConfigs: [testConfigOnlyValues, testConfigOnlyColumns],
          searchConfigComponentActive: true
        })

        store.setSelectedGroupKey(testConfigOnlyColumns.name)

        store.currentConfig$.pipe(take(1)).subscribe((config) => {
          expect(config).toBe(testConfigOnlyValues)
          done()
        })
      })

      it('should leave the header current config untouched when a predefined group is selected', () => {
        // The header (search-config component) is active and has a current config. Selecting a host
        // predefined column group is not a saved config, so `currentSearchConfig` stays unchanged —
        // the predefined group only affects the column-group selection, never the header config.
        store.patchState({
          selectedGroupKey: 'default',
          currentSearchConfig: testConfigBase,
          nonSearchConfigGroupKeys: ['default'],
          searchConfigs: [testConfigBase],
          searchConfigComponentActive: true
        })

        store.setSelectedGroupKey('default')

        expect(store.state().currentSearchConfig).toBe(testConfigBase)
      })

      it('should adopt the selected saved config when it stores values and re-scope the columns with it', () => {
        // Selecting a saved config that stores values (including a combined criteria + columns config)
        // replaces the header's current config: the "Sales" criteria + "Wide" column group case where
        // the selected config carries its own criteria. The retained-only path is for columns-only
        // picks, which keep the header criteria config.
        store.patchState({
          selectedGroupKey: 'default',
          currentSearchConfig: testConfigValuesAndColumns,
          nonSearchConfigGroupKeys: ['default'],
          searchConfigs: [testConfigValuesAndColumns, testConfigBase],
          searchConfigComponentActive: true
        })

        store.setSelectedGroupKey(testConfigBase.name)

        expect(store.state().currentSearchConfig).toBe(testConfigBase)
        // The selection itself was applied.
        expect(store.state().selectedGroupKey).toBe(testConfigBase.name)
      })

      it('should keep the current config when switching from a saved config to a predefined group', () => {
        // The current selection is a saved config; moving to a host predefined group never changes the
        // header's criteria config, so `currentSearchConfig` is retained.
        store.patchState({
          selectedGroupKey: testConfigValuesAndColumns.name,
          currentSearchConfig: testConfigValuesAndColumns,
          nonSearchConfigGroupKeys: ['default'],
          searchConfigs: [testConfigValuesAndColumns],
          searchConfigComponentActive: true
        })

        store.setSelectedGroupKey('default')

        expect(store.state().currentSearchConfig).toBe(testConfigValuesAndColumns)
      })
    })

    // AC4 end to end: the header's current "Sales" config stores both criteria and a column group,
    // and the page currently matches it (no `*`). Selecting the columns-only "Wide" saved config
    // re-scopes the displayed columns to Wide's while retaining Sales as the header criteria config —
    // so the header marks the retained Sales config modified (its stored columns no longer match) and
    // the column-group select, pointing at Wide, does not (its stored columns match the new display).
    it('should mark the retained header config modified but not the selected config when a columns-only config re-scopes the displayed columns', async () => {
      const sales: SearchConfigInfo = {
        id: 'sales_id',
        name: 'Sales',
        columns: ['col_s'],
        values: { key_s: 'val_s' },
        isReadonly: false,
        isAdvanced: false
      }
      const wide: SearchConfigInfo = {
        id: 'wide_id',
        name: 'Wide',
        columns: ['col_w1', 'col_w2'],
        values: {},
        isReadonly: false,
        isAdvanced: false
      }

      // Page matches the current "Sales" config: its values, view mode and columns all agree.
      store.patchState({
        searchConfigs: [sales, wide],
        currentSearchConfig: sales,
        selectedGroupKey: sales.name,
        fieldValues: sales.values,
        viewMode: basicViewMode,
        displayedColumnsIds: sales.columns,
        searchConfigComponentActive: true,
        columnGroupComponentActive: true
      })

      // Before the selection change nothing is modified.
      let vm = await firstValueFrom(store.searchConfigVm$)
      expect(vm.currentConfigModified).toBe(false)

      // The user picks the columns-only "Wide" group: the header criteria config is retained, only
      // the selection re-points.
      store.setSelectedGroupKey(wide.name)
      // The host then applies Wide's columns to the page.
      store.updateDisplayedColumnsIds(wide.columns)

      vm = await firstValueFrom(store.searchConfigVm$)
      // Sales is retained and its stored columns no longer match the displayed columns.
      expect(vm.currentConfig).toBe(sales)
      expect(vm.currentConfigModified).toBe(true)

      const selectionVm = await firstValueFrom(store.columnSelectionVm$)
      // The select points at Wide, whose stored columns match the displayed columns.
      expect(selectionVm.selectedGroupKey).toBe(wide.name)
      expect(selectionVm.selectedConfigModified).toBe(false)
    })

    // (b) Two-remote (column-group active) case: a saved-config selection made by the column store is
    // kept in sync with the header through the topic. The saved config's name deliberately collides with
    // a host predefined group key on the column side, so the header can only stay consistent if it
    // receives the exact `selectedGroupKey` the column store resolved (a name-based lookup alone could
    // confuse the saved config with the predefined group of the same name).
    it('should keep the header selected group key in sync with a saved selection when the column group store publishes the selection via the topic', () => {
      const columnStore = new SearchConfigStore(
        columngGroupSelectionStoreName,
        mockSearchConfigStoreTopic as any as SearchConfigTopic
      )
      const headerStore = new SearchConfigStore(
        searchConfigStoreName,
        mockSearchConfigStoreTopic as any as SearchConfigTopic
      )

      // Both stores carry the saved config; on the column side its name is also a predefined group key.
      columnStore.patchState({
        searchConfigs: [testConfigValuesAndColumns],
        nonSearchConfigGroupKeys: [testConfigValuesAndColumns.name],
        columnGroupComponentActive: true,
        searchConfigComponentActive: true
      })
      headerStore.patchState({
        searchConfigs: [testConfigValuesAndColumns],
        searchConfigComponentActive: true
      })

      columnStore.setSelectedGroupKey(testConfigValuesAndColumns.name)

      // `setSelectedGroupKey` publishes synchronously on the shared topic, so the header store has
      // already applied the selection — its `selectedGroupKey` matches the saved config name.
      expect(columnStore.state().selectedGroupKey).toBe(testConfigValuesAndColumns.name)
      expect(headerStore.state().selectedGroupKey).toBe(testConfigValuesAndColumns.name)
      // The header still resolves the synced selection to the saved config (not the predefined key).
      expect(
        headerStore.state().searchConfigs.find((c) => c.name === headerStore.state().selectedGroupKey)
      ).toStrictEqual(testConfigValuesAndColumns)
    })
  })

  describe('selectedGroupKey$ selector', () => {
    it('should not update when the config with only inputs is unset', (done) => {
      store.patchState({
        fieldValues: {
          ...testConfigOnlyValues.values
        },
        currentSearchConfig: testConfigOnlyValues,
        selectedGroupKey: 'default-key'
      })

      store.updateFieldValues({
        ...testConfigOnlyValues.values,
        key_1: 'val_1-update'
      })

      store.selectedGroupKey$.pipe(take(1)).subscribe((key) => {
        expect(key).toBe('default-key')
        done()
      })
    })

    it('should not re-point the column-group selection when field values of a retained config change', (done) => {
      // The "Sales"/"Wide" scenario: the header's current config stores columns and the column-group
      // selection points at a *different* saved config. A page values change must not drag the
      // selection back onto the current config's own column group (the retained config is reported
      // `modified`, it is not the selection).
      store.patchState({
        searchConfigs: [testConfigValuesAndColumns, testConfigBase],
        fieldValues: {
          ...testConfigValuesAndColumns.values
        },
        currentSearchConfig: testConfigValuesAndColumns,
        selectedGroupKey: testConfigBase.name,
        customGroupKey: 'custom-key',
        columnGroupComponentActive: true
      })

      store.updateFieldValues({
        ...testConfigValuesAndColumns.values,
        key_1: 'val_1-update'
      })

      store.selectedGroupKey$.pipe(take(1)).subscribe((key) => {
        // The selection stays on the distinct saved config the user picked; a values change surfaces
        // as a `modified` flag on the retained config, not a snap of the select.
        expect(key).toBe(testConfigBase.name)
        done()
      })
    })

    it('should not update when the values of the current config equal the new ones', () => {
      store.patchState({
        fieldValues: {
          ...testConfigOnlyValues.values
        },
        currentSearchConfig: testConfigOnlyValues,
        selectedGroupKey: 'default-key'
      })

      store.updateFieldValues({
        ...testConfigOnlyValues.values
      })

      store.currentConfig$.pipe(take(1)).subscribe((config) => {
        expect(config).toBe(testConfigOnlyValues)
      })
    })

    it('should exercise the updateFieldValues and updateDisplayedColumnsIds/updateViewMode branches when field values, columns, and view mode all differ', () => {
      store.patchState({
        ...initialState,
        fieldValues: { x: '1' },
        currentSearchConfig: testConfigOnlyValues,
        selectedGroupKey: 'default-key',
        displayedSearchData: {
          fieldValues: { old: 'value' },
          displayedColumnsIds: ['old-col'],
          viewMode: basicViewMode
        }
      })
      store.updateFieldValues({ x: '2' })
      store.state$.pipe(take(1)).subscribe((state) => {
        // The config is retained when the field values no longer match (modified, not deselected).
        expect(state.currentSearchConfig).toBe(testConfigOnlyValues)

        store.patchState({
          ...initialState,
          displayedColumnsIds: ['a'],
          currentSearchConfig: testConfigValuesAndColumns,
          selectedGroupKey: testConfigValuesAndColumns.name,
          columnGroupComponentActive: true,
          displayedSearchData: {
            fieldValues: { old: 'value' },
            displayedColumnsIds: ['a'],
            viewMode: basicViewMode
          }
        })
        store.updateDisplayedColumnsIds(['b'])
        store.state$.pipe(take(1)).subscribe((state2) => {
          // The config is retained when the displayed columns no longer match.
          expect(state2.currentSearchConfig).toBe(testConfigValuesAndColumns)

          store.patchState({
            ...initialState,
            viewMode: basicViewMode,
            currentSearchConfig: testConfigOnlyValues,
            selectedGroupKey: 'default-key',
            displayedSearchData: {
              fieldValues: { old: 'value' },
              displayedColumnsIds: ['a'],
              viewMode: basicViewMode
            }
          })
          store.updateViewMode(advancedViewMode)
          store.state$.pipe(take(1)).subscribe((state3) => {
            // The config is retained when the view mode no longer matches.
            expect(state3.currentSearchConfig).toBe(testConfigOnlyValues)

            store.patchState({
              ...initialState,
              fieldValues: { a: '1' },
              currentSearchConfig: testConfigOnlyValues,
              displayedSearchData: {
                fieldValues: { a: '1' },
                displayedColumnsIds: ['x'],
                viewMode: basicViewMode
              }
            })
            store.updateFieldValues({ a: '1' })
            store.state$.pipe(take(1)).subscribe((state4) => {
              expect(state4.fieldValues).toEqual({ a: '1' })

              store.patchState({
                ...initialState,
                displayedColumnsIds: ['x'],
                displayedSearchData: {
                  fieldValues: { a: '1' },
                  displayedColumnsIds: ['x'],
                  viewMode: basicViewMode
                }
              })
              store.updateDisplayedColumnsIds(['x'])
              store.state$.pipe(take(1)).subscribe((state5) => {
                expect(state5.displayedColumnsIds).toEqual(['x'])

                store.patchState({
                  ...initialState,
                  viewMode: basicViewMode,
                  displayedSearchData: {
                    fieldValues: { a: '1' },
                    displayedColumnsIds: ['x'],
                    viewMode: basicViewMode
                  }
                })
                store.updateViewMode(basicViewMode)
                store.state$.pipe(take(1)).subscribe((state6) => {
                  expect(state6.viewMode).toBe(basicViewMode)
                })
              })
            })
          })
        })
      })
    })
  })

  describe('update displayed columns', () => {
    describe('currentConfig$ selector', () => {
      it('should keep the config and mark it modified when its columns differ from the new ones', (done) => {
        store.patchState({
          searchConfigs: [testConfigValuesAndColumns],
          displayedColumnsIds: testConfigValuesAndColumns.columns,
          currentSearchConfig: testConfigValuesAndColumns,
          selectedGroupKey: testConfigValuesAndColumns.name,
          columnGroupComponentActive: true
        })

        store.updateDisplayedColumnsIds(['col_2'])

        store.currentConfig$.pipe(take(1)).subscribe((config) => {
          // The config is retained (not deselected) and reported modified because its stored
          // columns no longer match the displayed columns.
          expect(config).toBe(testConfigValuesAndColumns)
          done()
        })

        store.columnSelectionVm$.pipe(take(1)).subscribe((vm) => {
          // The select points at the same config (via `selectedGroupKey`), so the selection is
          // reported modified for the same reason — the stored columns no longer match.
          expect(vm.selectedConfigModified).toBe(true)
        })
      })
    })

    describe('selectedGroupKey$ selector', () => {
      it('should not update when the config with only inputs is unset', () => {
        store.patchState({
          displayedColumnsIds: testConfigOnlyValues.columns,
          currentSearchConfig: testConfigOnlyValues,
          selectedGroupKey: 'default-key'
        })

        store.updateDisplayedColumnsIds([...testConfigBase.columns, 'newCol'])

        store.selectedGroupKey$.pipe(take(1)).subscribe((selectedGroupKey) => {
          expect(selectedGroupKey).toBe('default-key')
        })
      })

      it('should not re-point the column-group selection when the displayed columns of a retained config change', (done) => {
        // The "Sales"/"Wide" scenario: the header's current config stores columns and the column-group
        // selection points at a *different* saved config. A page columns change must not drag the
        // selection back onto the current config's own column group (the retained config is reported
        // `modified`, it is not the selection).
        store.patchState({
          searchConfigs: [testConfigValuesAndColumns, testConfigBase],
          displayedColumnsIds: testConfigValuesAndColumns.columns,
          currentSearchConfig: testConfigValuesAndColumns,
          selectedGroupKey: testConfigBase.name,
          customGroupKey: 'custom-key',
          columnGroupComponentActive: true
        })

        store.updateDisplayedColumnsIds([...testConfigValuesAndColumns.columns, 'newCol'])

        store.selectedGroupKey$.pipe(take(1)).subscribe((key) => {
          // The selection stays on the distinct saved config the user picked; the column mismatch
          // surfaces as a `modified` flag on the retained config, not a snap of the select.
          expect(key).toBe(testConfigBase.name)
          done()
        })
      })

      it('should not update when the columns of the current config equal the new ones', () => {
        store.patchState({
          displayedColumnsIds: testConfigValuesAndColumns.columns,
          currentSearchConfig: testConfigOnlyValues,
          selectedGroupKey: testConfigValuesAndColumns.name
        })

        store.updateDisplayedColumnsIds(testConfigValuesAndColumns.columns)

        store.currentConfig$.pipe(take(1)).subscribe((config) => {
          expect(config).toBe(testConfigOnlyValues)
        })
      })
    })
  })

  describe('update view mode', () => {
    describe('pageData$ selector', () => {
      it('should update when the view mode changed', (done) => {
        store.patchState({
          viewMode: advancedViewMode
        })

        store.updateViewMode(basicViewMode)

        store.currentPageData$.pipe(take(1)).subscribe((data) => {
          expect(data.viewMode).toStrictEqual(basicViewMode)
          done()
        })
      })
    })

    describe('selectedGroupKey$ selector', () => {
      it('should not update when the values of the current config equal the new ones', () => {
        store.patchState({
          viewMode: testConfigOnlyValues.isAdvanced ? advancedViewMode : basicViewMode,
          currentSearchConfig: testConfigOnlyValues,
          selectedGroupKey: 'default-key'
        })

        store.updateViewMode(testConfigOnlyValues.isAdvanced ? advancedViewMode : basicViewMode)

        store.currentConfig$.pipe(take(1)).subscribe((config) => {
          expect(config).toBe(testConfigOnlyValues)
        })
      })
    })

    it('should send an update message with only the view mode change when the current config is retained', (done) => {
      store.patchState({
        ...initialState,
        currentSearchConfig: testConfigBase,
        selectedGroupKey: testConfigBase.name,
        searchConfigs: [testConfigBase],
        viewMode: testConfigBase.isAdvanced ? advancedViewMode : basicViewMode,
        customGroupKey: 'custom-key',
        columnGroupComponentActive: true
      })

      store.updateViewMode(testConfigBase.isAdvanced ? basicViewMode : advancedViewMode)

      mockSearchConfigStoreTopic.subscribe((msg) => {
        expect(msg.payload.storeName).toBe('store-1')
        // The current config is retained, so `currentSearchConfig` and `selectedGroupKey` are unchanged
        // and omitted from the partial update — only the view mode (and the displayed data) change.
        expect(msg.payload.stateToUpdate).toStrictEqual({
          viewMode: testConfigBase.isAdvanced ? basicViewMode : advancedViewMode,
          displayedSearchData: {
            fieldValues: undefined,
            displayedColumnsIds: [],
            viewMode: testConfigBase.isAdvanced ? basicViewMode : advancedViewMode
          }
        })
        done()
      })
    })
  })

  describe('update layout', () => {
    it('should not update when the layout did not change', () => {
      store.patchState({
        ...initialState,
        layout: 'table'
      })

      store.updateLayout('table')

      store.searchConfigVm$.pipe(take(1)).subscribe((vm) => {
        expect(vm).toBeDefined()
      })
    })

    it('should update when the layout changed', (done) => {
      store.patchState({
        ...initialState,
        layout: 'table'
      })

      store.updateLayout('grid')

      store.searchConfigVm$.pipe(take(1)).subscribe((vm) => {
        expect(vm.layout).toBe('grid')
        done()
      })
    })
  })

  describe('columnSelectionVm$ selector', () => {
    it('should build the grouped options from the predefined keys and the saved configs when the state holds a predefined key and a saved config', (done) => {
      store.patchState({
        selectedGroupKey: 'non-1',
        searchConfigs: [testConfigOnlyColumns],
        nonSearchConfigGroupKeys: ['non-1']
      })

      store.columnSelectionVm$.pipe(take(1)).subscribe((vm) => {
        expect(vm.selectedGroupKey).toBe('non-1')
        expect(vm.searchConfigsWithColumns).toStrictEqual([testConfigOnlyColumns])
        expect(vm.options).toHaveLength(2)
        expect(vm.options[0].items).toStrictEqual([{ label: 'non-1', value: 'non-1', isPredefined: true }])
        expect(vm.options[1].items).toStrictEqual([
          {
            label: testConfigOnlyColumns.name,
            value: testConfigOnlyColumns.name,
            config: testConfigOnlyColumns
          }
        ])
        done()
      })
    })

    it('should mark the selected config modified when a columns-only config displayed columns differ', (done) => {
      store.patchState({
        searchConfigs: [testConfigOnlyColumns],
        currentSearchConfig: testConfigOnlyColumns,
        selectedGroupKey: testConfigOnlyColumns.name,
        displayedColumnsIds: ['col_1'],
        columnGroupComponentActive: true
      })

      store.columnSelectionVm$.pipe(take(1)).subscribe((vm) => {
        expect(vm.selectedConfigModified).toBe(true)
        done()
      })
    })

    it('should not mark the selected config modified when a columns-only config matches the displayed columns', (done) => {
      store.patchState({
        searchConfigs: [testConfigOnlyColumns],
        currentSearchConfig: testConfigOnlyColumns,
        selectedGroupKey: testConfigOnlyColumns.name,
        displayedColumnsIds: ['col_2', 'col_1'],
        columnGroupComponentActive: true
      })

      store.columnSelectionVm$.pipe(take(1)).subscribe((vm) => {
        expect(vm.selectedConfigModified).toBe(false)
        done()
      })
    })

    it('should not mark the selected config modified when the column-group remote is inactive and the columns differ', (done) => {
      // Standalone header deployment: no column-group remote, so the columns aspect is not judged.
      store.patchState({
        searchConfigs: [testConfigOnlyColumns],
        currentSearchConfig: testConfigOnlyColumns,
        selectedGroupKey: testConfigOnlyColumns.name,
        displayedColumnsIds: ['col_1'],
        columnGroupComponentActive: false
      })

      store.columnSelectionVm$.pipe(take(1)).subscribe((vm) => {
        expect(vm.selectedConfigModified).toBe(false)
        done()
      })
    })
  })

  describe('update config / selected group key helpers', () => {
    it('should resolve the currentSearchConfig helper when the state takes each supported shape', () => {
      const current = testConfigOnlyValues
      expect(
        (store as any).updateConfigBySelectedGroupKey(
          {
            ...initialState,
            searchConfigComponentActive: false,
            currentSearchConfig: current,
            selectedGroupKey: 'default-key'
          },
          'other'
        )
      ).toBe(current)

      // The new key is not a saved config nor a predefined/custom group: no saved config matches the
      // new key (here: none), so the current config is retained.
      expect(
        (store as any).updateConfigBySelectedGroupKey(
          {
            ...initialState,
            searchConfigComponentActive: true,
            currentSearchConfig: current,
            selectedGroupKey: testConfigOnlyValues.name,
            nonSearchConfigGroupKeys: ['default-key'],
            searchConfigs: [testConfigOnlyValues]
          },
          'custom-group'
        )
      ).toBe(current)

      // The header's current config is retained when the new key is the host custom group and the
      // previous selection was a saved config (the first-branch keep — a custom/predefined group never
      // changes the header criteria config).
      expect(
        (store as any).updateConfigBySelectedGroupKey(
          {
            ...initialState,
            searchConfigComponentActive: true,
            currentSearchConfig: current,
            selectedGroupKey: testConfigOnlyValues.name,
            customGroupKey: 'custom-group',
            nonSearchConfigGroupKeys: ['default-key'],
            searchConfigs: [testConfigOnlyValues]
          },
          'custom-group'
        )
      ).toBe(current)

      // The header's column-storing criteria config is retained when the new key selects a saved config
      // that only re-scopes the columns (the "Sales" criteria + "Wide" columns example) — it is not
      // replaced by the selected columns config.
      expect(
        (store as any).updateConfigBySelectedGroupKey(
          {
            ...initialState,
            searchConfigComponentActive: true,
            currentSearchConfig: testConfigValuesAndColumns,
            selectedGroupKey: 'wide',
            searchConfigs: [testConfigValuesAndColumns, testConfigOnlyColumns],
            nonSearchConfigGroupKeys: ['wide']
          },
          'wide'
        )
      ).toBe(testConfigValuesAndColumns)

      // A saved config that stores no values only re-scopes the displayed columns (the "Sales"
      // criteria + "Wide" columns group case): the header criteria config is retained, the column
      // change surfaces as a derived `modified` flag.
      expect(
        (store as any).updateConfigBySelectedGroupKey(
          {
            ...initialState,
            searchConfigComponentActive: true,
            currentSearchConfig: testConfigOnlyValues,
            selectedGroupKey: 'default-key',
            searchConfigs: [testConfigOnlyColumns]
          },
          testConfigOnlyColumns.name
        )
      ).toBe(testConfigOnlyValues)

      // A saved config that stores values replaces the current config (the "Wide" group also carrying
      // its own criteria — the combined case adopts the whole saved config).
      expect(
        (store as any).updateConfigBySelectedGroupKey(
          {
            ...initialState,
            searchConfigComponentActive: true,
            currentSearchConfig: testConfigOnlyValues,
            selectedGroupKey: 'default-key',
            searchConfigs: [testConfigBase]
          },
          testConfigBase.name
        )
      ).toBe(testConfigBase)

      expect(
        (store as any).updateConfigBySelectedGroupKey(
          {
            ...initialState,
            searchConfigComponentActive: true,
            currentSearchConfig: current,
            selectedGroupKey: 'other-config',
            customGroupKey: 'custom-group',
            searchConfigs: [testConfigOnlyValues, { ...testConfigOnlyValues, name: 'other-config' }]
          },
          'other-config'
        )
      ).toEqual({ ...testConfigOnlyValues, name: 'other-config' })

      expect(
        (store as any).updateConfigBySelectedGroupKey(
          {
            ...initialState,
            searchConfigComponentActive: true,
            currentSearchConfig: current,
            selectedGroupKey: 'default-key',
            customGroupKey: 'default-key',
            searchConfigs: [testConfigOnlyValues]
          },
          'default-key'
        )
      ).toBe(current)
    })

    it('should resolve the selectedGroupKey helper when the state takes each supported shape', () => {
      expect(
        (store as any).updateSelectedGroupKeyByConfig(
          {
            ...initialState,
            columnGroupComponentActive: false,
            selectedGroupKey: 'default-key'
          },
          testConfigOnlyValues
        )
      ).toBe('default-key')

      expect(
        (store as any).updateSelectedGroupKeyByConfig(
          {
            ...initialState,
            columnGroupComponentActive: true,
            selectedGroupKey: testConfigOnlyColumns.name,
            searchConfigs: [testConfigOnlyColumns]
          },
          testConfigOnlyColumns
        )
      ).toBe(testConfigOnlyColumns.name)

      expect(
        (store as any).updateSelectedGroupKeyByConfig(
          {
            ...initialState,
            columnGroupComponentActive: true,
            selectedGroupKey: 'other-config',
            customGroupKey: 'custom-group',
            searchConfigs: [testConfigOnlyValues, { ...testConfigOnlyValues, name: 'other-config', values: { x: '1' } }]
          },
          testConfigOnlyValues
        )
      ).toBe('custom-group')

      expect(
        (store as any).updateSelectedGroupKeyByConfig(
          {
            ...initialState,
            columnGroupComponentActive: true,
            selectedGroupKey: testConfigOnlyColumns.name,
            customGroupKey: 'custom-group',
            searchConfigs: [testConfigOnlyColumns]
          },
          undefined
        )
      ).toBe('custom-group')

      expect(
        (store as any).updateSelectedGroupKeyByConfig(
          {
            ...initialState,
            columnGroupComponentActive: true,
            selectedGroupKey: 'default-key',
            customGroupKey: 'custom-group',
            searchConfigs: [testConfigOnlyValues]
          },
          undefined
        )
      ).toBe('default-key')
    })
  })

  describe('storeUpdate effect', () => {
    it('should update the state to match the payload when a store update message is received', (done) => {
      const spy = jest.spyOn(secondStore, 'patchState')

      store.setSearchConfigs([testConfigBase, testConfigOnlyValues])

      secondStore.state$.pipe(take(1)).subscribe(() => {
        expect(spy).toHaveBeenCalledWith({
          ...initialState,
          searchConfigs: [testConfigBase, testConfigOnlyValues]
        })
        done()
      })
    })
  })

  describe('state sync', () => {
    beforeEach(() => {
      store.ngOnDestroy()
      secondStore.ngOnDestroy()

      store = new SearchConfigStore(searchConfigStoreName, mockSearchConfigStoreTopic as any as SearchConfigTopic)

      secondStore = new SearchConfigStore(
        columngGroupSelectionStoreName,
        mockSearchConfigStoreTopic as any as SearchConfigTopic
      )
    })

    it('should send the whole state from the column group store when the search config is not active', () => {
      const spy = jest.spyOn(mockSearchConfigStoreTopic, 'publish')
      secondStore.sendUpdateMessage(
        {
          customGroupKey: 'new-custom'
        },
        {
          searchConfigComponentActive: false,
          customGroupKey: 'custom',
          layout: 'grid'
        } as SearchConfigState
      )

      expect(spy).toHaveBeenCalledWith({
        payload: {
          storeName: columngGroupSelectionStoreName,
          stateToUpdate: {
            customGroupKey: 'new-custom',
            searchConfigComponentActive: false,
            layout: 'grid'
          },
          wholeState: true
        }
      })
    })

    it('should send the partial state from the search config store when the column group is active', () => {
      const spy = jest.spyOn(mockSearchConfigStoreTopic, 'publish')
      store.sendUpdateMessage(
        {
          pageName: 'newPageName'
        },
        {
          columnGroupComponentActive: true,
          pageName: 'pageName',
          viewMode: advancedViewMode
        } as SearchConfigState
      )

      expect(spy).toHaveBeenCalledWith({
        payload: {
          storeName: searchConfigStoreName,
          stateToUpdate: {
            pageName: 'newPageName'
          },
          wholeState: false
        }
      })
    })

    it('should update the whole state for the search config store when a whole-state update message is received', (done) => {
      const spy = jest.spyOn(store, 'patchState')

      secondStore.sendUpdateMessage(
        {
          selectedGroupKey: 'skey'
        },
        {
          ...initialState,
          selectedGroupKey: 's',
          customGroupKey: 'c',
          displayedColumnsIds: ['c1'],
          layout: 'grid',
          nonSearchConfigGroupKeys: ['d'],
          displayedSearchData: {
            displayedColumnsIds: ['c1'],
            fieldValues: undefined,
            viewMode: undefined
          }
        } as SearchConfigState
      )

      store.state$.pipe(take(1)).subscribe(() => {
        expect(spy).toHaveBeenCalledWith({
          ...initialState,
          columnGroupComponentActive: true,
          searchConfigComponentActive: true,
          selectedGroupKey: 'skey',
          customGroupKey: 'c',
          displayedColumnsIds: ['c1'],
          layout: 'grid',
          nonSearchConfigGroupKeys: ['d'],
          displayedSearchData: {
            displayedColumnsIds: ['c1'],
            fieldValues: undefined,
            viewMode: undefined
          }
        })
        done()
      })
    })

    it('should update the whole state for the column group store when a whole-state update message is received', (done) => {
      const spy = jest.spyOn(secondStore, 'patchState')

      store.sendUpdateMessage(
        {
          pageName: 'pName'
        },
        {
          ...initialState,
          pageName: 'p',
          fieldValues: {
            k: 'v'
          },
          viewMode: advancedViewMode,
          searchConfigs: [testConfigBase],
          currentSearchConfig: testConfigBase,
          displayedSearchData: {
            displayedColumnsIds: [],
            fieldValues: {
              k: 'v'
            },
            viewMode: advancedViewMode
          }
        } as SearchConfigState
      )

      secondStore.state$.pipe(take(1)).subscribe(() => {
        expect(spy).toHaveBeenCalledWith({
          ...initialState,
          columnGroupComponentActive: true,
          searchConfigComponentActive: true,
          pageName: 'pName',
          fieldValues: {
            k: 'v'
          },
          viewMode: advancedViewMode,
          searchConfigs: [testConfigBase],
          currentSearchConfig: testConfigBase,
          displayedSearchData: {
            displayedColumnsIds: [],
            fieldValues: {
              k: 'v'
            },
            viewMode: advancedViewMode
          }
        })
        done()
      })
    })

    it('should parse date values with toISOString and stringify plain values when parsing a mixed field value payload', () => {
      const dateValue = new Date('2024-03-05T12:00:00.000Z')

      expect(
        parseFieldValues({
          createdAt: dateValue,
          status: 'active',
          count: 0,
          empty: '',
          truthyButNotDate: true
        })
      ).toEqual({
        createdAt: dateValue.toISOString(),
        status: 'active',
        truthyButNotDate: 'true'
      })
    })
  })
})
