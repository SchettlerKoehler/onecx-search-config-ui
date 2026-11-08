import { ContentContainerComponentHarness, TestElement } from '@angular/cdk/testing'
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed'

import { ListItemHarness, PButtonHarness, PSelectHarness } from '@onecx/angular-testing'

import { SEARCH_CONFIG_SAVE_AS_BUTTON_ID } from 'src/app/shared/constants'

/**
 * Column-group selector of the column remote. It renders the same joined config select + Save As as
 * the search header remote (grouped: a "Predefined" group of host column groups and a "Saved" group
 * of saved configs that store columns), so the option rows and the joined Save As reuse the
 * `sc-search-config-*` style hooks and the shared Save As / Delete button ids. The `p-select` panel
 * renders inside `<p-select>` (PrimeNG's default `self` appendTo), so it stays scoped to this remote.
 */
export class OneCXColumnGroupSelectionHarness extends ContentContainerComponentHarness {
  static readonly hostSelector = 'app-ocx-column-group-selection'

  private readonly _select = this.locatorForOptional(PSelectHarness)
  private readonly _saveAsButton = this.locatorForOptional(PButtonHarness.with({ id: SEARCH_CONFIG_SAVE_AS_BUTTON_ID }))
  // The trash button is the only `.sc-search-config-delete` button in the panel. `locatorForAll` on this
  // `ContentContainerComponentHarness` resolves it from the harness host element, not the document root.
  private readonly _deleteButtons = this.locatorForAll(PButtonHarness.with({ selector: '.sc-search-config-delete' }))

  async getConfigSelect() {
    return await this._select()
  }

  async getSaveAsButton() {
    return await this._saveAsButton()
  }

  /**
   * Option rows of the opened config select. The panel renders inside `<p-select>` (PrimeNG's default
   * `self` appendTo), but `PSelectHarness#getSelectItems` still resolves items from the document root
   * (see `PSelectHarness#getSelectItems`); the group headers and the option leaves are both returned.
   */
  async getSelectItems(): Promise<ListItemHarness[]> {
    const select = await this.getConfigSelect()
    return (await select?.getSelectItems()) ?? []
  }

  /**
   * The opened panel row whose `aria-label` equals the given option label, or `null` when no such row
   * renders. The panel is opened first. Rows are matched by `aria-label` (PrimeNG sets it to the
   * option label) rather than by `getText()`, which on a deletable row is polluted by the
   * screen-reader keyboard-shortcut hint.
   */
  async findSelectItem(label: string): Promise<ListItemHarness | null> {
    const items = await this.getSelectItems()
    for (const item of items) {
      const ariaLabel = await (await item.host()).getAttribute('aria-label')
      if (ariaLabel === label) {
        return item
      }
    }
    return null
  }

  /**
   * The rendered row (`.sc-search-config-row`) for a given option label, as a `TestElement`. The panel
   * is opened first so the rows are in the DOM, then the row whose name span text matches exactly is
   * returned. Each row carries exactly one name span (`.sc-search-config-row-name`) in the same
   * document order as the rows, so the two lists are compared by index — robust to the other text a
   * deletable row renders (the keyboard shortcut hint and the trash button).
   * @throws when no rendered row carries the given label.
   */
  async getRowByName(name: string): Promise<TestElement> {
    await this.openPanel()
    const rows = await this.locatorForAll('.sc-search-config-row')()
    const nameSpans = await this.locatorForAll('.sc-search-config-row-name')()
    for (let i = 0; i < rows.length; i++) {
      if ((await nameSpans[i].text()).trim() === name) {
        return rows[i]
      }
    }
    throw new Error(`No column-group row found for name "${name}"`)
  }

  /**
   * The delete (trash) button rendered inside the config row for a given name, as a `PButtonHarness`,
   * or `null` when that row is not deletable (no `SEARCHCONFIG#DELETE` permission or a read-only
   * config) so the row renders no trash button. The panel is opened first and the row's presence is
   * checked (`getRowByName`), so a missing row throws; `null` (not a throw) is returned only for a
   * row that exists but renders no trash button.
   */
  async getDeleteButton(name: string): Promise<PButtonHarness | null> {
    await this.getRowByName(name)
    const buttons = await this._deleteButtons()
    for (const button of buttons) {
      // The trash button only renders inside a row; scope it to the row for the given name so a
      // deletable row's button is never matched for a non-deletable row (and vice versa).
      const row = TestbedHarnessEnvironment.getNativeElement(await button.host()).closest('.sc-search-config-row')
      if (row?.querySelector('.sc-search-config-row-name')?.textContent?.trim() === name) {
        return button
      }
    }
    return null
  }

  private async openPanel(): Promise<void> {
    await (await this.getConfigSelect())?.open()
  }
}
