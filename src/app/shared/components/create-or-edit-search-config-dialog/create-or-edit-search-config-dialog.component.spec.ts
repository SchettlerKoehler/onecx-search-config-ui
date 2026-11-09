import { Component } from '@angular/core'
import { ComponentFixture, TestBed } from '@angular/core/testing'
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed'
import { By } from '@angular/platform-browser'
import { FormControl } from '@angular/forms'
import { TranslateService } from '@ngx-translate/core'
import { Observable, of } from 'rxjs'

import { AutoComplete } from 'primeng/autocomplete'

import { DialogState } from '@onecx/angular-accelerator'
import { provideTranslateTestingService } from '@onecx/angular-testing'

import { SearchConfigInfo } from 'src/app/shared/generated'

import { CreateOrEditSearchConfigDialogComponent } from './create-or-edit-search-config-dialog.component'
import { CreateOrEditSearchConfigDialogHarness } from './create-or-edit-search-config-dialog.component.harness'

const configFixture = (id: string, name: string, readonly = false): SearchConfigInfo => ({
  id,
  name,
  columns: ['col-1'],
  values: {
    k1: 'v1'
  },
  isReadonly: readonly,
  isAdvanced: false
})

// Embeds the reworked dialog so the component harness can resolve the dialog's host element the way
// a portaled dialog would (a bare `TestBed.createComponent` host is a `<div id="root0">`, not the
// `app-ocx-…` element the harness `hostSelector` targets).
@Component({
  imports: [CreateOrEditSearchConfigDialogComponent],
  template: '<app-ocx-create-or-edit-search-config-dialog></app-ocx-create-or-edit-search-config-dialog>'
})
class SaveAsDialogHostComponent {}

