import { FC, useEffect, useMemo, useState } from 'react'
import OLSpinner from '@/shared/components/ol/ol-spinner'

type Point = [number, number, number?]
type Stroke = Point[]
type Sample = { strokes: Stroke[] }

const HandwritingViewer: FC<{ char: string | null }> = ({ char }) => {
  const [samples, setSamples] = useState<Sample[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!char) {
      setSamples([])
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/samples?char=${encodeURIComponent(char)}`)
      .then(async resp => {
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json()
        if (cancelled) return
        setSamples(data.samples ?? [])
      })
      .catch(e => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
        setSamples([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [char])

  if (!char) {
    return (
      <div className="handwriting-viewer-empty-state">
        <h4 className="handwriting-viewer-empty-title">Handwriting Viewer</h4>
        <p>Click a character above to view its collected handwriting samples.</p>
      </div>
    )
  }

  return (
    <div className="handwriting-viewer-pane">
      <h4 className="handwriting-viewer-title">
        {loading
          ? 'loading…'
          : `${samples.length} sample${samples.length === 1 ? '' : 's'}`}
      </h4>
      {error && <div className="handwriting-viewer-error">{error}</div>}
      {!loading && !error && samples.length === 0 && (
        <div className="handwriting-viewer-empty">
          No samples collected for <code>{char}</code>.
        </div>
      )}
      {loading && (
        <div className="handwriting-viewer-loading">
          <OLSpinner size="sm" />
        </div>
      )}
      {!loading && samples.length > 0 && (
        <div className="handwriting-viewer-grid">
          {samples.map((sample, i) => (
            <SampleSvg key={i} strokes={sample.strokes} />
          ))}
        </div>
      )}
    </div>
  )
}

const SampleSvg: FC<{ strokes: Stroke[] }> = ({ strokes }) => {
  const { paths, viewBox } = useMemo(() => {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    const paths: string[] = []
    for (const stroke of strokes) {
      if (stroke.length === 0) continue
      const segments: string[] = []
      for (let i = 0; i < stroke.length; i++) {
        const [x, y] = stroke[i]
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
        segments.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
      }
      paths.push(segments.join(' '))
    }
    if (!isFinite(minX)) {
      return { paths: [], viewBox: '0 0 100 100' }
    }
    const pad = 8
    const w = maxX - minX + pad * 2
    const h = maxY - minY + pad * 2
    return {
      paths,
      viewBox: `${minX - pad} ${minY - pad} ${w} ${h}`,
    }
  }, [strokes])

  return (
    <svg
      className="handwriting-viewer-sample"
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}

export default HandwritingViewer
