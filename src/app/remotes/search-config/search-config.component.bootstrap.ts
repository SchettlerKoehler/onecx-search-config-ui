import { bootstrapRemoteComponent } from '@onecx/angular-webcomponents'

import { environment } from 'src/environments/environment'
import { OneCXSearchConfigComponent } from './search-config.component'
import { searchConfigProviders } from './search-config.component.providers'

bootstrapRemoteComponent(OneCXSearchConfigComponent, 'ocx-search-config-component', environment.production, [
  ...searchConfigProviders(import.meta.url)
]).catch((err) => console.error(err))
