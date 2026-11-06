const webpack = require('webpack')
const { ModifySourcePlugin, ReplaceOperation } = require('modify-source-webpack-plugin')
const { ModuleFederationPlugin } = require('@module-federation/enhanced/webpack')
const { getOneCXSharedLibraryConfig } = require('@onecx/build-utils')

const packageJson = require('./package.json')

// Shared package list for the module federation container. Built from the OneCX
// recommended shared library config (onecx shell v3 / Angular 21); with sub-package
// generation on, this also emits each dependency's secondary entry points (e.g.
// primeng/button, @angular/common/http) into the shared scope.
const shared = getOneCXSharedLibraryConfig(packageJson.dependencies, true)

const modifyPrimeNgPlugin = new ModifySourcePlugin({
  rules: [
    {
      test: (module) => {
        return module.resource?.includes('primeng')
      },
      operations: [
        new ReplaceOperation(
          'all',
          String.raw`document\.createElement\(([^)]+)\)`,
          'document.createElementFromPrimeNg({"this": this, "arguments": Array.from(arguments), element: $1})'
        ),
        new ReplaceOperation('all', 'Theme.setLoadedStyleName', '(function(_){})')
      ]
    }
  ]
})

const modifyMaterialPlugin = new ModifySourcePlugin({
  rules: [
    {
      test: (module) => {
        return (
          module.resource && (module.resource.includes('@angular/material') || module.resource.includes('@angular/cdk'))
        )
      },
      operations: [
        new ReplaceOperation(
          'all',
          String.raw`document\.createElement\(`,
          'document.createElementFromMaterial({"this": this, "arguments": Array.from(arguments)},'
        )
      ]
    }
  ]
})

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'onecx-search-config-ui',
      filename: 'remoteEntry.js',
      library: { type: 'module' },
      shareScope: 'angular_21',
      exposes: {
        './OneCXSearchConfigComponent': 'src/app/remotes/search-config/search-config.component.main.ts',
        './OneCXColumnGroupSelectionComponent':
          'src/app/remotes/column-group-selection/column-group-selection.component.main.ts'
      },
      shared
    }),
    modifyPrimeNgPlugin,
    modifyMaterialPlugin,
    new webpack.DefinePlugin({
      ngDevMode: true
    })
  ],
  devServer: { allowedHosts: 'all' },
  output: { uniqueName: 'onecx-search-config-ui', publicPath: 'auto' },
  experiments: { topLevelAwait: true, outputModule: true },
  module: { parser: { javascript: { importMeta: false } } },
  optimization: { runtimeChunk: false, splitChunks: false }
}
