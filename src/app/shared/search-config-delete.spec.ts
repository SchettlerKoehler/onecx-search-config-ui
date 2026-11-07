import { PortalDialogService } from '@onecx/angular-accelerator'
import { PortalMessageService } from '@onecx/angular-integration-interface'

import { lastValueFrom, of, throwError } from 'rxjs'

import { SearchConfigAPIService, SearchConfigInfo } from 'src/app/shared/generated'
import { SEARCH_CONFIG_DELETE_BUTTON_ID } from './constants'
import { SEARCH_CONFIG_DIALOG_WIDTH, confirmAndDeleteSearchConfig } from './search-config-delete'

describe('confirmAndDeleteSearchConfig', () => {
  const config: SearchConfigInfo = {
    id: 'config-id',
    name: 'config-1',
    columns: ['col-1'],
    values: {
      k1: 'v1'
    },
    isReadonly: false,
    isAdvanced: false
  }

  let portalDialogService: PortalDialogService
  let searchConfigService: SearchConfigAPIService
  let messageService: PortalMessageService

  const openDialog = jest.fn()
  const deleteSearchConfig = jest.fn()
  const info = jest.fn()
  const success = jest.fn()
  const error = jest.fn()

  beforeEach(() => {
    openDialog.mockReset()
    deleteSearchConfig.mockReset()
    info.mockReset()
    success.mockReset()
    error.mockReset()

    portalDialogService = { openDialog } as unknown as PortalDialogService
    searchConfigService = { deleteSearchConfig } as unknown as SearchConfigAPIService
    messageService = { info, success, error } as unknown as PortalMessageService
  })

  const confirm = () =>
    confirmAndDeleteSearchConfig(
      portalDialogService,
      searchConfigService,
      messageService,
      config,
      SEARCH_CONFIG_DELETE_BUTTON_ID
    )

  it('should open the delete dialog with the fixed title, body, Delete id, danger severity, cancel and dialog width', async () => {
    openDialog.mockReturnValue(of(undefined))
    await lastValueFrom(confirm())

    expect(openDialog).toHaveBeenCalledTimes(1)
    expect(openDialog).toHaveBeenCalledWith(
      'SEARCH_CONFIG.DELETE_CONFIRM.HEADER',
      {
        key: 'SEARCH_CONFIG.DELETE_CONFIRM.MESSAGE',
        parameters: {
          config: config.name
        }
      },
      {
        key: 'SEARCH_CONFIG.DELETE_CONFIRM.DELETE',
        id: SEARCH_CONFIG_DELETE_BUTTON_ID,
        severity: 'danger'
      },
      'SEARCH_CONFIG.DELETE_DIALOG.CANCEL',
      { width: SEARCH_CONFIG_DIALOG_WIDTH }
    )
  })

  it('should delete the config and fire the success toast when the delete is confirmed', async () => {
    openDialog.mockReturnValue(of({ button: 'primary' } as any))
    deleteSearchConfig.mockReturnValue(of({} as any))

    const result = await lastValueFrom(confirm())

    expect(result).toBe(true)
    expect(deleteSearchConfig).toHaveBeenCalledWith(config.id)
    expect(success).toHaveBeenCalledWith({
      summaryKey: 'SEARCH_CONFIG.DELETE_CONFIRM.SUCCESS',
      summaryParameters: {
        config: config.name
      }
    })
    expect(error).not.toHaveBeenCalled()
  })

  it('should not delete the config when the dialog was closed without a button', async () => {
    openDialog.mockReturnValue(of(undefined as any))

    const result = await lastValueFrom(confirm())

    expect(result).toBe(false)
    expect(deleteSearchConfig).not.toHaveBeenCalled()
    expect(success).not.toHaveBeenCalled()
  })

  it('should not delete the config when the cancel (secondary) button was chosen', async () => {
    openDialog.mockReturnValue(of({ button: 'secondary' } as any))

    const result = await lastValueFrom(confirm())

    expect(result).toBe(false)
    expect(deleteSearchConfig).not.toHaveBeenCalled()
    expect(success).not.toHaveBeenCalled()
  })

  it('should report a failed delete and fire the error toast without reporting success', async () => {
    const consoleSpy = jest.spyOn(console, 'error')
    const failure = new Error('my-error-msg')
    openDialog.mockReturnValue(of({ button: 'primary' } as any))
    deleteSearchConfig.mockReturnValue(throwError(() => failure))

    const result = await lastValueFrom(confirm())

    expect(result).toBe(false)
    expect(success).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith({
      summaryKey: 'SEARCH_CONFIG.DELETE_FAILURE'
    })
    expect(consoleSpy).toHaveBeenCalledWith(failure)
    consoleSpy.mockRestore()
  })
})
