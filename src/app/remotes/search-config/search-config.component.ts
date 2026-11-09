import { AsyncPipe, Location } from '@angular/common'
import { Component, EventEmitter, Inject, Input, OnDestroy, ChangeDetectionStrategy, viewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { TranslateModule, TranslateService } from '@ngx-translate/core'
import { ReplaySubject, Subscription, debounceTime, withLatestFrom } from 'rxjs'

import { ButtonModule } from 'primeng/button'
import { PrimeIcons } from 'primeng/api'
import { Select, SelectModule } from 'primeng/select'
import { FloatLabelModule } from 'primeng/floatlabel'
import { InputGroupModule } from 'primeng/inputgroup'
import { InputGroupAddonModule } from 'primeng/inputgroupaddon'
import { TooltipModule } from 'primeng/tooltip'

import { AngularAcceleratorModule, SearchConfigData, PortalDialogService } from '@onecx/angular-accelerator'
import { AppStateService, PortalMessageService, UserService } from '@onecx/angular-integration-interface'
import {
  AngularRemoteComponentsModule,
  ocxRemoteComponent,
  ocxRemoteWebcomponent
} from '@onecx/angular-remote-components'
import { REMOTE_COMPONENT_CONFIG, RemoteComponentConfig } from '@onecx/angular-utils'

import { Configuration, SearchConfigAPIService, SearchConfigInfo } from 'src/app/shared/generated'
import { SearchConfigStore, SearchConfigViewModel, UnparsedFieldValues } from 'src/app/shared/search-config.store'
import {
  advancedViewMode,
  advancedViewModeType,
  basicViewMode,
  basicViewModeType,
  SEARCH_CONFIG_AUTOCOMPLETE_PANEL_STYLE_CLASS,
  SEARCH_CONFIG_SAVE_AS_BUTTON_ID
} from 'src/app/shared/constants'
import { hasColumns, hasValues } from 'src/app/shared/search-config.utils'
import { confirmAndDeleteSearchConfig } from 'src/app/shared/search-config-delete'
import { loadSearchConfigInfos, saveSearchConfig } from 'src/app/shared/search-config-create'
import { environment } from 'src/environments/environment'

@Component({
  selector: 'app-ocx-search-config',
  standalone: true,
  templateUrl: './search-config.component.html',
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
export class OneCXSearchConfigComponent implements ocxRemoteComponent, ocxRemoteWebcomponent, OnDestroy {
  hasValues = hasValues
  @Input() set pageName(pageName: string) {
    setTimeout(() => {
      this.searchConfigStore.setPageName(pageName)
    })
  }
  @Input() set currentFieldValues(values: UnparsedFieldValues) {
    setTimeout(() => {
      this.searchConfigStore.updateFieldValues(values)
    })
  }

  @Input() set viewMode(viewMode: basicViewModeType | advancedViewModeType) {
    setTimeout(() => {
      this.searchConfigStore.updateViewMode(viewMode)
    })
  }

  @Input() searchConfigSelected: EventEmitter<SearchConfigData | undefined> = new EventEmitter()

  readonly vm$ = this.searchConfigStore.searchConfigVm$.pipe(debounceTime(50))

  // The config select, read for the keyboard delete shortcut (see `onSearchConfigSelectKeydown`).
  readonly select = viewChild(Select)

  currentConfigSub: Subscription | undefined

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
    this.userService.lang$.subscribe((lang) => {
      this.translateService.use(lang)
    })

    // Load the saved configs once the remote base url, the store's page name and the current MFE are
    // all available. The header always loads (no guard); a failed request fires an error toast and
    // stores no configs.
    loadSearchConfigInfos(
      this.baseUrl,
      this.appStateService,
      this.searchConfigService,
      this.portalMessageService,
      this.searchConfigStore.pageName$
    ).subscribe((searchConfigs) => {
      setTimeout(() => {
        this.searchConfigStore.setSearchConfigs(searchConfigs)
      })
    })

    this.currentConfigSub = this.searchConfigStore.currentConfig$
      .pipe(
        debounceTime(50),
        withLatestFrom(
          this.searchConfigStore.currentDisplayedData$,
          this.searchConfigStore.isColumnGroupComponentActive$
        )
      )
      .subscribe(([config, currentData, isColumnGroupActive]) => {
        let viewMode = currentData.viewMode ?? basicViewMode

        if (config && hasValues(config)) {
          viewMode = config.isAdvanced ? advancedViewMode : basicViewMode
        }

        this.searchConfigSelected.emit(
          config
            ? {
                name: config.name,
                fieldValues: hasValues(config) ? config.values : (currentData.fieldValues ?? {}),
                displayedColumnsIds:
                  hasColumns(config) && isColumnGroupActive ? config.columns : currentData.displayedColumnsIds,
                viewMode
              }
            : undefined
        )
      })
  }
  ngOnDestroy(): void {
    this.currentConfigSub?.unsubscribe()
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

  onSearchConfigChange(value: SearchConfigInfo) {
    setTimeout(() => {
      this.searchConfigStore.setCurrentConfig(value)
    })
  }

  onSearchConfigSave(vm: SearchConfigViewModel) {
    // The selection is not cleared up front so a cancelled or failed save leaves the current
    // selection intact in the select.

    let frozeColumnSaveOptionExplanation = ''

    if (!vm.isColumnGroupComponentActive) {
      frozeColumnSaveOptionExplanation = 'SEARCH_CONFIG.COLUMN_GROUP_COMPONENT_INACTIVE'
    } else if (vm.layout !== 'table') {
      frozeColumnSaveOptionExplanation = 'SEARCH_CONFIG.TABLE_VIEW_INACTIVE'
    }

    // The dialog, request and toasts live in the shared `saveSearchConfig` helper (so both remotes
    // open the same Save As dialog); on success we upsert the saved config into the store and select
    // it (upsert, not add, so an overwrite replaces the stored content in place). The header's
    // pre-check seeds "Save search criteria" (`saveInputValues: true`); the columns option is frozen
    // while the column selector is absent or the layout is not a table.
    saveSearchConfig(
      this.portalDialogService,
      this.searchConfigService,
      this.portalMessageService,
      this.appStateService,
      this.searchConfigStore,
      this.searchConfigStore.pageName$,
      {
        existingConfigs: this.searchConfigStore.select((state) => state.searchConfigs),
        appendTo: 'self',
        panelStyleClass: SEARCH_CONFIG_AUTOCOMPLETE_PANEL_STYLE_CLASS,
        saveInputValues: true,
        saveColumns: false,
        frozeColumnSaveOption: !(vm.isColumnGroupComponentActive && vm.layout === 'table'),
        frozeColumnSaveOptionExplanation
      }
    ).subscribe((response) => {
      if (response?.id) {
        const config = response.configs.find((config) => config.id === response.id)
        setTimeout(() => {
          config && this.searchConfigStore.upsertSearchConfig(config)
        })
        setTimeout(() => {
          config && this.searchConfigStore.setCurrentConfig(config)
        })
      }
    })
  }

  // Structural directives (ocxIfPermission/ngIf) are not rendered inside PrimeNG's #item template,
  // so the delete affordance is gated by this helper: the SEARCHCONFIG#DELETE permission plus the
  // read-only flag. Read-only or un-privileged rows render no trash button.
  canDelete(searchConfig: SearchConfigInfo) {
    return this.permissions.includes('SEARCHCONFIG#DELETE') && !searchConfig.isReadonly
  }

  // Whether at least one listed option is deletable; the screen-reader delete-key hint is rendered
  // (and wired to the combobox via `aria-describedby`) only when there is a deletable option.
  hasDeletableConfig(searchConfigs: SearchConfigInfo[]) {
    return searchConfigs.some((searchConfig) => this.canDelete(searchConfig))
  }

  onSearchConfigDelete(searchConfig: SearchConfigInfo) {
    // The dialog, delete call and toasts live in the shared `confirmAndDeleteSearchConfig` helper; on
    // success we just remove the deleted config from the store.
    confirmAndDeleteSearchConfig(
      this.portalDialogService,
      this.searchConfigService,
      this.portalMessageService,
      searchConfig
    ).subscribe((deleted) => {
      if (deleted) {
        setTimeout(() => {
          this.searchConfigStore.deleteSearchConfig(searchConfig)
        })
      }
    })
  }

  // Keyboard delete path (WCAG 2.1.1): PrimeNG keeps focus on the select combobox and moves between
  // options with `aria-activedescendant`, so Tab never reaches the trash button nested inside a row.
  // The handler is bound on the `p-select` host, so it also receives keydown bubbled up from the
  // filter input (PrimeNG autofocuses it when the panel opens); only act on the Delete pressed on the
  // combobox itself so editing the filter text never triggers a delete. PrimeNG's own Delete handler
  // is a no-op here (`showClear` is not set) and does not stop the event, so this fires after it.
  onSearchConfigSelectKeydown(event: KeyboardEvent): void {
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
    const option = select.visibleOptions()[focusedIndex] as SearchConfigInfo | undefined
    if (option && this.canDelete(option)) {
      event.preventDefault()
      this.onSearchConfigDelete(option)
    }
  }
}
