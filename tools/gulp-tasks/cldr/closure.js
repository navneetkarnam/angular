/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

const fs = require('fs');
const yargs = require('yargs').argv;
const {I18N_FOLDER, I18N_DATA_FOLDER, RELATIVE_I18N_DATA_FOLDER, HEADER} = require('./extract');
const OUTPUT_NAME = `closure-locale.ts`;

module.exports = (gulp, done) => {
  // the locales used by closure that will be used to generate the closure-locale file
  // extracted from:
  // https://github.com/google/closure-library/blob/master/closure/goog/i18n/datetimepatterns.js#L2136
  let GOOG_LOCALES = [
    'af',    'am',    'ar',    'ar-DZ', 'az',    'be',    'bg',    'bn',     'br',    'bs',
    'ca',    'chr',   'cs',    'cy',    'da',    'de',    'de-AT', 'de-CH',  'el',    'en-AU',
    'en-CA', 'en-GB', 'en-IE', 'en-IN', 'en-SG', 'en-ZA', 'es',    'es-419', 'es-MX', 'es-US',
    'et',    'eu',    'fa',    'fi',    'fr',    'fr-CA', 'ga',    'gl',     'gsw',   'gu',
    'haw',   'hi',    'hr',    'hu',    'hy',    'in',    'is',    'it',     'iw',    'ja',
    'ka',    'kk',    'km',    'kn',    'ko',    'ky',    'ln',    'lo',     'lt',    'lv',
    'mk',    'ml',    'mn',    'mo',    'mr',    'ms',    'mt',    'my',     'ne',    'nl',
    'no',    'or',    'pa',    'pl',    'pt',    'pt-PT', 'ro',    'ru',     'sh',    'si',
    'sk',    'sl',    'sq',    'sr',    'sv',    'sw',    'ta',    'te',     'th',    'tl',
    'tr',    'uk',    'ur',    'uz',    'vi',    'zh',    'zh-CN', 'zh-HK',  'zh-TW', 'zu'
  ];

  // locale id aliases to support deprecated locale ids used by closure
  // it maps deprecated ids --> new ids
  // manually extracted from ./cldr-data/supplemental/aliases.json
  const ALIASES = {
    'in': 'id',
    'iw': 'he',
    'mo': 'ro-MD',
    'no': 'nb',
    'nb': 'no-NO',
    'sh': 'sr-Latn',
    'tl': 'fil',
    'pt': 'pt-BR',
    'zh-CN': 'zh-Hans-CN',
    'zh-Hans-CN': 'zh-Hans',
    'zh-HK': 'zh-Hant-HK',
    'zh-Hant-HK': 'zh-Hant',
    'zh-TW': 'zh-Hant-TW',
    'zh-Hant-TW': 'zh-Hant'
  };

  if (yargs.locales) {
    GOOG_LOCALES = yargs.locales.split(',');
  }

  console.log(`Writing file ${I18N_DATA_FOLDER}/${OUTPUT_NAME}`);
  fs.writeFileSync(
      `${RELATIVE_I18N_DATA_FOLDER}/${OUTPUT_NAME}`, generateAllLocalesFile(GOOG_LOCALES, ALIASES));

  console.log(`Formatting ${I18N_DATA_FOLDER}/${OUTPUT_NAME}..."`);
  const format = require('gulp-clang-format');
  const clangFormat = require('clang-format');
  return gulp.src([`${I18N_DATA_FOLDER}/${OUTPUT_NAME}`], {base: '.'})
      .pipe(format.format('file', clangFormat))
      .pipe(gulp.dest('.'));
};

/**
 * Generate a file that contains all locale to import for closure.
 * Tree shaking will only keep the data for the `goog.LOCALE` locale.
 */
function generateAllLocalesFile(LOCALES, ALIASES) {
  function generateCases(locale) {
    let str = '';
    let localeData;
    const equivalentLocales = [locale];
    if (locale.match(/-/)) {
      equivalentLocales.push(locale.replace('-', '_'));
    }

    // check for aliases
    const alias = ALIASES[locale];
    if (alias) {
      equivalentLocales.push(alias);

      // to avoid duplicated "case" we regroup all locales in the same "case"
      // the simplest way to do that is to have alias aliases
      // e.g. 'no' --> 'nb', 'nb' --> 'no-NO'
      // which means that we'll have 'no', 'nb' and 'no-NO' in the same "case"
      const aliasKeys = Object.keys(ALIASES);
      for (let i = 0; i < aliasKeys.length; i++) {
        const aliasValue = ALIASES[alias];
        if (aliasKeys.indexOf(alias) !== -1 && equivalentLocales.indexOf(aliasValue) === -1) {
          equivalentLocales.push(aliasValue);
        }
      }
    }

    for (let i = 0; i < equivalentLocales.length; i++) {
      str += `case '${equivalentLocales[i]}':\n`;

      // find the existing content file
      const path = `${RELATIVE_I18N_DATA_FOLDER}/${equivalentLocales[i]}.ts`;
      if (fs.existsSync(`${RELATIVE_I18N_DATA_FOLDER}/${equivalentLocales[i]}.ts`)) {
        localeData = fs.readFileSync(path, 'utf8').replace(`${HEADER}\nexport default `, '');
      }
    }

    str += `  l = ${localeData}break;\n`;
    return str;
  }
  // clang-format off
  return `${HEADER}
import {registerLocaleData} from '../src/i18n/locale_data';

let l: any;

switch (goog.LOCALE.replace(/_/g, '-')) {
${LOCALES.map(locale => generateCases(locale)).join('')}}

if(l) {
  l[0] = goog.LOCALE;
  registerLocaleData(l);
}
`;
  // clang-format on
}
