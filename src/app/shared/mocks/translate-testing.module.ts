import { TranslateLoader, TranslateModule, provideTranslateService } from '@ngx-translate/core'
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
 * It preserves the `withTranslations(translations).withDefaultLanguage(language)` API
 * the spec files use while backing `TranslateService` with the v17 provider factories.
 */
export class TranslateTestingModule {
  private translations: Translations = {}
  private defaultLanguage = 'en'

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

  get ngModule(): Type<TranslateModule> {
    return TranslateModule
  }

  get providers(): Provider[] {
    return provideTranslateService({
      loader: { provide: TranslateLoader, useValue: new TestTranslateLoader(this.translations) },
      lang: this.defaultLanguage,
      fallbackLang: this.defaultLanguage
    })
  }
}
