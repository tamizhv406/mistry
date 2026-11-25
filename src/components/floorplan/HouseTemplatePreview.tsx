import type { Opening, Wall } from '../../floorPlanner/model/schema';
import { MM_PER_FOOT, type HouseTemplate, type RoomRole } from '../../domain/houseTemplates';

export interface HouseTemplatePreviewProps {
  template: HouseTemplate;
  /** Height of the picture in px (it keeps the plan's proportions inside). */
  height?: number;
}

/** Room colours by use (soft tints so walls, doors and windows stand out). */
const ROLE_FILL: Record<RoomRole, string> = {
  sitout: '#F5F5F4',
  living: '#FFEDD5',
  lounge: '#FFEDD5',
  foyer: '#F5F5F4',
  dining: '#FEF3C7',
  kitchen: '#FDE68A',
  bedroom: '#CCFBF1',
  'attached-bath': '#CFFAFE',
  'common-toilet': '#CFFAFE',
  pooja: '#FCE7F3',
  balcony: '#DCFCE7',
  staircase: '#E5E7EB',
  utility: '#E7E5E4',
};

const GAP_MM = 2400; // between the floors of a Duplex
const CAPTION_MM = 1500;

function openingEnds(w: Wall, o: Opening) {
  const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y) || 1;
  const ux = (w.b.x - w.a.x) / len;
  const uy = (w.b.y - w.a.y) / len;
  return {
    x1: w.a.x + ux * o.offset,
    y1: w.a.y + uy * o.offset,
    x2: w.a.x + ux * (o.offset + o.width),
    y2: w.a.y + uy * (o.offset + o.width),
  };
}

/**
 * Blueprint thumbnail of a house template: rooms tinted by use, 9" and 4.5" walls, doors in
 * orange and windows in teal. A Duplex shows Ground Floor and First Floor side by side.
 * Room names and sizes are listed as text on the card (they would be too small to read here).
 */
export function HouseTemplatePreview({ template, height = 170 }: HouseTemplatePreviewProps) {
  const plotW = template.plotWidthFt * MM_PER_FOOT;
  const plotD = template.plotDepthFt * MM_PER_FOOT;
  const multi = template.floors.length > 1;
  const pad = 600;
  const top = multi ? CAPTION_MM : 0;
  const width = template.floors.length * plotW + (template.floors.length - 1) * GAP_MM + pad * 2;
  const heightMm = plotD + top + pad * 2;

  return (
    <div className="tpl-preview-frame" style={{ height }}>
      <svg
        viewBox={`${-pad} ${-pad - top} ${width} ${heightMm}`}
        width="100%"
        height="100%"
        role="img"
        aria-label={`${template.title} floor plan preview`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}
      >
        <title>{`${template.title} floor plan`}</title>
        {template.floors.map((floor, i) => {
          const walls = new Map(floor.plan.walls.map(w => [w.id, w]));
          return (
            <g key={floor.floorIndex} transform={`translate(${i * (plotW + GAP_MM)} 0)`}>
              {multi && (
                <text x={plotW / 2} y={-450} textAnchor="middle" fontSize={1000} fontWeight={700} fill="#1F2937" fontFamily="system-ui, sans-serif">
                  {floor.label}
                </text>
              )}
              {floor.rooms.map(r => (
                <rect
                  key={r.id}
                  data-room={r.id}
                  x={r.xFt * MM_PER_FOOT}
                  y={r.yFt * MM_PER_FOOT}
                  width={r.wFt * MM_PER_FOOT}
                  height={r.hFt * MM_PER_FOOT}
                  fill={ROLE_FILL[r.role]}
                />
              ))}
              {floor.plan.walls.map(w => (
                <line
                  key={w.id}
                  data-wall={w.id}
                  x1={w.a.x}
                  y1={w.a.y}
                  x2={w.b.x}
                  y2={w.b.y}
                  stroke="#1F2937"
                  strokeWidth={w.thickness >= 150 ? 220 : 120}
                  strokeLinecap="square"
                />
              ))}
              {floor.plan.openings.map(o => {
                const w = walls.get(o.wallId);
                if (!w) return null;
                const e = openingEnds(w, o);
                const isWindow = o.type === 'window';
                return (
                  <line
                    key={o.id}
                    data-opening={o.id}
                    {...e}
                    stroke={isWindow ? '#0E7490' : '#F97316'}
                    strokeWidth={isWindow ? 200 : 260}
                    strokeLinecap="butt"
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default HouseTemplatePreview;
