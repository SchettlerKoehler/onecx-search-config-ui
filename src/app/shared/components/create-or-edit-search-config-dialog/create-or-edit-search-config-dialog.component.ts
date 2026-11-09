import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject
} from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { TranslateModule, TranslateService } from '@ngx-translate/core'
import { Observable, startWith } from 'rxjs'

import { AutoCompleteCompleteEvent, AutoCompleteModule } from 'primeng/autocomplete'
import { CheckboxModule } from 'primeng/checkbox'
import { FloatLabelModule } from 'primeng/floatlabel'
import { MessageModule } from 'primeng/message'

import { DialogButtonClicked, DialogPrimaryButtonDisabled, DialogResult, DialogState } from '@onecx/angular-accelerator'

import { SearchConfigInfo } from 'src/app/shared/generated'

export type CreateOrEditSearchDialogContent = {
  searchConfigName: string
  saveInputValues: boolean
  saveColumns: boolean
  /**
   * Id of the existing, non-read-only config whose name the field resolves to (trimmed, case-insensitive),
   * or `undefined` when the typed name is new and a config is created instead.
   */
  matchedConfigId?: string
}
@Component({
  selector: 'app-ocx-create-or-edit-search-config-dialog',
  templateUrl: './create-or-edit-search-config-dialog.component.html',
  styleUrls: ['./create-or-edit-search-config-dialog.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateModule,
    FormsModule,
    ReactiveFormsModule,
    CheckboxModule,
    AutoCompleteModule,
    MessageModule,
    FloatLabelModule
  ]
})
export class CreateOrEditSearchConfigDialogComponent
  implements
    DialogPrimaryButtonDisabled,
    DialogResult<CreateOrEditSearchDialogContent>,
    DialogButtonClicked<CreateOrEditSearchConfigDialogComponent>,
    OnInit
{
  private readonly changeDetectorRef = inject(ChangeDetectorRef)
  private readonly translateService = inject(TranslateService)

  /** The page's saved configs; the non-read-only ones back the name field's suggestions. */
  @Input() existingConfigs: SearchConfigInfo[] = []

  /** PrimeNG overlay `appendTo` for the suggestions panel; the default `'self'` keeps it inside the dialog. */
  @Input() appendTo?: 'body' | 'self' | HTMLElement | null

  /** Stable hook for the suggestions panel, applied by the host through `data-style-id` scoping. */
  @Input() panelStyleClass?: string

  @Input()
  set saveInputValues(value: boolean | undefined) {
    this.searchConfigFormGroup.controls['saveInputValues'].setValue(value ?? false)
  }

  @Input()
  set saveColumns(value: boolean | undefined) {
    // The entry-point pre-check is ignored while the option is locked (see `frozeColumnSaveOption`):
    // the stored columns are kept, so the box is never pre-checked.
    if (!this._frozeColumnSaveOption) {
      this.searchConfigFormGroup.controls['saveColumns'].setValue(value ?? false)
    }
  }

  _frozeColumnSaveOption = false
  @Input()
  set frozeColumnSaveOption(value: boolean | undefined) {
    this._frozeColumnSaveOption = value ?? false
    if (value) {
      // While locked the box is forced off (its pre-check is ignored), disabled, and excluded from the
      // primary-button gate; the stored columns are kept by the store instead.
      this.searchConfigFormGroup.controls['saveColumns'].disable()
      this.searchConfigFormGroup.controls['saveColumns'].setValue(false, { emitEvent: true })
      this.recomputePrimaryButtonEnabled()
    } else {
      this.searchConfigFormGroup.controls['saveColumns'].enable()
    }
  }
  get frozeColumnSaveOption(): boolean {
    return this._frozeColumnSaveOption
  }

  _frozeColumnSaveOptionExplanation = ''
  @Input()
  set frozeColumnSaveOptionExplanation(value: string | undefined) {
    this._frozeColumnSaveOptionExplanation = value ?? ''
  }
  get frozeColumnSaveOptionExplanation(): string {
    return this._frozeColumnSaveOptionExplanation
  }

  @Output() primaryButtonEnabled: EventEmitter<boolean> = new EventEmitter()

  searchConfigFormGroup: FormGroup = new FormGroup({
    searchConfigName: new FormControl<string>(''),
    saveInputValues: new FormControl<boolean>(false),
    saveColumns: new FormControl<boolean>(false)
  })

  dialogResult: CreateOrEditSearchDialogContent = {
    searchConfigName: '',
    saveInputValues: false,
    saveColumns: false
  }

  private _matchedConfigId: string | undefined
  get matchedConfigId(): string | undefined {
    return this._matchedConfigId
  }

  private _configNames: string[] = []
  private _nameSuggestions: string[] = []
  /** The non-read-only config names (filtered by the typed query) fed to the `p-autocomplete` panel. */
  get nameSuggestions(): string[] {
    return this._nameSuggestions
  }

  /** Whether the name field currently matches an existing non-read-only config (an overwrite is pending). */
  get overwritePending(): boolean {
    return this.matchedConfigId !== undefined
  }

  /** The existing config the field resolves to (canonical name for the warning and the toast). */
  get matchedConfig(): SearchConfigInfo | undefined {
    return this.matchedConfigId ? this.existingConfigs.find((config) => config.id === this.matchedConfigId) : undefined
  }

  /**
   * The inline overwrite warning, naming the aspects being saved. Computed on demand (not through the
   * template `translate` pipe, which takes no parameter object) so the config name can be interpolated;
   * the form subscription's `markForCheck` keeps it reactive.
   *
   * When "Save columns" is locked the stored columns are kept, so the warning says the criteria are
   * replaced and the columns are kept — not that the columns are dropped.
   */
  get overwriteWarning(): string {
    const name = this.matchedConfig?.name
    if (!name) {
      return ''
    }
    const { saveInputValues, saveColumns } = this.searchConfigFormGroup.value
    if (this.frozeColumnSaveOption) {
      return this.translateService.instant('SEARCH_CONFIG.SAVE_AS_DIALOG.OVERWRITE_KEEP_COLUMNS', { name })
    }
    const key =
      saveInputValues && saveColumns
        ? 'SEARCH_CONFIG.SAVE_AS_DIALOG.OVERWRITE_BOTH'
        : saveColumns
          ? 'SEARCH_CONFIG.SAVE_AS_DIALOG.OVERWRITE_COLUMNS'
          : 'SEARCH_CONFIG.SAVE_AS_DIALOG.OVERWRITE_CRITERIA'
    return this.translateService.instant(key, { name })
  }

  ngOnInit(): void {
    this._configNames = (this.existingConfigs ?? []).filter((config) => !config.isReadonly).map((config) => config.name)
    this._nameSuggestions = this._configNames

    // The name field is a `typeahead` autocomplete, so every keystroke and each selected suggestion
    // lands in the form control. Re-deriving the match here — rather than relying on PrimeNG's debounced
    // `onComplete` — keeps the overwrite warning reactive in real time.
    this.searchConfigFormGroup.valueChanges
      .pipe(startWith(this.searchConfigFormGroup.value))
      .subscribe((values: CreateOrEditSearchDialogContent) => {
        this.primaryButtonEnabled.emit(this.primaryButtonEnabledFor(values))
        this._matchedConfigId = this.matchName(values.searchConfigName)
        this.changeDetectorRef.markForCheck()
      })
  }

  /** The `p-autocomplete` `completeMethod`: keep only the suggestions whose name contains the typed query. */
  onNameQuery(event: AutoCompleteCompleteEvent): void {
    const query = (event?.query ?? '').trim().toLowerCase()
    this._nameSuggestions = query
      ? this._configNames.filter((name) => name.toLowerCase().includes(query))
      : this._configNames
    this.changeDetectorRef.markForCheck()
  }

  ocxDialogButtonClicked(
    _state: DialogState<CreateOrEditSearchConfigDialogComponent>
  ): boolean | Observable<boolean> | Promise<boolean> | undefined {
    this.dialogResult = {
      searchConfigName: this.searchConfigFormGroup?.get('searchConfigName')?.value,
      saveInputValues: this.searchConfigFormGroup?.get('saveInputValues')?.value,
      saveColumns: this.searchConfigFormGroup?.get('saveColumns')?.value,
      matchedConfigId: this.matchedConfigId
    }
    return true
  }

  private recomputePrimaryButtonEnabled(): void {
    this.primaryButtonEnabled.emit(this.primaryButtonEnabledFor(this.searchConfigFormGroup.value))
  }

  private primaryButtonEnabledFor(values: CreateOrEditSearchDialogContent): boolean {
    // A non-empty name plus at least one checked box. While "Save columns" is locked it is forced off,
    // so only the criteria box can contribute in that case. The `!!` normalises the disabled
    // `saveColumns` control (absent from `formGroup.value` when disabled) to a strict boolean.
    return !!values.searchConfigName && !!(values.saveInputValues || values.saveColumns)
  }

  private matchName(name: string | undefined): string | undefined {
    const query = (name ?? '').trim().toLowerCase()
    if (!query) {
      return undefined
    }
    return this.existingConfigs.find((config) => !config.isReadonly && config.name.trim().toLowerCase() === query)?.id
  }
}
