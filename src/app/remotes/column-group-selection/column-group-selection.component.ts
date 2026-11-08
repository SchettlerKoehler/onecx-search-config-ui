import { AsyncPipe, Location } from '@angular/common'
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  viewChild
} from '@angular/core'
import { FormsModule } from '@angular/forms'
import { TranslateModule, TranslateService } from '@ngx-translate/core'
import {
  BehaviorSubject,
  combineLatest,
  ReplaySubject,
  Subscription,
  catchError,
  debounceTime,
  map,
  mergeMap,
  of,
  withLatestFrom
} from 'rxjs'

import { PrimeIcons } from 'primeng/api'
import { ButtonModule } from 'primeng/button'
import { FloatLabelModule } from 'primeng/floatlabel'
import { InputGroupAddonModule } from 'primeng/inputgroupaddon'
import { InputGroupModule } from 'primeng/inputgroup'
import { Select, SelectModule } from 'primeng/select'
import { TooltipModule } from 'primeng/tooltip'

import {
  AngularAcceleratorModule,
  ColumnGroupData,
  DataTableColumn,
  PortalDialogService
} from '@onecx/angular-accelerator'
import { AppStateService, PortalMessageService, UserService } from '@onecx/angular-integration-interface'
import { MfeInfo } from '@onecx/integration-interface'
import {
  AngularRemoteComponentsModule,
  ocxRemoteComponent,
  ocxRemoteWebcomponent
} from '@onecx/angular-remote-components'
import { REMOTE_COMPONENT_CONFIG, RemoteComponentConfig } from '@onecx/angular-utils'

import {
  Configuration,
  CreateSearchConfigRequest,
  SearchConfigAPIService,
  SearchConfigInfo
} from 'src/app/shared/generated'
import { environment } from 'src/environments/environment'
import { ColumnSelectionViewModel, PageData, SearchConfigStore } from 'src/app/shared/search-config.store'
import {
  CreateOrEditSearchConfigDialogComponent,
  CreateOrEditSearchDialogContent
} from 'src/app/shared/components/create-or-edit-search-config-dialog/create-or-edit-search-config-dialog.component'
import { advancedViewMode, SEARCH_CONFIG_SAVE_AS_BUTTON_ID } from 'src/app/shared/constants'
import { parseFieldValues } from 'src/app/shared/search-config.utils'
import { confirmAndDeleteSearchConfig } from 'src/app/shared/search-config-delete'

