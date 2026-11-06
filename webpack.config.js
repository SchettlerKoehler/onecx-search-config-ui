const webpack = require('webpack')
const { ModifyEntryPlugin } = require('@angular-architects/module-federation/src/utils/modify-entry-plugin')
const { ModifySourcePlugin, ReplaceOperation } = require('modify-source-webpack-plugin')
const { share, withModuleFederationPlugin } = require('@angular-architects/module-federation/webpack')

const config = withModuleFederationPlugin({
  name: 'onecx-search-config-ui',
  filename: 'remoteEntry.js',
  exposes: {
    './OneCXSearchConfigComponent': 'src/app/remotes/search-config/search-config.component.main.ts',
    './OneCXColumnGroupSelectionComponent':
      'src/app/remotes/column-group-selection/column-group-selection.component.main.ts'
  },
  shared: share({
    '@angular/core': { requiredVersion: 'auto', includeSecondaries: true },
    '@angular/forms': { requiredVersion: 'auto', includeSecondaries: true },
    '@angular/common': {
      requiredVersion: 'auto',
      includeSecondaries: { skip: ['@angular/common/http/testing'] }
    },
    '@angular/common/http': {
      requiredVersion: 'auto',
      includeSecondaries: true
    },
    '@angular/router': { requiredVersion: 'auto', includeSecondaries: true },
    rxjs: { requiredVersion: 'auto', includeSecondaries: true },
    primeng: { requiredVersion: 'auto', includeSecondaries: true },
    '@ngx-translate/core': { requiredVersion: 'auto' },
    '@onecx/accelerator': { requiredVersion: 'auto', includeSecondaries: true },
    '@onecx/angular-accelerator': {
      requiredVersion: 'auto',
      includeSecondaries: true
    },
    '@onecx/angular-auth': {
      requiredVersion: 'auto',
      includeSecondaries: true
    },
    '@onecx/angular-remote-components': {
      requiredVersion: 'auto',
      includeSecondaries: true
    },
    '@onecx/angular-webcomponents': {
      requiredVersion: 'auto',
      includeSecondaries: true
    }
  })
})
config.devServer = { allowedHosts: 'all' }

const plugins = config.plugins.filter((plugin) => !(plugin instanceof ModifyEntryPlugin))

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
  ...config,
  plugins: [
    ...plugins,
    modifyPrimeNgPlugin,
    modifyMaterialPlugin,
    new webpack.DefinePlugin({
      ngDevMode: true
    })
  ],
  output: { uniqueName: 'onecx-search-config-ui', publicPath: 'auto' },
  experiments: { ...config.experiments, topLevelAwait: true },
  module: { ...config.module, parser: { javascript: { importMeta: false } } },
  optimization: { runtimeChunk: false, splitChunks: false }
}
