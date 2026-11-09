import { ComponentHarness, ContentContainerComponentHarness } from '@angular/cdk/testing'

import { InputHarness } from '@onecx/angular-testing'

class CheckboxInputHarness extends ComponentHarness {
  async click(): Promise<void> {
    await (await this.host()).click()
  }

  async isChecked(): Promise<boolean> {
    return await (await this.host()).getProperty<boolean>('checked')
  }
}

class SaveInputValuesCheckboxHarness extends CheckboxInputHarness {
  public static readonly hostSelector = '#saveInputValuesId.p-checkbox-input'
}

class SaveColumnsCheckboxHarness extends CheckboxInputHarness {
  public static readonly hostSelector = '#saveColumnsId.p-checkbox-input'
}

export class CreateOrEditSearchConfigDialogHarness extends ContentContainerComponentHarness {
  public static readonly hostSelector = 'app-ocx-create-or-edit-search-config-dialog'

  getSaveInputValuesCheckboxHarness(): Promise<SaveInputValuesCheckboxHarness> {
    return this.getHarness(SaveInputValuesCheckboxHarness)
  }

  getSaveColumnsCheckboxHarness(): Promise<SaveColumnsCheckboxHarness> {
    return this.getHarness(SaveColumnsCheckboxHarness)
  }

  getSearchConfigInputHarness() {
    return this.getHarness(InputHarness.with({ id: 'searchConfigName' }))
  }

  async getSaveColumnsLabel(): Promise<string | null | undefined> {
    const labels = await this.locatorForAll('div > label')()
    return labels.at(1)?.text()
  }
}