describe('CreateOrEditSearchConfigDialogComponent', () => {
  const alpha = configFixture('alpha', 'Alpha')
  const beta = configFixture('beta', 'Beta')
  const readonlyGamma = configFixture('gamma', 'Gamma', true)

  // The dialog reads the saved configs live from the store (a selector), so every `existingConfigs`
  // fixture is wrapped in a single-emission observable of the config snapshot under test.
  const configs = of([alpha, beta, readonlyGamma])

  let translateService: TranslateService

  // The three form fields are static; this asserts presence and hands back the control as non-null so
  // tests can set values without fighting strict-null on `FormGroup.get`.
  function field(
    component: CreateOrEditSearchConfigDialogComponent,
    name: 'searchConfigName' | 'saveInputValues' | 'saveColumns'
  ): FormControl {
    const control = component.searchConfigFormGroup.get(name)
    expect(control).toBeTruthy()
    return control as FormControl
  }

  // The name field is populated by the dialog (never prefilled), so the fixture renders with an empty
  // name and the test drives the value through the form control (as the `typeahead` autocomplete
  // would on a keystroke / suggestion pick).
  function render(
    opts: {
      existingConfigs?: Observable<SearchConfigInfo[]>
      appendTo?: 'body' | 'self' | HTMLElement | null
      panelStyleClass?: string
      saveInputValues?: boolean
      saveColumns?: boolean
      frozeColumnSaveOption?: boolean
      frozeColumnSaveOptionExplanation?: string
    } = {}
  ): {
    component: CreateOrEditSearchConfigDialogComponent
    fixture: ComponentFixture<CreateOrEditSearchConfigDialogComponent>
  } {
    const fixture = TestBed.createComponent(CreateOrEditSearchConfigDialogComponent)
    const component = fixture.componentInstance
    // The dialog reads the saved configs live from the store (a selector), so the fixture mirrors the
    // remotes and passes a single-emission observable of the config snapshot under test.
    component.existingConfigs = opts.existingConfigs ?? of([])
    component.appendTo = opts.appendTo
    component.panelStyleClass = opts.panelStyleClass
    // The box setters run before the lock (mirroring the dialog's input application order) so a
    // pre-check on a locked option is ignored, exactly as in the real flow.
    if (opts.saveInputValues !== undefined) component.saveInputValues = opts.saveInputValues
    if (opts.saveColumns !== undefined) component.saveColumns = opts.saveColumns
    if (opts.frozeColumnSaveOption !== undefined) component.frozeColumnSaveOption = opts.frozeColumnSaveOption
    if (opts.frozeColumnSaveOptionExplanation !== undefined)
      component.frozeColumnSaveOptionExplanation = opts.frozeColumnSaveOptionExplanation
    fixture.detectChanges()
    return { component, fixture }
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateOrEditSearchConfigDialogComponent],
      providers: [
        ...provideTranslateTestingService({
          en: require('../../../../assets/i18n/en.json'),
          de: require('../../../../assets/i18n/de.json')
        })
      ]
    }).compileComponents()

    translateService = TestBed.inject(TranslateService)
    translateService.setFallbackLang('en')
    translateService.use('en')
  })

  it('should create the component', () => {
    const { component } = render()
    expect(component).toBeTruthy()
  })

  describe('name suggestions', () => {
    it('should feed the non-read-only config names to the suggestions (read-only ones excluded)', () => {
      const { component } = render({ existingConfigs: configs })
      expect(component.nameSuggestions).toStrictEqual(['Alpha', 'Beta'])
    })

    it('should start with an empty (not prefilled) name and no overwrite pending', () => {
      const { component } = render({ existingConfigs: configs })
      expect(field(component, 'searchConfigName').value).toBe('')
      expect(component.overwritePending).toBe(false)
      expect(component.matchedConfigId).toBeUndefined()
    })

    it('should narrow the suggestions to the non-read-only names containing the query (case-insensitive)', () => {
      const { component } = render({ existingConfigs: configs })

      // A lowercase query narrows to a single match; "alph"/"bet" uniquely select each config.
      component.onNameQuery({ query: 'alph' } as any)
      expect(component.nameSuggestions).toStrictEqual(['Alpha'])

      // Matching is case-insensitive on the query side.
      component.onNameQuery({ query: 'ALPH' } as any)
      expect(component.nameSuggestions).toStrictEqual(['Alpha'])

      component.onNameQuery({ query: 'bet' } as any)
      expect(component.nameSuggestions).toStrictEqual(['Beta'])
    })

    it('should list every non-read-only name for an empty or blank query', () => {
      const { component } = render({ existingConfigs: configs })

      component.onNameQuery({ query: '' } as any)
      expect(component.nameSuggestions).toStrictEqual(['Alpha', 'Beta'])

      component.onNameQuery({ query: '   ' } as any)
      expect(component.nameSuggestions).toStrictEqual(['Alpha', 'Beta'])

      // A query matching nothing yields an empty suggestion list (the "no match" state).
      component.onNameQuery({ query: 'zzz' } as any)
      expect(component.nameSuggestions).toStrictEqual([])
    })

    it('should not crash on a query-less complete event', () => {
      const { component } = render({ existingConfigs: configs })
      expect(() => component.onNameQuery(undefined as any)).not.toThrow()
    })
  })

  describe('overwrite match', () => {
    it('should resolve a typed name to an existing non-read-only config (trimmed, case-insensitive)', () => {
      const { component } = render({ existingConfigs: configs })

      field(component, 'searchConfigName').setValue('  alpha ')

      expect(component.matchedConfigId).toBe('alpha')
      expect(component.matchedConfig).toBe(alpha)
      expect(component.overwritePending).toBe(true)
    })

    it('should treat a read-only config as unmatched (a new name creates instead of overwriting)', () => {
      const { component } = render({ existingConfigs: configs })

      field(component, 'searchConfigName').setValue('gamma')

      expect(component.matchedConfigId).toBeUndefined()
      expect(component.overwritePending).toBe(false)
    })

    it('should report no match for a new or blank name', () => {
      const { component } = render({ existingConfigs: configs })

      field(component, 'searchConfigName').setValue('Brand New')
      expect(component.matchedConfigId).toBeUndefined()
      expect(component.overwritePending).toBe(false)

      field(component, 'searchConfigName').setValue('   ')
      expect(component.matchedConfigId).toBeUndefined()
      expect(component.overwritePending).toBe(false)
    })

    it('should render the inline overwrite warning only while a non-read-only config is matched', () => {
      const { component, fixture } = render({ existingConfigs: configs })

      expect(fixture.nativeElement.querySelector('.sc-search-config-overwrite-warning')).toBeNull()

      field(component, 'searchConfigName').setValue('alpha')
      fixture.detectChanges()

      expect(fixture.nativeElement.querySelector('.sc-search-config-overwrite-warning')).toBeTruthy()
    })
  })

  describe('overwrite warning text', () => {
    const instantSpy = () => jest.spyOn(translateService, 'instant')

    it('should name the criteria only when just the criteria are saved', () => {
      const { component } = render({ existingConfigs: configs, saveInputValues: true, saveColumns: false })
      const spy = instantSpy()

      field(component, 'searchConfigName').setValue('alpha')

      expect(component.overwriteWarning).toBe(
        translateService.instant('SEARCH_CONFIG.SAVE_AS_DIALOG.OVERWRITE_CRITERIA', { name: 'Alpha' })
      )
      expect(spy).toHaveBeenLastCalledWith('SEARCH_CONFIG.SAVE_AS_DIALOG.OVERWRITE_CRITERIA', { name: 'Alpha' })
    })

    it('should name the columns only when just the columns are saved', () => {
      const { component } = render({ existingConfigs: configs, saveInputValues: false, saveColumns: true })
      const spy = instantSpy()

      field(component, 'searchConfigName').setValue('alpha')
      // Reading the warning (as the template does) is what resolves the i18n key.
      expect(component.overwriteWarning).not.toBe('')

      expect(spy).toHaveBeenLastCalledWith('SEARCH_CONFIG.SAVE_AS_DIALOG.OVERWRITE_COLUMNS', { name: 'Alpha' })
    })

    it('should name both aspects when both boxes are checked', () => {
      const { component } = render({ existingConfigs: configs, saveInputValues: true, saveColumns: true })
      const spy = instantSpy()

      field(component, 'searchConfigName').setValue('alpha')
      expect(component.overwriteWarning).not.toBe('')

      expect(spy).toHaveBeenLastCalledWith('SEARCH_CONFIG.SAVE_AS_DIALOG.OVERWRITE_BOTH', { name: 'Alpha' })
    })

    it('should say the stored columns are kept when "Save columns" is locked', () => {
      const { component } = render({
        existingConfigs: configs,
        saveInputValues: true,
        saveColumns: false,
        frozeColumnSaveOption: true
      })
      const spy = instantSpy()

      field(component, 'searchConfigName').setValue('alpha')
      expect(component.overwriteWarning).not.toBe('')

      expect(spy).toHaveBeenLastCalledWith('SEARCH_CONFIG.SAVE_AS_DIALOG.OVERWRITE_KEEP_COLUMNS', { name: 'Alpha' })
    })

    it('should be empty when no config is matched', () => {
      const { component } = render({ existingConfigs: configs })
      field(component, 'searchConfigName').setValue('Brand New')
      expect(component.overwriteWarning).toBe('')
    })
  })

  describe('primary button enablement', () => {
    it('should enable only with a non-empty name and at least one checked box', () => {
      const { component } = render({ existingConfigs: configs })
      const emissions: boolean[] = []
      component.primaryButtonEnabled.subscribe((value) => emissions.push(value))

      // Name present, no box checked yet.
      field(component, 'searchConfigName').setValue('Brand New')
      expect(emissions[emissions.length - 1]).toBe(false)

      // A checked box plus the name enables the button.
      field(component, 'saveInputValues').setValue(true)
      expect(emissions[emissions.length - 1]).toBe(true)
    })

    it('should stay disabled for a whitespace-only name even with a box checked (the name must be non-blank)', () => {
      const { component } = render({ existingConfigs: configs, saveInputValues: true })
      const emissions: boolean[] = []
      component.primaryButtonEnabled.subscribe((value) => emissions.push(value))

      // The name is only whitespace: the trimmed name is blank, so the button stays disabled.
      field(component, 'searchConfigName').setValue('   ')
      expect(emissions[emissions.length - 1]).toBe(false)

      // A non-blank name (the surrounding whitespace is trimmed) enables it.
      field(component, 'searchConfigName').setValue('  Alpha  ')
      expect(emissions[emissions.length - 1]).toBe(true)
    })

    it('should stay disabled while "Save columns" is locked and only the criteria box can enable it', () => {
      const { component } = render({ existingConfigs: configs, frozeColumnSaveOption: true })
      const emissions: boolean[] = []
      component.primaryButtonEnabled.subscribe((value) => emissions.push(value))

      field(component, 'searchConfigName').setValue('Brand New')
      expect(emissions[emissions.length - 1]).toBe(false)

      field(component, 'saveInputValues').setValue(true)
      expect(emissions[emissions.length - 1]).toBe(true)
    })
  })

  describe('column save option locking', () => {
    it('should disable and force off the "Save columns" box while locked', () => {
      const { component } = render({ existingConfigs: configs, saveColumns: true, frozeColumnSaveOption: true })
      const control = field(component, 'saveColumns')
      expect(control.disabled).toBe(true)
      expect(control.value).toBe(false)
      expect(component.frozeColumnSaveOption).toBe(true)
    })

    it('should keep the "Save columns" box enabled when not locked and honour the pre-check', () => {
      const { component } = render({ existingConfigs: configs, saveColumns: true, frozeColumnSaveOption: false })
      const control = field(component, 'saveColumns')
      expect(control.disabled).toBe(false)
      expect(control.value).toBe(true)
    })

    it('should ignore the columns pre-check when the option is locked', () => {
      // The pre-check (saveColumns = true) is applied before the lock; the lock must still win.
      const { component } = render({ existingConfigs: configs, saveColumns: true, frozeColumnSaveOption: true })
      expect(field(component, 'saveColumns').value).toBe(false)
    })

    it('should enable the "Save columns" box when the lock is released', () => {
      const { component } = render({ existingConfigs: configs, frozeColumnSaveOption: true })
      component.frozeColumnSaveOption = false
      expect(field(component, 'saveColumns').disabled).toBe(false)
      expect(component.frozeColumnSaveOption).toBe(false)
    })

    it('should ignore a columns pre-check applied after the lock is set', () => {
      // The entry point locks the option first; a later (or replayed) pre-check must not re-check the box.
      const { component } = render({ existingConfigs: configs, frozeColumnSaveOption: true })
      component.saveColumns = true
      expect(field(component, 'saveColumns').value).toBe(false)
      expect(field(component, 'saveColumns').disabled).toBe(true)
    })

    it('should coerce undefined lock inputs to their defaults', () => {
      const { component } = render()
      component.frozeColumnSaveOption = undefined
      expect(component.frozeColumnSaveOption).toBe(false)
      expect(field(component, 'saveColumns').disabled).toBe(false)

      component.frozeColumnSaveOptionExplanation = undefined
      expect(component.frozeColumnSaveOptionExplanation).toBe('')
    })
  })

  describe('form pre-checks', () => {
    it('should seed the criteria and columns boxes from the entry-point pre-checks', () => {
      const { component } = render({ existingConfigs: configs, saveInputValues: true, saveColumns: true })
      expect(field(component, 'saveInputValues').value).toBe(true)
      expect(field(component, 'saveColumns').value).toBe(true)
    })

    it('should default both boxes to unchecked when no pre-check is provided', () => {
      const { component } = render({ existingConfigs: configs })
      expect(field(component, 'saveInputValues').value).toBe(false)
      expect(field(component, 'saveColumns').value).toBe(false)
    })
  })

  describe('defensive input defaults', () => {
    it('should start with no suggestions when no configs are provided', () => {
      const fixture = TestBed.createComponent(CreateOrEditSearchConfigDialogComponent)
      const component = fixture.componentInstance
      // The remotes always pass a selector (which emits the empty store list on boot); a defensive
      // `undefined` emission is tolerated and still yields no suggestions.
      component.existingConfigs = of(undefined as any)
      fixture.detectChanges()
      expect(component.nameSuggestions).toStrictEqual([])
    })

    it('should default the pre-checks to unchecked when undefined', () => {
      const { component } = render({ existingConfigs: configs })
      component.saveInputValues = undefined
      component.saveColumns = undefined
      expect(field(component, 'saveInputValues').value).toBe(false)
      expect(field(component, 'saveColumns').value).toBe(false)
    })

    it('should report no overwrite match when the name is cleared to undefined', () => {
      const { component } = render({ existingConfigs: configs })
      field(component, 'searchConfigName').setValue(undefined as any)
      expect(component.matchedConfigId).toBeUndefined()
    })
  })

  describe('dialog result', () => {
    const state: DialogState<CreateOrEditSearchConfigDialogComponent> = {
      button: 'primary',
      result: undefined
    }

    it('should capture the name and the boxes into the result', () => {
      const { component } = render({ existingConfigs: configs })

      field(component, 'searchConfigName').setValue('Alpha')
      field(component, 'saveInputValues').setValue(true)

      component.ocxDialogButtonClicked(state)

      expect(component.dialogResult).toEqual({
        searchConfigName: 'Alpha',
        saveInputValues: true,
        saveColumns: false
      })
    })

    it('should capture a new name into the result', () => {
      const { component } = render({ existingConfigs: configs })

      field(component, 'searchConfigName').setValue('Brand New')

      component.ocxDialogButtonClicked(state)

      expect(component.dialogResult).toEqual({
        searchConfigName: 'Brand New',
        saveInputValues: false,
        saveColumns: false
      })
    })
  })

  describe('autocomplete options', () => {
    it('should pass the overlay appendTo and panel style class through to the p-autocomplete', () => {
      const { component, fixture } = render({
        existingConfigs: configs,
        appendTo: 'self',
        panelStyleClass: 'sc-search-config-save-as-panel'
      })

      const autocomplete = fixture.debugElement.query(By.directive(AutoComplete)).componentInstance as AutoComplete
      expect(autocomplete.appendTo()).toBe('self')
      expect(autocomplete.panelStyleClass).toBe('sc-search-config-save-as-panel')
      // The form control drives the name field so the field is wired for editing (not prefilled).
      expect(field(component, 'searchConfigName').value).toBe('')
    })
  })

  describe('component harness (name field through the reworked p-autocomplete)', () => {
    // The name field is a `p-autocomplete` (driven by the `searchConfigName` form control), so the
    // harness drives it through the autocomplete's input rather than a plain input; this pins the
    // `getSearchConfigInputHarness` helper against the reworked dialog.
    it('should resolve the name field via the harness and reflect a typed name in the form control', async () => {
      const hostFixture = TestBed.createComponent(SaveAsDialogHostComponent)
      const component = hostFixture.debugElement.children[0]
        .componentInstance as CreateOrEditSearchConfigDialogComponent
      component.existingConfigs = configs
      hostFixture.detectChanges()

      const harness = await TestbedHarnessEnvironment.documentRootLoader(hostFixture).getHarness(
        CreateOrEditSearchConfigDialogHarness
      )
      const nameInput = await harness.getSearchConfigInputHarness()

      expect(await nameInput.getValue()).toBe('')
      await nameInput.setValue('Alpha')
      hostFixture.detectChanges()

      // The typeahead autocomplete lands the keystroke in the form control, so the typed name is what
      // the overwrite-match and dialog-result logic read.
      expect(field(component, 'searchConfigName').value).toBe('Alpha')
      expect(component.matchedConfigId).toBe('alpha')
    })
  })
})
