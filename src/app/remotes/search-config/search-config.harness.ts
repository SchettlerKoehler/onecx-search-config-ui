import { ContentContainerComponentHarness } from '@angular/cdk/testing'
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed'

import { ListItemHarness, PButtonHarness, PSelectHarness } from '@onecx/angular-testing'

import { SEARCH_CONFIG_SAVE_AS_BUTTON_ID } from 'src/app/shared/constants'

/**
 * Config select of the search header remote. The `p-select` panel renders inside `<p-select>`
 * (PrimeNG's default `self` appendTo), so it stays scoped to this remote; tooltips append to `body`
 * (forced: PrimeNG Tooltip only positions correctly with `body`/`target`).
 */
export class OneCXSearchConfigHarness extends ContentContainerComponentHarness {
  static readonly hostSelector = 'app-ocx-search-config'

  private readonly _select = this.locatorForOptional(PSelectHarness)
  private readonly _saveAsButton = this.locatorForOptional(PButtonHarness.with({ id: SEARCH_CONFIG_SAVE_AS_BUTTON_ID }))

  async getConfigSelect() {
    return await this._select()
  }

  async getSaveAsButton() {
    return await this._saveAsButton()
  }

  /**
   * Rows of the opened config select. The panel renders inside `<p-select>` (PrimeNG's default `self`
   * appendTo), but `PSelectHarness#getSelectItems` still resolves items from the document root (see
   * `PSelectHarness#getSelectItems`); pick a single row by its rendered text from the returned list.
   */
  async getSelectItems(): Promise<ListItemHarness[]> {
    const select = await this.getConfigSelect()
    return (await select?.getSelectItems()) ?? []
  }

  /**
   * The rendered rows (`.sc-search-config-row`) of the opened config panel, resolved against the remote
   * element's native DOM. The panel is `self`-appended (a descendant of the remote), so it stays within
   * the remote element rather than the document body.
   */
  private async _openPanelAndRows(): Promise<HTMLElement> {
    await (await this.getConfigSelect())?.open()
    const host = TestbedHarnessEnvironment.getNativeElement(await this.host())
    return host as HTMLElement
  }

  /**
   * The config row (`.sc-search-config-row`) rendered for a given config name. Opens the panel first so
   * the rows are in the DOM, then resolves the row whose name text matches exactly.
   */
  async getRowByName(name: string): Promise<HTMLElement> {
    const host = await this._openPanelAndRows()
    const row = Array.from(host.querySelectorAll('.sc-search-config-row')).find((r) => {
      const nameSpan = r.querySelector('.sc-search-config-row-name')
      return nameSpan?.textContent?.trim() === name
    })
    if (!row) {
      throw new Error(`No search-config row found for name "${name}"`)
    }
    return row as HTMLElement
  }

  /**
   * The delete (trash) button rendered inside the config row for a given name, or `null` when the row is
   * not deletable (no `SEARCHCONFIG#DELETE` permission or a read-only config) so the row renders no
   * trash button.
   */
  async getDeleteButton(name: string): Promise<HTMLElement | null> {
    const row = await this.getRowByName(name)
    return row.querySelector('.sc-search-config-delete button.p-button') as HTMLElement | null
  }
}
