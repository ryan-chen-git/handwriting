import { FC, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditorPropertiesContext } from '@/features/ide-react/context/editor-properties-context'
import {
  SYMBOLS,
  SYMBOL_CATEGORIES,
  SymbolCategory,
  SymbolEntry,
} from '../data/symbols'

const SymbolPalette: FC = () => {
  const { t } = useTranslation()
  const { toggleSymbolPalette } = useEditorPropertiesContext()
  const [activeCategory, setActiveCategory] =
    useState<SymbolCategory>('Greek')
  const [search, setSearch] = useState('')

  const visibleSymbols = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (term) {
      return SYMBOLS.filter(
        s =>
          s.label.toLowerCase().includes(term) ||
          s.command.toLowerCase().includes(term)
      )
    }
    return SYMBOLS.filter(s => s.category === activeCategory)
  }, [activeCategory, search])

  const handleInsert = useCallback((entry: SymbolEntry) => {
    const view = (
      window as unknown as {
        __editorView?: {
          state: { selection: { main: { from: number; to: number } } }
          dispatch: (spec: unknown) => void
          focus: () => void
        }
      }
    ).__editorView
    if (!view) return
    const { from, to } = view.state.selection.main
    const insert = entry.command
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + insert.length },
    })
    view.focus()
  }, [])

  return (
    <div className="symbol-palette-container">
      <div className="symbol-palette">
        <div className="symbol-palette-header-outer">
          <div className="symbol-palette-header">
            <div
              role="tablist"
              aria-label="Symbol Categories"
              className="symbol-palette-tab-list"
            >
              {SYMBOL_CATEGORIES.map(category => (
                <button
                  key={category}
                  role="tab"
                  type="button"
                  className="symbol-palette-tab"
                  id={`symbol-palette-tab-${category}`}
                  aria-controls={`symbol-palette-panel-${category}`}
                  aria-selected={activeCategory === category}
                  tabIndex={activeCategory === category ? 0 : -1}
                  onClick={() => {
                    setActiveCategory(category)
                    setSearch('')
                  }}
                >
                  {category}
                </button>
              ))}
            </div>
            <div className="symbol-palette-header-group">
              <input
                aria-label={t('search')}
                placeholder={t('search') + '…'}
                type="search"
                id="symbol-palette-input"
                className="symbol-palette-search form-control"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="symbol-palette-header-group">
            <div className="symbol-palette-close-button-outer">
              <button
                type="button"
                className="btn-close symbol-palette-close-button btn-close-white"
                aria-label={t('close')}
                onClick={toggleSymbolPalette}
              />
            </div>
          </div>
        </div>
        <div className="symbol-palette-body">
          <div className="symbol-palette-panels">
            <div
              role="tabpanel"
              className="symbol-palette-panel"
              aria-labelledby={`symbol-palette-tab-${activeCategory}`}
              tabIndex={0}
            >
              {visibleSymbols.length > 0 ? (
                <div
                  className="symbol-palette-items"
                  role="listbox"
                  aria-label="Symbols"
                >
                  {visibleSymbols.map(entry => (
                    <button
                      key={entry.command}
                      className="symbol-palette-item"
                      role="option"
                      type="button"
                      aria-label={entry.label}
                      title={`${entry.label}\n${entry.command}`}
                      onClick={() => handleInsert(entry)}
                    >
                      {entry.char}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="symbol-palette-empty">
                  No matching symbols.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SymbolPalette
