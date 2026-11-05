import {
  MissingTranslationHandler,
  TranslateCompiler,
  TranslateLoader,
  TranslateModule,
  TranslateParser,
  provideTranslateService,
  type RootTranslateServiceConfig
} from '@ngx-translate/core'
import type { Provider, Type } from '@angular/core'
import { of } from 'rxjs'

type Translations = Record<string, Record<string, any>>

class TestTranslateLoader extends TranslateLoader {
  constructor(private readonly translations: Translations) {
    super()
  }

  getTranslation(language: string) {
    return of(this.translations[language] ?? {})
  }
}

/**
 * Minimal, @ngx-translate/core v17-compatible stand-in for `ngx-translate-testing`,
 * whose latest published version depends on v15/v16-only APIs (`TranslateFakeCompiler`,
 * `FakeMissingTranslationHandler`) that were removed in v17. `@onecx` v7 requires
 * `@ngx-translate/core` ^17, so the original package is no longer resolvable here.
 * It preserves the `withTranslations`, `withDefaultLanguage`, `withCompiler`,
 * `withParser` and `withMissingTranslationHandler` builder API the spec files use
 * while backing `TranslateService` with the v17 provider factories. A builder
 * that is never called leaves the matching v17 default in place, so the two
 * builders every current spec actually relies on behave exactly as before.
 */
export class TranslateTestingModule {
  private translations: Translations = {}
  private defaultLanguage = 'en'
  private compiler?: TranslateCompiler
  private parser?: TranslateParser
  private missingTranslationHandler?: MissingTranslationHandler

  static withTranslations(translations: Translations): TranslateTestingModule {
    return new TranslateTestingModule().withTranslations(translations)
  }

  withTranslations(translations: Translations): TranslateTestingModule {
    this.translations = translations
    return this
  }

  withDefaultLanguage(language: string): TranslateTestingModule {
    this.defaultLanguage = language
    return this
  }

  withCompiler(compiler: TranslateCompiler): TranslateTestingModule {
    this.compiler = compiler
    return this
  }

  withParser(parser: TranslateParser): TranslateTestingModule {
    this.parser = parser
    return this
  }

  withMissingTranslationHandler(handler: MissingTranslationHandler): TranslateTestingModule {
    this.missingTranslationHandler = handler
    return this
  }

  get ngModule(): Type<TranslateModule> {
    return TranslateModule
  }

  get providers(): Provider[] {
    // Build the config key-by-key: `provideTranslateService` spreads the config over its own
    // defaults, so a key present with an `undefined` value would replace the matching v17
    // default (compiler/parser/missingTranslationHandler) and leave no provider behind.
    // Omitting a key keeps that default; only include the ones a builder actually set.
    const config: RootTranslateServiceConfig = {
      loader: { provide: TranslateLoader, useValue: new TestTranslateLoader(this.translations) },
      lang: this.defaultLanguage,
      fallbackLang: this.defaultLanguage
    }
    if (this.compiler) {
      config.compiler = { provide: TranslateCompiler, useValue: this.compiler }
    }
    if (this.parser) {
      config.parser = { provide: TranslateParser, useValue: this.parser }
    }
    if (this.missingTranslationHandler) {
      config.missingTranslationHandler = {
        provide: MissingTranslationHandler,
        useValue: this.missingTranslationHandler
      }
    }
    return provideTranslateService(config)
  }
}