@Component({
  selector: 'app-ocx-column-group-selection',
  standalone: true,
  templateUrl: './column-group-selection.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AngularRemoteComponentsModule,
    AsyncPipe,
    AngularAcceleratorModule,
    TranslateModule,
    FormsModule,
    ButtonModule,
    SelectModule,
    FloatLabelModule,
    InputGroupModule,
    InputGroupAddonModule,
    TooltipModule
  ]
})
export class OneCXColumnGroupSelectionComponent
  implements ocxRemoteComponent, ocxRemoteWebcomponent, OnInit, OnDestroy
{
  @Input() set selectedGroupKey(selectedGroupKey: string | undefined) {
    if (selectedGroupKey === undefined) return

    setTimeout(() => {
      this.searchConfigStore.setSelectedGroupKey(selectedGroupKey)
    })
  }

  @Input() set customGroupKey(key: string) {
    setTimeout(() => {
      this.searchConfigStore.setCustomGroupKey(key)
    })
  }

  @Input() set displayedColumnsIds(columns: string[]) {
    setTimeout(() => {
      this.searchConfigStore.updateDisplayedColumnsIds(columns)
    })
  }

  @Input()
  set layout(layout: 'table' | 'grid' | 'list') {
    setTimeout(() => {
      this.searchConfigStore.updateLayout(layout)
    })
  }

  @Input() groupSelectionChanged: EventEmitter<ColumnGroupData> = new EventEmitter()

  columns$ = new BehaviorSubject<DataTableColumn[]>([])
  @Input()
  get columns(): DataTableColumn[] {
    return this.columns$.getValue()
  }
  set columns(value: DataTableColumn[]) {
    this.columns$.next(value)
  }

  @Input() defaultGroupKey = ''
  @Input() placeholderKey = ''

  readonly vm$ = this.searchConfigStore.columnSelectionVm$.pipe(debounceTime(50))

  // The grouped config select, read for the row identity and the keyboard handlers.
  readonly select = viewChild(Select)

  selectedGroupKeySub: Subscription | undefined

  saveAsIcon = PrimeIcons.SAVE
  deleteIcon = PrimeIcons.TRASH
  saveAsButtonId = SEARCH_CONFIG_SAVE_AS_BUTTON_ID

  permissions: string[] = []

  constructor(
    @Inject(REMOTE_COMPONENT_CONFIG)
    private readonly baseUrl: ReplaySubject<RemoteComponentConfig>,
    private readonly userService: UserService,
    private readonly translateService: TranslateService,
    private readonly searchConfigService: SearchConfigAPIService,
    private readonly portalDialogService: PortalDialogService,
    private readonly portalMessageService: PortalMessageService,
    private readonly appStateService: AppStateService,
    private readonly searchConfigStore: SearchConfigStore
  ) {
    this.translateService.use(this.userService.lang$.getValue())

    this.loadSearchConfigs()

    this.selectedGroupKeySub = this.searchConfigStore.selectedGroupKey$
      .pipe(debounceTime(50), withLatestFrom(this.vm$))
      .subscribe(([selectedGroupKey, vm]: [string, ColumnSelectionViewModel]) => {
        const configWithColumns = vm.searchConfigsWithColumns.find((c) => c.name === selectedGroupKey)
        if (configWithColumns) {
          const activeColumns = this.columns.filter((c) => configWithColumns.columns.includes(c.id))
          this.groupSelectionChanged.emit({
            activeColumns,
            groupKey: selectedGroupKey
          })
        } else if (selectedGroupKey === vm.customGroupKey) {
          return
        } else if (vm.nonSearchConfigGroupKeys.includes(selectedGroupKey)) {
          const activeColumns = this.columns.filter((c) => c.predefinedGroupKeys?.includes(selectedGroupKey))
          this.groupSelectionChanged.emit({
            activeColumns,
            groupKey: selectedGroupKey
          })
        }
      })
  }

  ngOnDestroy(): void {
    this.selectedGroupKeySub?.unsubscribe()
  }

  ngOnInit() {
    this.columns$
      .pipe(
        map((columns) =>
          columns
            .flatMap((keys) => keys.predefinedGroupKeys || [])
            .concat([this.defaultGroupKey])
            .filter((value) => !!value)
            .filter((value, index, self) => self.indexOf(value) === index && value != null)
        )
      )
      .subscribe((groupKeys) => {
        setTimeout(() => {
          this.searchConfigStore.setNonSearchConfigGroupKeys(groupKeys)
        })
      })

    this.groupSelectionChanged.emit(undefined)
  }

  @Input() set ocxRemoteComponentConfig(config: RemoteComponentConfig) {
    this.ocxInitRemoteComponent(config)
  }

  ocxInitRemoteComponent(config: RemoteComponentConfig): void {
    this.searchConfigService.configuration = new Configuration({
      basePath: Location.joinWithSlash(config.baseUrl, environment.apiPrefix)
    })
    this.baseUrl.next(config)
    this.permissions = config.permissions
  }

  // Load the saved configs the same way the search header remote does: once the remote base url,
  // the store's page name and the current MFE are all available.
  private loadSearchConfigs(): void {
    combineLatest([this.baseUrl, this.searchConfigStore.pageName$, this.appStateService.currentMfe$.asObservable()])
      .pipe(
        mergeMap(([_, pageName, currentMfe]) => {
          return this.searchConfigService
            .getSearchConfigInfos({
              appId: currentMfe.appId,
              page: pageName,
              productName: currentMfe.productName
            })
            .pipe(map((response) => response.configs))
        })
      )
      .subscribe((searchConfigs) => {
        setTimeout(() => {
          this.searchConfigStore.setSearchConfigs(searchConfigs)
        })
      })
  }

  // Grouped options for the config select: the host-provided predefined column groups (never
  // deletable) plus the saved configs that store columns.
  getOptions(vm: ColumnSelectionViewModel) {
    return [
      {
        label: this.translateService.instant('COLUMN_GROUP_SELECTION.GROUPS.PREDEFINED'),
        value: 'predefined',
        items: vm.nonSearchConfigGroupKeys.map((key) => ({ label: key, value: key }))
      },
      {
        label: this.translateService.instant('COLUMN_GROUP_SELECTION.GROUPS.SAVED'),
        value: 'saved',
        items: vm.searchConfigsWithColumns.map((config) => ({
          label: config.name,
          value: config.name,
          isReadonly: config.isReadonly
        }))
      }
    ]
  }

  // The select's label shows the host-provided placeholder while nothing is selected and the fixed
  // "Column group" label once a group or config has been picked.
  selectLabel(vm: ColumnSelectionViewModel): string {
    if (!vm.selectedGroupKey) {
      return this.placeholderKey || 'COLUMN_GROUP_SELECTION.SELECT.PLACEHOLDER'
    }
    return 'COLUMN_GROUP_SELECTION.LABEL'
  }

  onColumnGroupChange(key: string) {
    setTimeout(() => {
      this.searchConfigStore.setSelectedGroupKey(key)
    })
  }

  private getConfigByName(vm: ColumnSelectionViewModel, key: string): SearchConfigInfo | undefined {
    return vm.searchConfigsWithColumns.find((c) => c.name === key)
  }

  // Whether the given (saved config) row renders a delete affordance: the SEARCHCONFIG#DELETE
  // permission plus the read-only flag. Predefined group rows resolve to no config and are never
  // deletable.
  canDelete(config: SearchConfigInfo | undefined): boolean {
    return !!config && this.permissions.includes('SEARCHCONFIG#DELETE') && !config.isReadonly
  }

  hasDeletableConfig(vm: ColumnSelectionViewModel): boolean {
    return vm.searchConfigsWithColumns.some((config) => this.canDelete(config))
  }

  // Keyboard delete path (WCAG 2.1.1), mirroring the search header remote: PrimeNG keeps focus on the
  // select combobox and moves between options with `aria-activedescendant`, so Tab never reaches the
  // trash button nested inside a row. Only a Delete pressed on the combobox itself (not the filter
  // input) acts, and only when the focused option is a deletable saved-config leaf — grouped headers
  // and predefined group leaves resolve to no config and no-op.
  onColumnGroupSelectKeydown(event: KeyboardEvent): void {
    const select = this.select()
    if (event.code !== 'Delete' || !select?.overlayVisible) {
      return
    }
    // Ignore the bubbled Delete of elements inside the overlay (notably the filter input) — the shortcut
    // only applies to the combobox itself.
    if (event.target !== select.focusInputViewChild?.nativeElement) {
      return
    }
    const focusedIndex = select.focusedOptionIndex()
    if (focusedIndex < 0) {
      return
    }
    const option = select.visibleOptions()[focusedIndex] as { value: string } | undefined
    const config = this.searchConfigStore.state().searchConfigs.find((c) => c.name === option?.value)
    if (config && this.canDelete(config)) {
      event.preventDefault()
      this.onColumnGroupDelete(config)
    }
  }

  onColumnGroupDelete(config: SearchConfigInfo) {
    // The dialog, delete call and toasts live in the shared `confirmAndDeleteSearchConfig` helper; on
    // success we just remove the deleted config from the store (matching the search header remote).
    confirmAndDeleteSearchConfig(
      this.portalDialogService,
      this.searchConfigService,
      this.portalMessageService,
      config
    ).subscribe((deleted) => {
      if (deleted) {
        setTimeout(() => {
          this.searchConfigStore.deleteSearchConfig(config)
        })
      }
    })
  }

  // Save As saves a NEW config that stores the currently displayed columns (never the input values):
  // the create dialog is opened with `saveColumns` pre-selected and the column option frozen.
  onColumnGroupSaveAs(vm: ColumnSelectionViewModel) {
    this.portalDialogService
      .openDialog<CreateOrEditSearchDialogContent>(
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CREATE_HEADER',
        {
          type: CreateOrEditSearchConfigDialogComponent,
          inputs: {
            searchConfigName: '',
            saveInputValues: false,
            saveColumns: true,
            frozeColumnSaveOption: false
          }
        },
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CONFIRM',
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CANCEL'
      )
      .pipe(
        withLatestFrom(
          this.appStateService.currentMfe$.asObservable(),
          this.searchConfigStore.currentPageData$,
          this.searchConfigStore.pageName$
        ),
        mergeMap(([dialogResult, currentMfe, pageData, pageName]) => {
          const result = dialogResult?.result
          if (!result) {
            return of(undefined)
          }
          if (dialogResult.button !== 'primary') {
            return of(undefined)
          }
          return this.saveSearchConfig(result, currentMfe, pageData, pageName)
        })
      )
      .subscribe((response) => {
        if (response?.id) {
          this.portalMessageService.info({
            summaryKey: 'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CREATE_SUCCESS'
          })
          const config = response.configs.find((config) => config.id === response.id)
          setTimeout(() => {
            config && this.searchConfigStore.addSearchConfig(config)
          })
          setTimeout(() => {
            config && this.searchConfigStore.setSelectedGroupKey(config.name)
          })
        }
      })
  }

  private saveSearchConfig(
    configData: CreateOrEditSearchDialogContent,
    currentMfe: MfeInfo,
    data: PageData,
    pageName: string
  ) {
    const request: CreateSearchConfigRequest = {
      appId: currentMfe.appId,
      productName: currentMfe.productName,
      fieldListVersion: 0,
      isReadonly: false,
      page: pageName,
      name: configData.searchConfigName ?? '',
      isAdvanced: configData.saveInputValues ? data.viewMode === advancedViewMode : false,
      columns: configData.saveColumns ? data.displayedColumnsIds : [],
      values: configData.saveInputValues ? parseFieldValues(data.fieldValues ?? {}) : {}
    }
    return this.searchConfigService.createSearchConfig(request).pipe(
      catchError((error) => {
        console.error(error)
        this.portalMessageService.error({
          summaryKey: 'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CREATE_FAILURE'
        })
        return of(undefined)
      })
    )
  }
}
