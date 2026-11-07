import { ComponentFixture, TestBed } from '@angular/core/testing'
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { ReactiveFormsModule } from '@angular/forms'
import { TranslateService } from '@ngx-translate/core'

import { CheckboxModule } from 'primeng/checkbox'
import { InputTextModule } from 'primeng/inputtext'

import { DialogState } from '@onecx/angular-accelerator'
import { provideTranslateTestingService } from '@onecx/angular-testing'

import { CreateOrEditSearchConfigDialogComponent } from './create-or-edit-search-config-dialog.component'

describe('CreateOrEditSearchConfigDialogComponent', () => {
  let component: CreateOrEditSearchConfigDialogComponent
  let fixture: ComponentFixture<CreateOrEditSearchConfigDialogComponent>
  let translateService: TranslateService

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [],
      imports: [CheckboxModule, CreateOrEditSearchConfigDialogComponent, ReactiveFormsModule, InputTextModule],
      providers: [
        ...provideTranslateTestingService({
          en: require('../../../../assets/i18n/en.json'),
          de: require('../../../../assets/i18n/de.json')
        }),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
      ]
    }).compileComponents()

    fixture = TestBed.createComponent(CreateOrEditSearchConfigDialogComponent)
    component = fixture.componentInstance

    translateService = TestBed.inject(TranslateService)
    translateService.setFallbackLang('en')
    translateService.use('en')

    fixture.detectChanges()
  })

  it('should create the component', () => {
    expect(component).toBeTruthy()
  })

  it('should disable saveColumns control if freeze set to true', () => {
    component.frozeColumnSaveOption = true
    expect(component.searchConfigFormGroup.controls['saveColumns'].disabled).toBeTruthy()

    component.frozeColumnSaveOption = false
    expect(component.searchConfigFormGroup.controls['saveColumns'].disabled).toBeFalsy()
  })

  it('should set frozeColumnSaveOptionExplanation to empty string when undefined is provided', () => {
    component.frozeColumnSaveOptionExplanation = undefined

    expect(component.frozeColumnSaveOptionExplanation).toBe('')
  })

  it('should set frozeColumnSaveOption to false when undefined is provided', () => {
    component.frozeColumnSaveOption = undefined

    expect(component.frozeColumnSaveOption).toBe(false)
    expect(component.searchConfigFormGroup.controls['saveColumns'].disabled).toBeFalsy()
  })

  it('should set form values through inputs', () => {
    component.searchConfigName = 'my-config'
    component.saveInputValues = true
    component.saveColumns = true

    expect(component.searchConfigFormGroup.get('searchConfigName')?.value).toBe('my-config')
    expect(component.searchConfigFormGroup.get('saveInputValues')?.value).toBe(true)
    expect(component.searchConfigFormGroup.get('saveColumns')?.value).toBe(true)
  })

  it('should set dialog result from current form values when confirm button is clicked', () => {
    const state: DialogState<CreateOrEditSearchConfigDialogComponent> = {
      button: 'primary',
      result: undefined
    }

    component.searchConfigFormGroup.patchValue({
      searchConfigName: 'search Config',
      saveInputValues: true,
      saveColumns: false
    })

    component.ocxDialogButtonClicked(state)

    expect(component.dialogResult).toEqual({
      searchConfigName: 'search Config',
      saveInputValues: true,
      saveColumns: false
    })
  })

  it('should keep default values when form is empty', () => {
    const state: DialogState<CreateOrEditSearchConfigDialogComponent> = {
      button: 'primary',
      result: undefined
    }

    component.ocxDialogButtonClicked(state)

    expect(component.dialogResult).toEqual({
      searchConfigName: '',
      saveInputValues: false,
      saveColumns: false
    })
  })

  it('should emit true when the search config name is filled and at least one option is selected', () => {
    const enabledSpy = jest.fn()
    component.primaryButtonEnabled.subscribe(enabledSpy)

    component.searchConfigFormGroup.patchValue({
      searchConfigName: 'test',
      saveInputValues: true,
      saveColumns: false
    })

    expect(enabledSpy).toHaveBeenLastCalledWith(true)
  })

  it('should emit false when the name is empty or no option is selected', () => {
    const enabledSpy = jest.fn()
    component.primaryButtonEnabled.subscribe(enabledSpy)

    component.searchConfigFormGroup.patchValue({
      searchConfigName: '',
      saveInputValues: false,
      saveColumns: false
    })

    expect(enabledSpy).toHaveBeenLastCalledWith(false)
  })

  it('should handle undefined searchConfigFormGroup in ocxDialogButtonClicked', () => {
    component.searchConfigFormGroup = undefined as any

    const state: DialogState<CreateOrEditSearchConfigDialogComponent> = {
      button: 'primary',
      result: undefined
    }

    component.ocxDialogButtonClicked(state)

    expect(component.dialogResult).toEqual({
      searchConfigName: undefined,
      saveInputValues: undefined,
      saveColumns: undefined
    })
  })
})
