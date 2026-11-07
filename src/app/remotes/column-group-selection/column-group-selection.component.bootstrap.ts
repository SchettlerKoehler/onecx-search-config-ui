import { bootstrapRemoteComponent } from '@onecx/angular-webcomponents'

import { environment } from 'src/environments/environment'
import { OneCXColumnGroupSelectionComponent } from './column-group-selection.component'
import { columnGroupSelectionProviders } from './column-group-selection.component.providers'

bootstrapRemoteComponent(
  OneCXColumnGroupSelectionComponent,
  'ocx-column-group-selection-component',
  environment.production,
  [...columnGroupSelectionProviders(import.meta.url)]
).catch((err) => console.error(err))
