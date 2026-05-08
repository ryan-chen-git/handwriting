import { FC } from 'react'
import {
  OLModal,
  OLModalBody,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import { useRailContext } from '@/features/ide-react/context/rail-context'

export const RailHelpDocumentationModal: FC<{ show: boolean }> = ({ show }) => {
  const { setActiveModal } = useRailContext()
  return (
    <OLModal show={show} onHide={() => setActiveModal(null)} size="lg">
      <OLModalHeader closeButton>
        <OLModalTitle>Documentation</OLModalTitle>
      </OLModalHeader>
      <OLModalBody className="documentation-modal-body">
        <section>
          <h4>What this is</h4>
          <p>
            A LaTeX editor that renders documents in <em>your</em> handwriting.
            Each glyph in the output PDF is drawn from samples collected
            through the companion app, assembled into an OpenType font, and
            handed to <code>lualatex</code> at compile time.
          </p>
        </section>

        <section>
          <h4>Pipeline</h4>
          <ol>
            <li>
              <strong>Pull</strong> &ndash; the <em>Samples</em> rail tab
              fetches handwriting samples from the collection app.
            </li>
            <li>
              <strong>Preprocess</strong> &ndash; raw stroke data is normalized
              (centered, cleaned, deduped).
            </li>
            <li>
              <strong>Build font</strong> &ndash; preprocessed samples are
              compiled into <code>HandwritingFont.otf</code>. Cached by hash:
              if the sample set hasn't changed, the existing font is reused.
            </li>
            <li>
              <strong>Compile</strong> &ndash; <code>lualatex</code> runs your
              source against the font and returns a PDF.
            </li>
          </ol>
        </section>

        <section>
          <h4>Pulling samples</h4>
          <p>
            Pulling and compiling are separate, explicit steps. The Recompile
            button only runs <code>lualatex</code> against the current font;
            it does not fetch new data. When you've added new handwriting
            samples and want them reflected in the output, open the{' '}
            <em>Samples</em> rail tab and click <strong>Pull samples</strong>.
          </p>
        </section>

        <section>
          <h4>Samples Viewer</h4>
          <p>
            Click any character in the <em>Samples</em> list to inspect every
            collected stroke for that glyph in the viewer panel below. Red
            rows indicate characters with zero samples &mdash; the font falls
            back to a default glyph for those, so it's worth collecting at
            least one sample of each.
          </p>
        </section>

        <section>
          <h4>Compiler settings</h4>
          <p>
            Settings &rarr; <em>Compiler</em> exposes the three knobs the
            local <code>compile_server</code> actually honors: root document,
            stop on first error, and auto-compile. Engine selection
            (pdfLaTeX/XeLaTeX/&hellip;) and draft mode are not shown because
            the server always invokes <code>lualatex</code> with the full
            handwriting font.
          </p>
        </section>

        <section>
          <h4>Cache</h4>
          <p>
            Compile artifacts (<code>.aux</code>, <code>.toc</code>,{' '}
            <code>.bbl</code>, &hellip;) persist in{' '}
            <code>/tmp/hwcompile-cache/</code> across compiles, so cross-refs
            and citations converge faster on repeat builds. Delete that
            directory if you ever suspect stale state.
          </p>
        </section>
      </OLModalBody>
    </OLModal>
  )
}

export default RailHelpDocumentationModal
