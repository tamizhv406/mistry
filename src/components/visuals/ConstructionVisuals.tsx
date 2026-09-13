import React from 'react';

export interface VisualItem {
  id: string;
  tamil: string;
  english: string;
  emoji: string;
  subtext?: string;
  bgColor?: string;
  borderColor?: string;
}

export const MATERIAL_VISUALS: VisualItem[] = [
  {
    id: 'sand',
    tamil: 'மணல்',
    english: 'River Sand',
    emoji: '🏖️',
    subtext: 'Plastering & Masonry',
    bgColor: 'bg-amber-500/10 hover:bg-amber-500/20',
    borderColor: 'border-amber-500/30 hover:border-amber-500',
  },
  {
    id: 'msand',
    tamil: 'எம்-சாண்ட்',
    english: 'M-Sand / P-Sand',
    emoji: '⛰️',
    subtext: 'RCC Concrete & Mortar',
    bgColor: 'bg-stone-500/10 hover:bg-stone-500/20',
    borderColor: 'border-stone-500/30 hover:border-stone-500',
  },
  {
    id: 'cement',
    tamil: 'சிமெண்ட்',
    english: 'Cement Bags',
    emoji: '🏛️',
    subtext: 'OPC / PPC 50kg',
    bgColor: 'bg-slate-500/10 hover:bg-slate-500/20',
    borderColor: 'border-slate-500/30 hover:border-slate-500',
  },
  {
    id: 'rod',
    tamil: 'கம்பி',
    english: 'TMT Steel Rod',
    emoji: '🏗️',
    subtext: '8mm, 10mm, 12mm, 16mm',
    bgColor: 'bg-blue-500/10 hover:bg-blue-500/20',
    borderColor: 'border-blue-500/30 hover:border-blue-500',
  },
  {
    id: 'bricks',
    tamil: 'செங்கல்',
    english: 'Clay Bricks / Blocks',
    emoji: '🧱',
    subtext: 'Red Wire-Cut / Flyash',
    bgColor: 'bg-rose-500/10 hover:bg-rose-500/20',
    borderColor: 'border-rose-500/30 hover:border-rose-500',
  },
  {
    id: 'aggregate',
    tamil: 'ஜல்லி',
    english: 'Blue Metals (20mm)',
    emoji: '🪨',
    subtext: 'Concrete Aggregates',
    bgColor: 'bg-zinc-500/10 hover:bg-zinc-500/20',
    borderColor: 'border-zinc-500/30 hover:border-zinc-500',
  },
];

export const WORKER_VISUALS: VisualItem[] = [
  {
    id: 'Mistry',
    tamil: 'மேஸ்திரி',
    english: 'Chief Mistry',
    emoji: '👷‍♂️',
    subtext: 'Master Builder / Lead',
    bgColor: 'bg-amber-500/10 hover:bg-amber-500/20',
    borderColor: 'border-amber-500/30 hover:border-amber-500',
  },
  {
    id: 'Periyaal',
    tamil: 'பெரியாள்',
    english: 'Mason (Periyaal)',
    emoji: '🔨',
    subtext: 'Skilled Bricklayer',
    bgColor: 'bg-blue-500/10 hover:bg-blue-500/20',
    borderColor: 'border-blue-500/30 hover:border-blue-500',
  },
  {
    id: 'Sithaal',
    tamil: 'சித்தாள்',
    english: 'Helper (Sithaal)',
    emoji: '🧤',
    subtext: 'Mortar & Material Handler',
    bgColor: 'bg-emerald-500/10 hover:bg-emerald-500/20',
    borderColor: 'border-emerald-500/30 hover:border-emerald-500',
  },
  {
    id: 'Bar Bender',
    tamil: 'கம்பி ஆள்',
    english: 'Bar Bender',
    emoji: '⛓️',
    subtext: 'Steel TMT Fabrication',
    bgColor: 'bg-indigo-500/10 hover:bg-indigo-500/20',
    borderColor: 'border-indigo-500/30 hover:border-indigo-500',
  },
  {
    id: 'Carpenter',
    tamil: 'தச்சர்',
    english: 'Centering Carpenter',
    emoji: '🪚',
    subtext: 'Shuttering & Formwork',
    bgColor: 'bg-orange-500/10 hover:bg-orange-500/20',
    borderColor: 'border-orange-500/30 hover:border-orange-500',
  },
];

export const REFRESHMENT_VISUALS: VisualItem[] = [
  {
    id: 'tea',
    tamil: 'டீ (தேநீர்)',
    english: 'Tea / Coffee',
    emoji: '☕',
    subtext: 'Morning & Evening rounds',
    bgColor: 'bg-amber-500/10 hover:bg-amber-500/20',
    borderColor: 'border-amber-500/30 hover:border-amber-500',
  },
  {
    id: 'snacks',
    tamil: 'ஸ்நாக்ஸ்',
    english: 'Snacks / Samosa / Vada',
    emoji: '🍪',
    subtext: 'Biscuits, Sundal, Bonda',
    bgColor: 'bg-orange-500/10 hover:bg-orange-500/20',
    borderColor: 'border-orange-500/30 hover:border-orange-500',
  },
  {
    id: 'juice',
    tamil: 'ஜூஸ்',
    english: 'Fresh Juice / Cool Drinks',
    emoji: '🧃',
    subtext: 'Lemon, Sugarcane, Buttermilk',
    bgColor: 'bg-emerald-500/10 hover:bg-emerald-500/20',
    borderColor: 'border-emerald-500/30 hover:border-emerald-500',
  },
];

