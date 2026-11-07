import { ContentContainerComponentHarness } from '@angular/cdk/testing'

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
    /* istanbul ignore next */
    return (await select?.getSelectItems()) ?? []
  }
}
