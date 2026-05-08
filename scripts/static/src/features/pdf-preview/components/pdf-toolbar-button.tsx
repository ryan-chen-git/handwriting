// Simplified port of Overleaf's PDFToolbarButton. Real upstream wraps
// OLTooltip + OLButton (Bootstrap-bound). We don't have those, so this
// renders a plain `<button class="btn pdf-toolbar-btn pdfjs-toolbar-button">`
// with the label as its `title` (native tooltip on hover).

type Props = {
  tooltipId: string;
  icon: string;
  label: string;
  onClick: () => void;
  shortcut?: string;
  disabled?: boolean;
};

export default function PDFToolbarButton({
  tooltipId,
  disabled,
  label,
  icon,
  onClick,
  shortcut,
}: Props) {
  const title = shortcut ? `${label}\n${shortcut}` : label;
  return (
    <button
      type="button"
      id={tooltipId}
      className="btn pdf-toolbar-btn pdfjs-toolbar-button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={title}
    >
      <span className="material-symbols" aria-hidden translate="no">{icon}</span>
    </button>
  );
}
