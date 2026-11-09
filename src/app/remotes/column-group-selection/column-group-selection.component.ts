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
import { BehaviorSubject, ReplaySubject, Subscription, combineLatest, debounceTime, map, withLatestFrom } from 'rxjs'

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
import {
  ColumnGroupSelectOption,
  ColumnSelectionViewModel,
  SearchConfigStore
} from 'src/app/shared/search-config.store'
import { COLUMN_GROUP_SAVE_AS_BUTTON_ID, SEARCH_CONFIG_AUTOCOMPLETE_PANEL_STYLE_CLASS } from 'src/app/shared/constants'
import { confirmAndDeleteSearchConfig } from 'src/app/shared/search-config-delete'
import { loadSearchConfigInfos, saveSearchConfig } from 'src/app/shared/search-config-create'
import { hasColumns } from 'src/app/shared/search-config.utils'

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

  // The store emits raw i18n keys for the group headers and the predefined leaves (and the config's
  // own `name` for saved leaves); the labels are translated here, against `translateService.stream`, so
  // a language switch (or the remote translations arriving over HTTP) is reflected without any store
  // round-trip rather than being frozen at the moment of the last state change.
  readonly vm$ = combineLatest([
    this.searchConfigStore.columnSelectionVm$,
    this.translateService.stream(['COLUMN_GROUP_SELECTION.GROUPS.PREDEFINED', 'COLUMN_GROUP_SELECTION.GROUPS.SAVED'])
  ]).pipe(
    debounceTime(50),
    map(([raw, translations]) => {
      const t = translations as Record<string, string>
      return {
        ...raw,
        options: raw.options?.map((group) => ({
          ...group,
          label: t[group.label] ?? group.label,
          items: group.items.map((item) =>
            item.isPredefined ? { ...item, label: this.translateService.instant(item.value) } : item
          )
        }))
      }
    })
  )

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

  // The page name for this remote's own requests, read live from the store without persisting anything:
  // the header's `pageName` wins the moment it arrives (the store is the shared source of truth),
  // otherwise a fallback derived from the application path. Because this is a live selector — not a
  // snapshot taken once at construction — the load and Save As both see the header's page name as soon
  // as it is delivered over the topic, and the fallback is never written to (or broadcast from) the
  // shared store. It is created once as a field and shared by both callers rather than being rebuilt
  // as a fresh selector on every `loadSearchConfigs()`/`onColumnGroupSaveAs()` call.
  readonly pageName$ = this.searchConfigStore.select((state) => state.pageName ?? getLocation().applicationPath)

  // Load the saved configs once the remote base url, the page name and the current MFE are all
  // available. The `!isSearchConfigComponentActive$` gate is projected inside the `switchMap`, so while
  // the search header remote is active (or becomes active) the column remote's request is cancelled and
  // its result discarded — only one of the two remotes performs the (same) GET, and a fallback-page
  // response can never overwrite the header's list.
  private loadSearchConfigs(): void {
    loadSearchConfigInfos(
      this.baseUrl,
      this.appStateService,
      this.searchConfigService,
      this.portalMessageService,
      this.pageName$,
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
    // The focused option carries its saved `config` on saved-config leaves and none on predefined (host
    // column group) leaves, so reading it here makes the keyboard path share the exact deletion rule the
    // template uses — no re-resolution by name, and predefined leaves can never be deleted even when
    // their key equals a saved config's name.
    const option = select.visibleOptions()[focusedIndex] as ColumnGroupSelectOption | undefined
    const config = option?.config
    if (this.canDelete(config)) {
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
  // the Save As dialog is opened with `saveColumns` pre-selected. The column option is not frozen here
  // (this entry point owns the column selector, so it is editable). The dialog, request and toasts live
  // in the shared `saveSearchConfig` helper (so both remotes open the same dialog); on success we upsert
  // the saved config into the store and select it (upsert, not add, so an overwrite replaces the stored
  // content in place). The header's current config is also re-pointed only when the saved config stores
  // columns, so a columns-only save surfaces in the header select.
  onColumnGroupSaveAs() {
    saveSearchConfig(
      this.portalDialogService,
      this.searchConfigService,
      this.portalMessageService,
      this.appStateService,
      this.searchConfigStore,
      this.pageName$,
      {
        existingConfigs: this.searchConfigStore.select((state) => state.searchConfigs),
        appendTo: 'self',
        panelStyleClass: SEARCH_CONFIG_AUTOCOMPLETE_PANEL_STYLE_CLASS,
        saveInputValues: false,
        saveColumns: true,
        frozeColumnSaveOption: false
      }
    ).subscribe((response) => {
      if (response?.id) {
        const config = response.configs.find((config) => config.id === response.id)
        setTimeout(() => {
          config && this.searchConfigStore.upsertSearchConfig(config)
        })
        setTimeout(() => {
          config && this.searchConfigStore.setSelectedGroupKey(config.name)
        })
        setTimeout(() => {
          config && hasColumns(config) && this.searchConfigStore.setCurrentConfig(config)
        })
      }
    })
  }
}
