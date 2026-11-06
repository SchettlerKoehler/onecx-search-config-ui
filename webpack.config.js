const webpack = require('webpack')
const { ModifySourcePlugin, ReplaceOperation } = require('modify-source-webpack-plugin')
const { ModuleFederationPlugin } = require('@module-federation/enhanced/webpack')
const { getOneCXSharedRecommendations } = require('@onecx/build-utils')

const packageJson = require('./package.json')

// Shared package list for the module federation container. Uses the OneCX
// recommended sharing per top-level dependency (onecx shell v3 / Angular 21).
// `@angular/common/http` is shared explicitly (the app imports it) and, like the
// v7 config, must be a single instance shared with the shell.
const shared = {}
for (const libName of Object.keys(packageJson.dependencies)) {
  const config = getOneCXSharedRecommendations(libName, {
    requiredVersion: packageJson.dependencies[libName],
    shareScope: 'angular_21'
  })
  if (config !== false) shared[libName] = config
}
shared['@angular/common/http'] = { requiredVersion: 'auto', shareScope: 'angular_21' }

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
