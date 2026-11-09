# onecx-search-config-ui

OneCX Search Config Ui

## Search-config styling

The global stylesheet (`src/styles.scss`) owns the `--onecx-search-config-*` design tokens and both
remotes' custom styles (the search header and the column-group selector).

**Rule: PrimeNG tokens or `--onecx-search-config-*` only.** Every custom value must
be a PrimeNG design token (a `--p-*` variable) or one of the `--onecx-search-config-*` variables defined
in the `:root` block in `src/styles.scss`. Hard-coded colors or sizes are not allowed. Custom styles
are scoped to the remote's host element (`ocx-search-config-component` / `ocx-column-group-selection-component`)
or to stable `styleClass` / `panelStyleClass` hooks and fixed button ids — never `::ng-deep`, never
unscoped global selectors. Remotes inherit the host theme and set no theme of their own.

Remote-owned custom styles live in `src/styles.scss`. There is exactly one exception: a portaled
dialog (the Save As dialog) may carry a layout-only component stylesheet
(`create-or-edit-search-config-dialog.component.scss`). Because the dialog is portaled outside the
remote element, it cannot reach the remote's host-scoped rules, so its own stylesheet lays out its
form (a column of stacked blocks) using PrimeNG tokens (`var(--p-confirmdialog-content-gap)`,
`var(--p-button-gap)`) for its gaps. It is layout only: no hard-coded sizes, no `::ng-deep`, and every
value is a PrimeNG token or a `--onecx-search-config-*` variable — the same rule as `styles.scss`.

### `--onecx-search-config-*` variables

| Variable | Purpose | Value |
| --- | --- | --- |
| `--onecx-search-config-width` | Width of the whole header input group (config select + joined Save As button). | `18rem` (app-owned; PrimeNG has no width token for the input group) |
| `--onecx-search-config-height` | Height of the config select control and the joined Save As button. | `2.5rem` (app-owned; PrimeNG sizes the control from padding, not a height token) |
| `--onecx-search-config-radius` | Corner radius of the config select control. | `var(--p-select-border-radius)` |
| `--onecx-search-config-border-color` | Border color of the config select control — **reserved for a later ticket**: no selector reads it yet, so it is not applied. | `var(--p-select-border-color)` |
| `--onecx-search-config-panel-max-height` | Maximum height of the opened option list before it scrolls. | `16rem` (app-owned layout cap) |
| `--onecx-search-config-delete-color` | Color of the per-row delete (trash) icon. | `var(--p-button-danger-background)` (PrimeNG danger/red) |
| `--onecx-search-config-delete-hover-background` | Light-red background behind the trash icon on hover. | `var(--p-button-text-danger-hover-background)` |
| `--onecx-search-config-modified-marker-color` | Color of the `*` marker next to a modified config's name (option row and collapsed label). | `var(--p-button-text-warn-color)` |
| `--onecx-search-config-group-header-color` | Color of a config option-group header in the list. | `var(--p-select-option-group-color)` |
| `--onecx-search-config-dialog-width` | Width of the reusable delete-confirm and Save As dialogs (applied via `PortalDialogConfig.width`). | `30rem` (app-owned) |

The per-row delete (trash) icon is the PrimeNG `text` + `danger` severity button; its red colour and
light-red hover background are sourced from `--onecx-search-config-delete-color` and
`--onecx-search-config-delete-hover-background`, which drive the button through scoped
`--p-button-text-danger-*` token overrides on the trash hook. Both the delete-confirm and the Save As
dialogs are portaled outside the remote element; each carries the remote's `data-style-id`, so the
host's scoped styling reaches it. The delete-confirm dialog's Delete button has a fixed id
(`ocx-search-config-delete-button`) as the stable test and style anchor; its red look comes from
`severity: 'danger'`, i.e. the `--p-button-danger-*` tokens. The Save As dialog's autocomplete
suggestions panel targets the `sc-search-config-save-as-panel` style hook via `panelStyleClass`. The
Save As dialog's overwrite warning (shown when the typed name already exists and the save would
overwrite an existing config) is a PrimeNG `p-message` with the stable anchor class
`sc-search-config-overwrite-warning`, carried as the element's `class` so tests and styles can target
it directly. The "Saved searches" section is delivered in a later ticket (#964).
