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
  // The "integrations" slot is repurposed as a list of canned compile
  // tests — no real integrations exist in this build.
  { key: 'tests', label: 'Test presets', icon: 'science' },
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

function Tab({ item, active, onSelect }: { item: Item; active: boolean; onSelect: () => void }) {
  return (
    <li>
      <button
        type="button"
        className={`ide-rail-tab-button${active ? ' active' : ''}`}
        title={item.label}
        aria-label={item.label}
        aria-pressed={active}
        onClick={onSelect}
      >
        <span className="ide-rail-tab-link">
          <i className="material-symbols-outlined ide-rail-tab-link-icon" aria-hidden>
            {item.icon}
          </i>
        </span>
      </button>
    </li>
  );
}

export default function LeftRail({ active, onSelect }: Props) {
  return (
    <aside className="ide-rail" aria-label="Tools">
      <ul className="ide-rail-tabs-nav">
        {ITEMS.map((it) => (
          <Tab key={it.key} item={it} active={active === it.key} onSelect={() => onSelect(it.key)} />
        ))}
      </ul>
      <ul className="ide-rail-tabs-nav">
        {BOTTOM.map((it) => (
          <Tab key={it.key} item={it} active={active === it.key} onSelect={() => onSelect(it.key)} />
        ))}
      </ul>
    </aside>
  );
}
