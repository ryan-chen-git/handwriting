type Item = { key: RailKey; label: string; icon: string };

export type RailKey =
  | 'files'
  | 'search'
  | 'tests'
  | 'review'
  | 'chat'
  | 'help'
  | 'settings';

const ITEMS: Item[] = [
  { key: 'files', label: 'File tree', icon: 'description' },
  { key: 'search', label: 'Project search', icon: 'search' },
  // Upstream's "integrations" rail slot — we repurpose it as canned compile
  // presets. Icon name matches upstream so the slice woff2 picks it up.
  { key: 'tests', label: 'Test presets', icon: 'integration_instructions' },
  { key: 'review', label: 'Review', icon: 'rate_review' },
  { key: 'chat', label: 'Chat', icon: 'forum' },
];

const BOTTOM: Item[] = [
  { key: 'help', label: 'Help', icon: 'help' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
];

type Props = {
  active: RailKey | null;
  onSelect: (key: RailKey) => void;
};

// Each rail tab = upstream's <RailTab>: a single button with class
// `ide-rail-tab-link` + `open-rail` when its panel is open. The icon span
// gets `material-symbols ide-rail-tab-link-icon`, plus `unfilled` when the
// tab isn't active (swaps to the outlined font slice).
function Tab({ item, active, onSelect }: { item: Item; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      className={`btn ide-rail-tab-link${active ? ' open-rail' : ''}`}
      role="tab"
      aria-selected={active}
      aria-label={item.label}
      title={item.label}
      onClick={onSelect}
    >
      <span
        className={`material-symbols${active ? '' : ' unfilled'} ide-rail-tab-link-icon`}
        aria-hidden
        translate="no"
      >
        {item.icon}
      </span>
    </button>
  );
}

export default function LeftRail({ active, onSelect }: Props) {
  return (
    <nav className="ide-rail" aria-label="Sidebar">
      <div className="ide-rail-tabs-nav" role="tablist">
        <div className="ide-rail-tabs-wrapper">
          {ITEMS.map((it) => (
            <Tab
              key={it.key}
              item={it}
              active={active === it.key}
              onSelect={() => onSelect(it.key)}
            />
          ))}
        </div>
        <nav aria-label="Help and settings">
          {BOTTOM.map((it) => (
            <Tab
              key={it.key}
              item={it}
              active={active === it.key}
              onSelect={() => onSelect(it.key)}
            />
          ))}
        </nav>
      </div>
    </nav>
  );
}
