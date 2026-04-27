import { useEffect, useRef, useState } from 'react';

type Props = {
  onDrag: (clientX: number) => void;
};

/**
 * Thin vertical splitter with a wider invisible hit area.
 * Parent owns the split ratio state; we just emit the raw clientX on drag
 * and let the parent clamp / compute percentages relative to its own rect.
 */
export default function SplitDivider({ onDrag }: Props) {
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState(false);
  const draggingRef = useRef(false);

  useEffect(() => {
    draggingRef.current = dragging;
  }, [dragging]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      onDrag(e.clientX);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging, onDrag]);

  return (
    <div
      className={`split-divider${dragging ? ' dragging' : ''}${hover ? ' hover' : ''}`}
      onPointerDown={(e) => {
        e.preventDefault();
        setDragging(true);
        onDrag(e.clientX);
      }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onDoubleClick={() => {
        // double-click resets to 50/50 — let parent infer via sentinel negative value? simpler: emit center of viewport
        onDrag(window.innerWidth / 2);
      }}
      role="separator"
      aria-orientation="vertical"
    >
      <span className="split-divider-line" />
    </div>
  );
}
