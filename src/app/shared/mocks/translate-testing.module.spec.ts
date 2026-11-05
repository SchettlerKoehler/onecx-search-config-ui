import { TestBed } from '@angular/core/testing'
import {
  MissingTranslationHandler,
  TranslateCompiler,
  TranslateParser,
  TranslateService,
  type MissingTranslationHandlerParams
} from '@ngx-translate/core'
import { firstValueFrom } from 'rxjs'

import { TranslateTestingModule } from './translate-testing.module'

class StubCompiler extends TranslateCompiler {
  compile(value: string): string {
    return `compiled:${value}`
  }

  compileTranslations(translations: Record<string, string>): Record<string, string> {
    return translations
  }
}

class StubParser extends TranslateParser {
  interpolate(expr: string): string {
    return `parsed:${expr}`
  }
}

class StubMissingTranslationHandler extends MissingTranslationHandler {
  handle(params: MissingTranslationHandlerParams): string {
    return `missing:${params.key}`
  }
}

describe('TranslateTestingModule', () => {
  it('should provide the v17 defaults and resolve translations when no builder is used', async () => {
    const module = TranslateTestingModule.withTranslations({ en: { hello: 'world' } }).withDefaultLanguage('en')

    TestBed.configureTestingModule({
      imports: [module],
      providers: module.providers
    })

    const compiler = TestBed.inject(TranslateCompiler)
    const parser = TestBed.inject(TranslateParser)
    const handler = TestBed.inject(MissingTranslationHandler)

    expect(compiler).toBeInstanceOf(TranslateCompiler)
    expect(parser).toBeInstanceOf(TranslateParser)
    // The v17 default handler implements (not extends) the abstract class, so only assert it exists.
    expect(handler).toBeDefined()
    const translateService = TestBed.inject(TranslateService)
    expect(await firstValueFrom(translateService.get('hello'))).toBe('world')
    // 'de' is known but has no translations, so switching to it drives the loader to its `?? {}`
    // fallback branch and yields an empty translation object.
    translateService.addLangs(['de'])
    expect(await firstValueFrom(translateService.use('de'))).toEqual({})
  })

  it('should provide the configured compiler, parser and missing-translation handler when the builders are used', () => {
    const compiler = new StubCompiler()
    const parser = new StubParser()
    const handler = new StubMissingTranslationHandler()
    const module = TranslateTestingModule.withTranslations({ en: { hello: 'world' } })
      .withDefaultLanguage('en')
      .withCompiler(compiler)
      .withParser(parser)
      .withMissingTranslationHandler(handler)

    TestBed.configureTestingModule({
      imports: [module],
      providers: module.providers
    })

    expect(TestBed.inject(TranslateCompiler)).toBe(compiler)
    expect(TestBed.inject(TranslateParser)).toBe(parser)
    expect(TestBed.inject(MissingTranslationHandler)).toBe(handler)
  })
})
