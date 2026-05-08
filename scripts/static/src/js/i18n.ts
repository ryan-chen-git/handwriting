import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import getMeta from '@/utils/meta'
import { resources } from '@/i18n-resources/writefull'

const LANG = getMeta('ol-i18n').currentLangCode

// Since we are rendering React from Angular, the initialisation is
// synchronous on page load (but hidden behind the loading screen). This
// means that translations must be initialised without any actual
// translation strings, and load those manually ourselves later

// Offline build: we don't have the real locales/<lang>.json files (those live
// in upstream's monorepo, not our sparse reference clone). When a key isn't
// translated, fall back to a humanized version of the key itself so the UI
// shows readable text instead of raw snake_case keys.
function humanizeKey(key: string): string {
  // Strip namespace prefix ("ns:key" -> "key"), then replace _/- with space
  // and capitalize the first word.
  const bare = key.includes(':') ? key.split(':').slice(1).join(':') : key
  const spaced = bare.replace(/[_-]+/g, ' ').trim()
  if (!spaced) return key
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

i18n.use(initReactI18next).init({
  lng: LANG,

  // still using the v3 plural suffixes
  compatibilityJSON: 'v3',

  // Treat empty strings as missing so parseMissingKeyHandler fires for them.
  returnEmptyString: false,
  parseMissingKeyHandler: humanizeKey,

  react: {
    // Since we are manually waiting on the translations data to
    // load, we don't need to use Suspense
    useSuspense: false,

    // Trigger a re-render when a language is added. Since we load the
    // translation strings asynchronously, we need to trigger a re-render once
    // they've loaded
    bindI18nStore: 'added',

    // Disable automatic conversion of basic markup to React components
    transSupportBasicHtmlNodes: false,
  },

  interpolation: {
    // We use the legacy v1 JSON format, so configure interpolator to use
    // underscores instead of curly braces
    prefix: '__',
    suffix: '__',
    unescapeSuffix: 'HTML',

    // Disable nesting in interpolated values, preventing user input
    // injection via another nested value
    skipOnVariables: true,

    // Do not escape values, as `t` + React will already escape them
    // (`escapeValue: true` and `shouldUnescape` must be set on each use of `Trans`)
    escapeValue: false,

    defaultVariables: {
      appName: getMeta('ol-ExposedSettings').appName,
    },
  },
})

// The webpackChunkName here will name this chunk (and thus the requested
// script) according to the file name. See https://webpack.js.org/api/module-methods/#magic-comments
// for details
const localesPromise = import(
  /* webpackChunkName: "[request]" */ `../../locales/${LANG}.json`
).then(lang => {
  i18n.addResourceBundle(LANG, 'translation', lang)
  i18n.addResourceBundle(
    LANG,
    'writefull',
    LANG === 'es' ? resources.es.writefull : resources.en.writefull
  )
})

export default localesPromise
