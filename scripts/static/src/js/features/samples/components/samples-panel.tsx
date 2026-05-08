import {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ImperativePanelHandle,
  Panel,
  PanelGroup,
} from 'react-resizable-panels'
import OLSpinner from '@/shared/components/ol/ol-spinner'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import MaterialIcon from '@/shared/components/material-icon'
import { VerticalResizeHandle } from '@/features/ide-react/components/resize/vertical-resize-handle'
import useCollapsiblePanel from '@/features/ide-react/hooks/use-collapsible-panel'
import { useRailContext } from '@/features/ide-react/context/rail-context'
import HandwritingViewer from './handwriting-viewer'

type CharGroup = {
  label: string
  chars: string[]
}

const CHAR_GROUPS: CharGroup[] = [
  { label: 'Lowercase', chars: 'abcdefghijklmnopqrstuvwxyz'.split('') },
  { label: 'Uppercase', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') },
  { label: 'Digits', chars: '0123456789'.split('') },
  { label: 'Punctuation', chars: ['.', ',', ';', ':', '!', '?', "'", '"', '-', '_'] },
  { label: 'Brackets', chars: ['(', ')', '[', ']', '{', '}', '<', '>'] },
  { label: 'Operators', chars: ['+', '*', '/', '=', '\\', '|'] },
  { label: 'Other', chars: ['&', '%', '#', '@', '$', '~', '^'] },
]

const ALL_CHARS: string[] = CHAR_GROUPS.flatMap(g => g.chars)

const PUNCT_NAMES: Record<string, string> = {
  '.': 'period',
  ',': 'comma',
  ';': 'semicolon',
  ':': 'colon',
  '!': 'exclamation',
  '?': 'question mark',
  "'": 'apostrophe',
  '"': 'quote',
  '-': 'hyphen',
  _: 'underscore',
  '(': 'left paren',
  ')': 'right paren',
  '[': 'left bracket',
  ']': 'right bracket',
  '{': 'left brace',
  '}': 'right brace',
  '<': 'less than',
  '>': 'greater than',
  '+': 'plus',
  '*': 'asterisk',
  '/': 'slash',
  '=': 'equals',
  '\\': 'backslash',
  '|': 'pipe',
  '&': 'ampersand',
  '%': 'percent',
  '#': 'hash',
  '@': 'at',
  $: 'dollar',
  '~': 'tilde',
  '^': 'caret',
}

function describeChar(c: string): string {
  if (c >= 'a' && c <= 'z') return `lowercase ${c}`
  if (c >= 'A' && c <= 'Z') return `uppercase ${c}`
  if (c >= '0' && c <= '9') return `digit ${c}`
  return PUNCT_NAMES[c] ?? c
}

type CharsResponse = {
  chars?: string[]
  counts?: Record<string, number>
  ok?: boolean
  count?: number
  error?: string
  log?: string
}

const SamplesPanel: FC = () => {
  const { handlePaneCollapse } = useRailContext()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pullLog, setPullLog] = useState<string | null>(null)
  const [selectedChar, setSelectedChar] = useState<string | null>(null)

  // Collapsible panel state for the top + bottom halves, mirroring the
  // file-tree / file-outline pattern.
  const [topExpanded, setTopExpanded] = useState(true)
  const [bottomExpanded, setBottomExpanded] = useState(true)
  const topPanelRef = useRef<ImperativePanelHandle>(null)
  const bottomPanelRef = useRef<ImperativePanelHandle>(null)
  useCollapsiblePanel(topExpanded, topPanelRef)
  useCollapsiblePanel(bottomExpanded, bottomPanelRef)

  const fetchChars = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('/chars')
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data: CharsResponse = await resp.json()
      setCounts(data.counts ?? {})
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchChars()
  }, [fetchChars])

  const handlePull = useCallback(async () => {
    setPulling(true)
    setPullLog(null)
    setError(null)
    try {
      const resp = await fetch('/pull-samples', { method: 'POST' })
      const data: CharsResponse = await resp.json()
      if (!resp.ok || !data.ok) {
        if (data.log) setPullLog(data.log)
        throw new Error(data.error ?? `HTTP ${resp.status}`)
      }
      setCounts(data.counts ?? {})
      setPullLog(data.log ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setPulling(false)
    }
  }, [])

  const { coveredCount, totalCount } = useMemo(
    () => ({
      coveredCount: ALL_CHARS.filter(c => (counts[c] ?? 0) > 0).length,
      totalCount: ALL_CHARS.length,
    }),
    [counts]
  )

  return (
    <div className="samples-panel ide-react-file-tree-panel">
      <PanelGroup
        direction="vertical"
        autoSaveId="ide-redesign-samples-panel-v2"
        className="file-tree-outline-panel-group"
      >
        <Panel
          ref={topPanelRef}
          defaultSize={60}
          minSize={20}
          order={1}
          collapsible
          onExpand={() => setTopExpanded(true)}
          onCollapse={() => setTopExpanded(false)}
          className="samples-stack-panel"
        >
          <div className="file-tree-toolbar">
            <button
              className="file-tree-expand-collapse-button"
              onClick={() => setTopExpanded(v => !v)}
              aria-label={topExpanded ? 'Hide samples' : 'Show samples'}
              aria-expanded={topExpanded}
            >
              <MaterialIcon
                type={
                  topExpanded ? 'keyboard_arrow_down' : 'keyboard_arrow_right'
                }
              />
              <h4>Samples</h4>
            </button>
            <div className="file-tree-toolbar-action-buttons">
              <OLTooltip
                id="samples-pull"
                description={pulling ? 'Pulling…' : 'Pull samples'}
                overlayProps={{ placement: 'bottom' }}
              >
                <button
                  className="btn file-tree-toolbar-action-button"
                  onClick={handlePull}
                  disabled={pulling}
                  aria-label="Pull samples"
                >
                  {pulling ? (
                    <OLSpinner size="sm" />
                  ) : (
                    <MaterialIcon
                      type="cached"
                      unfilled
                      accessibilityLabel="Pull samples"
                    />
                  )}
                </button>
              </OLTooltip>
              <OLTooltip
                id="samples-close"
                description="Close"
                overlayProps={{ placement: 'bottom' }}
              >
                <button
                  className="btn file-tree-toolbar-action-button"
                  onClick={handlePaneCollapse}
                  aria-label="Close"
                >
                  <MaterialIcon
                    type="close"
                    accessibilityLabel="Close"
                  />
                </button>
              </OLTooltip>
            </div>
          </div>
          {topExpanded && (
            <>
              <div className="samples-panel-statusbar">
                <span className="samples-panel-summary">
                  {loading ? (
                    <OLSpinner size="sm" />
                  ) : (
                    <>
                      {coveredCount} / {totalCount} characters covered
                    </>
                  )}
                </span>
              </div>
              {pullLog && <pre className="samples-panel-log">{pullLog}</pre>}
              {error && <div className="samples-panel-error">{error}</div>}
              <div className="samples-panel-body">
                {CHAR_GROUPS.map(group => (
                  <SamplesGroup
                    key={group.label}
                    group={group}
                    counts={counts}
                    selectedChar={selectedChar}
                    onCharClick={setSelectedChar}
                  />
                ))}
              </div>
            </>
          )}
        </Panel>
        <VerticalResizeHandle hitAreaMargins={{ coarse: 0, fine: 0 }} />
        <Panel
          ref={bottomPanelRef}
          defaultSize={40}
          minSize={15}
          order={2}
          collapsible
          onExpand={() => setBottomExpanded(true)}
          onCollapse={() => setBottomExpanded(false)}
          className="samples-stack-panel"
        >
          <div className="file-tree-toolbar">
            <button
              className="file-tree-expand-collapse-button"
              onClick={() => setBottomExpanded(v => !v)}
              aria-label={
                bottomExpanded ? 'Hide samples viewer' : 'Show samples viewer'
              }
              aria-expanded={bottomExpanded}
            >
              <MaterialIcon
                type={
                  bottomExpanded
                    ? 'keyboard_arrow_down'
                    : 'keyboard_arrow_right'
                }
              />
              <h4>Samples Viewer</h4>
            </button>
          </div>
          {bottomExpanded && <HandwritingViewer char={selectedChar} />}
        </Panel>
      </PanelGroup>
    </div>
  )
}

