import { AsyncPipe, Location } from '@angular/common'
import { Component, ElementRef, EventEmitter, Inject, Input, OnDestroy, ChangeDetectionStrategy } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { TranslateModule, TranslateService } from '@ngx-translate/core'
import {
  OperatorFunction,
  ReplaySubject,
  Subscription,
  catchError,
  combineLatest,
  debounceTime,
  filter,
  map,
  mergeMap,
  of,
  withLatestFrom
} from 'rxjs'

import { ButtonModule } from 'primeng/button'
import { PrimeIcons } from 'primeng/api'
import { SelectModule } from 'primeng/select'
import { FloatLabelModule } from 'primeng/floatlabel'
import { InputGroupModule } from 'primeng/inputgroup'
import { TooltipModule } from 'primeng/tooltip'

import { AngularAcceleratorModule, SearchConfigData, PortalDialogService } from '@onecx/angular-accelerator'
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
import {
  PageData,
  SearchConfigStore,
  SearchConfigViewModel,
  UnparsedFieldValues
} from 'src/app/shared/search-config.store'
import {
  CreateOrEditSearchConfigDialogComponent,
  CreateOrEditSearchDialogContent
} from 'src/app/shared/components/create-or-edit-search-config-dialog/create-or-edit-search-config-dialog.component'
import { advancedViewMode, advancedViewModeType, basicViewMode, basicViewModeType } from 'src/app/shared/constants'
import { hasColumns, hasValues, parseFieldValues } from 'src/app/shared/search-config.utils'
import { environment } from 'src/environments/environment'

/** Fixed id of the Delete button in the delete confirm dialog (reused by the column remote). */
export const SEARCH_CONFIG_DELETE_BUTTON_ID = 'ocx-search-config-delete-button'

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

  dataRevertSub: Subscription | undefined
  currentConfigSub: Subscription | undefined

  saveAsIcon = PrimeIcons.SAVE
  deleteIcon = PrimeIcons.TRASH
  deleteButtonId = SEARCH_CONFIG_DELETE_BUTTON_ID

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
    private readonly searchConfigStore: SearchConfigStore,
    private readonly hostElement: ElementRef<HTMLElement>
  ) {
    this.userService.lang$.subscribe((lang) => {
      this.translateService.use(lang)
    })

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

    this.dataRevertSub = this.searchConfigStore.dataToRevert$
      .pipe(
        debounceTime(20),
        filter((data: PageData | undefined) => data !== undefined) as OperatorFunction<PageData | undefined, PageData>
      )
      .subscribe((dataToRevert: PageData) => {
        if (!(dataToRevert.fieldValues && dataToRevert.viewMode)) return
        this.searchConfigSelected.emit({
          name: undefined,
          fieldValues: dataToRevert.fieldValues,
          displayedColumnsIds: dataToRevert.displayedColumnsIds,
          viewMode: dataToRevert.viewMode
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
    this.dataRevertSub?.unsubscribe()
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

  /** Overlay target: the panel renders inside this remote's element wherever the library allows. */
  get overlayAppendTo() {
    return this.hostElement.nativeElement
  }

  onSearchConfigChange(value: SearchConfigInfo) {
    setTimeout(() => {
      this.searchConfigStore.setCurrentConfig(value)
    })
  }

  onSearchConfigSave(vm: SearchConfigViewModel) {
    setTimeout(() => {
      this.searchConfigStore.setCurrentConfig(undefined)
    })

    let frozeColumnSaveOptionExplanation = ''

    if (!vm.isColumnGroupComponentActive) {
      frozeColumnSaveOptionExplanation = 'SEARCH_CONFIG.COLUMN_GROUP_COMPONENT_INACTIVE'
    } else if (vm.layout !== 'table') {
      frozeColumnSaveOptionExplanation = 'SEARCH_CONFIG.TABLE_VIEW_INACTIVE'
    }

    this.portalDialogService
      .openDialog<CreateOrEditSearchDialogContent>(
        'SEARCH_CONFIG.CREATE_EDIT_DIALOG.CREATE_HEADER',
        {
          type: CreateOrEditSearchConfigDialogComponent,
          inputs: {
            searchConfigName: '',
            saveInputValues: false,
            saveColumns: false,
            frozeColumnSaveOption: !(vm.isColumnGroupComponentActive && vm.layout === 'table'),
            frozeColumnSaveOptionExplanation
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

  onSearchConfigDelete(searchConfig: SearchConfigInfo) {
    // Reusable confirm dialog (title/body/buttons) so the column remote can open the same one unchanged.
    // The Delete button gets a fixed id and the danger look; the dialog carries the remote's data-style-id
    // automatically via PortalDialogService scope identifier.
    this.portalDialogService
      .openDialog(
        'SEARCH_CONFIG.DELETE_DIALOG.HEADER_QUESTION',
        {
          key: 'SEARCH_CONFIG.DELETE_DIALOG.DELETE_MESSAGE',
          parameters: {
            config: searchConfig.name
          }
        },
        {
          key: 'SEARCH_CONFIG.DELETE_DIALOG.DELETE',
          id: this.deleteButtonId,
          severity: 'danger'
        },
        'SEARCH_CONFIG.DELETE_DIALOG.CANCEL'
      )
      .pipe(
        mergeMap((dialogResult) => {
          if (!dialogResult) return of(undefined)
          if (dialogResult.button !== 'primary') {
            return of(undefined)
          }
          return this.deleteSearchConfig(searchConfig.id)
        })
      )
      .subscribe((result) => {
        if (result !== undefined) {
          this.portalMessageService.success({
            summaryKey: 'SEARCH_CONFIG.DELETE_CONFIG_SUCCESS',
            summaryParameters: {
              config: searchConfig.name
            }
          })
          setTimeout(() => {
            this.searchConfigStore.deleteSearchConfig(searchConfig)
          })
        }
      })
  }

  private deleteSearchConfig(id: string) {
    return this.searchConfigService.deleteSearchConfig(id).pipe(
      catchError((error) => {
        console.error(error)
        this.portalMessageService.error({
          summaryKey: 'SEARCH_CONFIG.DELETE_FAILURE'
        })
        return of(undefined)
      })
    )
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