export const TOOL_VISUALS: VisualItem[] = [
  { id: 'hammer', tamil: 'சுத்தியல்', english: 'Hammer', emoji: '🔨' },
  { id: 'trowel', tamil: 'கரண்டி', english: 'Trowel', emoji: '📐' },
  { id: 'shovel', tamil: 'மண்வெட்டி', english: 'Spade / Shovel', emoji: '⛏️' },
  { id: 'mixer', tamil: 'கலவை மெஷின்', english: 'Concrete Mixer', emoji: '🔄' },
  { id: 'vibrator', tamil: 'வைப்ரேட்டர்', english: 'Needle Vibrator', emoji: '⚡' },
  { id: 'ladder', tamil: 'ஏணி', english: 'Ladder / Scaffolding', emoji: '🪜' },
  { id: 'tape', tamil: 'டேப்', english: 'Measuring Tape', emoji: '📏' },
  { id: 'drill', tamil: 'டிரில் மெஷின்', english: 'Drill Machine', emoji: '🔩' },
];

export const UTILITY_VISUALS: VisualItem[] = [
  { id: 'pooja', tamil: 'பூஜை', english: 'Bhoomi Pooja', emoji: '🪔', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/40' },
  { id: 'electricity', tamil: 'மின்சாரம் (EB)', english: 'EB Current Bill', emoji: '⚡', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/40' },
  { id: 'water', tamil: 'தண்ணீர் டேங்கர்', english: 'Water Tanker', emoji: '💧', bgColor: 'bg-sky-500/10', borderColor: 'border-sky-500/40' },
  { id: 'fuel', tamil: 'டீசல் / பெட்ரோல்', english: 'Fuel & Transport', emoji: '⛽', bgColor: 'bg-rose-500/10', borderColor: 'border-rose-500/40' },
];

interface VisualCardProps {
  item: VisualItem;
  isSelected?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export const VisualCard: React.FC<VisualCardProps> = ({
  item,
  isSelected = false,
  onClick,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'p-2 rounded-xl text-xs gap-1.5',
    md: 'p-3 rounded-2xl text-sm gap-2',
    lg: 'p-4 rounded-2xl text-base gap-3',
  };

  const emojiSizes = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center text-center transition-all duration-200 border-2 active:scale-95 select-none ${
        sizeClasses[size]
      } ${
        isSelected
          ? 'bg-amber-500/20 border-amber-500 shadow-md shadow-amber-500/10 ring-2 ring-amber-500/30 font-semibold'
          : `${item.bgColor || 'bg-slate-800/60 hover:bg-slate-800'} ${
              item.borderColor || 'border-slate-700/60 hover:border-slate-600'
            }`
      }`}
    >
      {isSelected && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-amber-500 text-slate-950 rounded-full flex items-center justify-center text-xs font-bold shadow">
          ✓
        </div>
      )}
      <span className={`${emojiSizes[size]} drop-shadow-sm`}>{item.emoji}</span>
      <div className="flex flex-col items-center leading-tight">
        <span className="font-bold text-slate-100 tracking-wide">{item.tamil}</span>
        <span className="text-xs text-slate-400 font-medium">{item.english}</span>
        {item.subtext && (
          <span className="text-[10px] text-slate-500 mt-0.5 max-w-[120px] truncate">
            {item.subtext}
          </span>
        )}
      </div>
    </button>
  );
};

interface VisualGridProps {
  items: VisualItem[];
  selectedId?: string;
  onSelect?: (item: VisualItem) => void;
  columns?: 2 | 3 | 4 | 6;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  sublabel?: string;
}

export const VisualSelectorGrid: React.FC<VisualGridProps> = ({
  items,
  selectedId,
  onSelect,
  columns = 3,
  size = 'md',
  label,
  sublabel,
}) => {
  const colClasses = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-4',
    6: 'grid-cols-3 sm:grid-cols-6',
  };

  return (
    <div className="w-full space-y-2">
      {label && (
        <div className="flex items-baseline justify-between px-1">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
            {label}
          </label>
          {sublabel && <span className="text-[11px] text-slate-500">{sublabel}</span>}
        </div>
      )}
      <div className={`grid ${colClasses[columns]} gap-2.5`}>
        {items.map(item => (
          <VisualCard
            key={item.id}
            item={item}
            isSelected={selectedId === item.id}
            onClick={() => onSelect && onSelect(item)}
            size={size}
          />
        ))}
      </div>
    </div>
  );
};