const SamplesGroup: FC<{
  group: CharGroup
  counts: Record<string, number>
  selectedChar: string | null
  onCharClick: (char: string) => void
}> = ({ group, counts, selectedChar, onCharClick }) => {
  const [expanded, setExpanded] = useState(true)
  const groupCovered = group.chars.filter(c => (counts[c] ?? 0) > 0).length
  const sectionId = `samples-section-${group.label.toLowerCase()}`
  return (
    <section className="samples-panel-section">
      <button
        type="button"
        className="samples-panel-section-title"
        aria-expanded={expanded}
        aria-controls={sectionId}
        onClick={() => setExpanded(v => !v)}
      >
        <span className="samples-panel-section-chevron">
          <MaterialIcon
            type="chevron_right"
            className={
              'samples-panel-chevron-icon' +
              (expanded ? ' is-expanded' : '')
            }
            accessibilityLabel={expanded ? 'Collapse' : 'Expand'}
          />
        </span>
        <span className="samples-panel-section-label">{group.label}</span>
        <span className="samples-panel-section-count">
          {groupCovered} / {group.chars.length}
        </span>
      </button>
      {expanded && (
        <ul
          id={sectionId}
          className="samples-panel-rows"
          aria-label={group.label}
        >
          {group.chars.map(char => {
            const count = counts[char] ?? 0
            const has = count > 0
            const isSelected = selectedChar === char
            return (
              <li key={char}>
                <button
                  type="button"
                  className={
                    'samples-panel-row' +
                    (has ? '' : ' is-missing') +
                    (isSelected ? ' is-selected' : '')
                  }
                  onClick={() => onCharClick(char)}
                  title={
                    has
                      ? `${describeChar(char)} — ${count} sample${count === 1 ? '' : 's'}`
                      : `${describeChar(char)} — no samples`
                  }
                >
                  <span className="samples-panel-row-char">{char}</span>
                  <span className="samples-panel-row-name">
                    {describeChar(char)}
                  </span>
                  <span className="samples-panel-row-count">{count}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default SamplesPanel
