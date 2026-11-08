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
import { BehaviorSubject, ReplaySubject, Subscription, debounceTime, map, withLatestFrom } from 'rxjs'

import { PrimeIcons } from 'primeng/api'
import { ButtonModule } from 'primeng/button'
import { FloatLabelModule } from 'primeng/floatlabel'
import { InputGroupAddonModule } from 'primeng/inputgroupaddon'
import { InputGroupModule } from 'primeng/inputgroup'
import { Select, SelectModule } from 'primeng/select'
import { TooltipModule } from 'primeng/tooltip'

import { getLocation } from '@onecx/accelerator'
import {
  AngularAcceleratorModule,
  ColumnGroupData,
  DataTableColumn,
  PortalDialogService
} from '@onecx/angular-accelerator'
import { AppStateService, PortalMessageService, UserService } from '@onecx/angular-integration-interface'
import {
  AngularRemoteComponentsModule,
  ocxRemoteComponent,
  ocxRemoteWebcomponent
} from '@onecx/angular-remote-components'
import { REMOTE_COMPONENT_CONFIG, RemoteComponentConfig } from '@onecx/angular-utils'

import { Configuration, SearchConfigAPIService, SearchConfigInfo } from 'src/app/shared/generated'
import { environment } from 'src/environments/environment'
import { ColumnSelectionViewModel, SearchConfigStore } from 'src/app/shared/search-config.store'
import { COLUMN_GROUP_SAVE_AS_BUTTON_ID } from 'src/app/shared/constants'
import { confirmAndDeleteSearchConfig } from 'src/app/shared/search-config-delete'
import {
  createSearchConfig,
  loadSearchConfigInfos,
  resolveStandalonePageName
} from 'src/app/shared/search-config-create'

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

  @Input() set pageName(pageName: string) {
    setTimeout(() => {
      this.searchConfigStore.setPageName(pageName)
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
  saveAsButtonId = COLUMN_GROUP_SAVE_AS_BUTTON_ID

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

  // The page name for this remote's own requests: the store's `pageName` once it is defined (a
  // header-provided page name always wins), otherwise a fallback derived from the application path.
  private resolvePageName() {
    return resolveStandalonePageName(this.searchConfigStore, getLocation().applicationPath)
  }

  // Load the saved configs once the remote base url, the page name and the current MFE are all
  // available. The load is skipped while the search header remote is active so only one of the two
  // remotes performs the (same) GET.
  private loadSearchConfigs(): void {
    loadSearchConfigInfos(
      this.baseUrl,
      this.appStateService,
      this.searchConfigService,
      this.portalMessageService,
      this.resolvePageName(),
      this.searchConfigStore.isSearchConfigComponentActive$.pipe(map((active) => !active))
    ).subscribe((searchConfigs) => {
      setTimeout(() => {
        this.searchConfigStore.setSearchConfigs(searchConfigs)
      })
    })
  }

  // Whether the grouped config select has any selectable option: a host predefined column group or
  // a saved config that stores columns. When neither group has an item the select is disabled (the
  // same disabled empty state the search header select uses with no configs) rather than opening to
  // two empty group headers.
  hasOptions(vm: ColumnSelectionViewModel): boolean {
    return vm.nonSearchConfigGroupKeys.length > 0 || vm.searchConfigsWithColumns.length > 0
  }

  // The select's label shows the host-provided placeholder while nothing (or the host custom group)
  // is selected and the fixed "Column group" label once a predefined group or a saved config has been
  // picked.
  selectLabel(vm: ColumnSelectionViewModel): string {
    if (!vm.selectedGroupKey || (vm.customGroupKey && vm.selectedGroupKey === vm.customGroupKey)) {
      return this.placeholderKey || 'COLUMN_GROUP_SELECTION.SELECT.PLACEHOLDER'
    }
    return 'COLUMN_GROUP_SELECTION.LABEL'
  }

  onColumnGroupChange(key: string) {
    setTimeout(() => {
      this.searchConfigStore.setSelectedGroupKey(key)
    })
  }

  // Whether the given (saved config) row renders a delete affordance: the SEARCHCONFIG#DELETE
  // permission plus the read-only flag. Predefined group rows resolve to no config and are never
  // deletable.
  canDelete(config: SearchConfigInfo | undefined): config is SearchConfigInfo {
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
    const state = this.searchConfigStore.state()
    const option = select.visibleOptions()[focusedIndex] as { value: string; isPredefined?: boolean } | undefined
    // Predefined (host column group) leaves are never deletable, even when their key equals a saved
    // config's name and the config would resolve by name.
    if (option?.isPredefined) {
      return
    }
    const config = state.searchConfigs.find((c) => c.name === option?.value)
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
  // the create dialog is opened with `saveColumns` pre-selected. The column option is not frozen — the
  // full save-options rework (freeze semantics) lands in #962. The dialog, request and toasts live in
  // the shared `createSearchConfig` helper (so both remotes open the same dialog); on success we just
  // add the created config to the store and select it.
  onColumnGroupSaveAs() {
    createSearchConfig(
      this.portalDialogService,
      this.searchConfigService,
      this.portalMessageService,
      this.appStateService,
      this.searchConfigStore,
      this.resolvePageName(),
      {
        searchConfigName: '',
        saveInputValues: false,
        saveColumns: true,
        frozeColumnSaveOption: false
      }
    ).subscribe((response) => {
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
}
