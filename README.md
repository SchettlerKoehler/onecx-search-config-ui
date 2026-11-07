# onecx-search-config-ui

OneCX Search Config Ui

## Search-config styling

The global stylesheet (`src/styles.scss`) owns the `--onecx-search-config-*` design tokens and the
search header's custom styles.

**Rule: PrimeNG tokens or `--onecx-search-config-*` only, in `styles.scss`.** Every custom value must
be a PrimeNG design token (a `--p-*` variable) or one of the `--onecx-search-config-*` variables defined
in the `:root` block in `src/styles.scss`. Hard-coded colors or sizes are not allowed. Custom styles
are scoped to the remote's host element (`ocx-search-config-component` / `ocx-column-group-selection-component`)
or to stable `styleClass` / `panelStyleClass` hooks and fixed button ids — never `::ng-deep`, never
unscoped global selectors. Remotes inherit the host theme and set no theme of their own.

### `--onecx-search-config-*` variables

| Variable | Purpose | Value |
| --- | --- | --- |
| `--onecx-search-config-width` | Width of the whole header input group (config select + joined Save As button). | `18rem` (app-owned; PrimeNG has no width token for the input group) |
| `--onecx-search-config-height` | Height of the config select control and the joined Save As button. | `2.5rem` (app-owned; PrimeNG sizes the control from padding, not a height token) |
| `--onecx-search-config-radius` | Corner radius of the config select control. | `var(--p-select-border-radius)` |
| `--onecx-search-config-border-color` | Border color of the config select control. | `var(--p-select-border-color)` |
| `--onecx-search-config-panel-max-height` | Maximum height of the opened option list before it scrolls. | `20rem` (app-owned layout cap) |
| `--onecx-search-config-delete-color` | Color of the per-row delete (trash) icon. | `var(--p-button-danger-background)` (PrimeNG danger/red) |
| `--onecx-search-config-delete-hover-background` | Light-red background behind the trash icon on hover. | `var(--p-button-text-danger-active-background)` |
| `--onecx-search-config-modified-marker-color` | Color of the "modified" marker on a config row. | `var(--p-button-text-warn-color)` |
| `--onecx-search-config-group-header-color` | Color of a config option-group header in the list. | `var(--p-select-option-group-color)` |
| `--onecx-search-config-dialog-width` | Width of the reusable delete-confirm dialog (applied via `PortalDialogConfig.width`). | `30rem` (app-owned) |

The per-row delete (trash) icon is the PrimeNG `text` + `danger` severity button; its red colour and
light-red hover background are sourced from `--onecx-search-config-delete-color` and
`--onecx-search-config-delete-hover-background`, which drive the button through scoped
`--p-button-text-danger-*` token overrides on the trash hook. The delete-confirm dialog is portaled
outside the remote element; it carries the remote's `data-style-id`, so the host's scoped styling
reaches it. Its Delete button's fixed id (`ocx-search-config-delete-button`) is the stable test and
style anchor; its red look comes from `severity: 'danger'`, i.e. the `--p-button-danger-*` tokens. The
"Saved searches" section is delivered in a later ticket (#964).
