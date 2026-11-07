import { ContentContainerComponentHarness } from '@angular/cdk/testing'

import { ListItemHarness, PButtonHarness, PSelectHarness } from '@onecx/angular-testing'

import { SEARCH_CONFIG_SAVE_AS_BUTTON_ID } from 'src/app/shared/constants'

/**
 * Config select of the search header remote. The `p-select` panel and tooltips render inside the
 * remote's element (in-remote `appendTo`), so the panel is reachable from the document root while
 * staying scoped to this remote.
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
   * Rows of the opened config select. The panel is appended to the remote element, i.e. outside the
   * `<p-select>` host, so it must be resolved from the document root (see `PSelectHarness#getSelectItems`);
   * pick a single row by its rendered text from the returned list.
   */
  async getSelectItems(): Promise<ListItemHarness[]> {
    const select = await this.getConfigSelect()
    return (await select?.getSelectItems()) ?? []
  }
}
