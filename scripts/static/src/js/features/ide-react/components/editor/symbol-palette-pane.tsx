import { FC } from 'react'
import SymbolPalette from '@/features/source-editor/components/symbol-palette'

// Offline build: upstream loads its symbol palette via
// `importOverleafModules('sourceEditorSymbolPalette')`, which only resolves
// in their closed-source bundle. We render our local reconstruction here.
const SymbolPalettePane: FC = () => {
  return (
    <div className="ide-react-symbol-palette">
      <SymbolPalette />
    </div>
  )
}

export default SymbolPalettePane
