import React from 'react';
import {
  X,
  Plus,
  DoorOpen,
  AppWindow,
  LayoutGrid,
  Bed,
  Sofa,
  Utensils,
  Bath,
  Car,
  Maximize2,
  Sparkles,
} from 'lucide-react';
import type { RoomType, DoorType, WindowType, FloorPlanUnit } from '../../db/types';

export interface ArchitecturalRoomBlock {
  id: string;
  category: 'living' | 'bedroom' | 'kitchen' | 'bath' | 'utility' | 'parking';
  title: string;
  tamilTitle: string;
  widthFt: number;
  heightFt: number;
  areaSqFt: number;
  roomType: RoomType;
  floorFinish: string;
  attached?: {
    title: string;
    widthFt: number;
    heightFt: number;
    roomType: RoomType;
    floorFinish: string;
  };
  description: string;
}

export const ARCHITECTURAL_ROOM_BLOCKS: ArchitecturalRoomBlock[] = [
  {
    id: 'living_16x16',
    category: 'living',
    title: 'Living Hall (Standard)',
    tamilTitle: 'வரவேற்பறை (16×16)',
    widthFt: 16,
    heightFt: 16,
    areaSqFt: 256,
    roomType: 'Living Room',
    floorFinish: 'Vitrified Tiles',
    description: '16\' × 16\' (256 sq.ft) — Spacious central family hall',
  },
  {
    id: 'living_20x16',
    category: 'living',
    title: 'Grand Living Hall',
    tamilTitle: 'பெரிய வரவேற்பறை (20×16)',
    widthFt: 20,
    heightFt: 16,
    areaSqFt: 320,
    roomType: 'Living Room',
    floorFinish: 'Italian Marble / Granite',
    description: '20\' × 16\' (320 sq.ft) — Executive luxury living hall',
  },
  {
    id: 'master_bedroom_suite',
    category: 'bedroom',
    title: 'Master Bedroom Suite',
    tamilTitle: 'முதன்மை படுக்கையறை + கழிப்பறை',
    widthFt: 16,
    heightFt: 12,
    areaSqFt: 232, // 192 + 40
    roomType: 'Master Bedroom',
    floorFinish: 'Wood Parquet / Vitrified',
    attached: {
      title: 'Attached Toilet',
      widthFt: 8,
      heightFt: 5,
      roomType: 'Bathroom',
      floorFinish: 'Anti-Skid Ceramic Tiles',
    },
    description: '16\' × 12\' (192 sq.ft) + Attached Toilet 8\' × 5\' (40 sq.ft)',
  },
  {
    id: 'bedroom_2',
    category: 'bedroom',
    title: 'Bedroom 2',
    tamilTitle: 'இரண்டாம் படுக்கையறை (14×12)',
    widthFt: 14,
    heightFt: 12,
    areaSqFt: 168,
    roomType: 'Bedroom',
    floorFinish: 'Vitrified Tiles',
    description: '14\' × 12\' (168 sq.ft) — Standard guest or children bedroom',
  },
  {
    id: 'kitchen_dining_suite',
    category: 'kitchen',
    title: 'Kitchen & Dining Suite',
    tamilTitle: 'சமையலறை & உணவருந்தும் அறை + பயன்பாட்டு அறை',
    widthFt: 16,
    heightFt: 10,
    areaSqFt: 184, // 160 + 24
    roomType: 'Kitchen',
    floorFinish: 'Granite Countertop & Tiles',
    attached: {
      title: 'Utility / Wash Area',
      widthFt: 6,
      heightFt: 4,
      roomType: 'Bathroom',
      floorFinish: 'Anti-Skid Tiles',
    },
    description: '16\' × 10\' (160 sq.ft) + Utility Area 6\' × 4\' (24 sq.ft)',
  },
  {
    id: 'common_bath',
    category: 'bath',
    title: 'Common Bath / Toilet',
    tamilTitle: 'பொதுக் கழிவறை (7×4)',
    widthFt: 7,
    heightFt: 4,
    areaSqFt: 28,
    roomType: 'Bathroom',
    floorFinish: 'Anti-Skid Ceramic Tiles',
    description: '7\' × 4\' (28 sq.ft) — Standard ground floor common washroom',
  },
  {
    id: 'car_portico',
    category: 'parking',
    title: 'Portico / Car Parking',
    tamilTitle: 'போர்டிகோ / கார் பார்க்கிங் (16×10)',
    widthFt: 16,
    heightFt: 10,
    areaSqFt: 160,
    roomType: 'Garage',
    floorFinish: 'Heavy Duty Paver Blocks',
    description: '16\' × 10\' (160 sq.ft) — Covered sedan car parking bay',
  },
  {
    id: 'staircase_block',
    category: 'utility',
    title: 'Staircase Block',
    tamilTitle: 'மாடிப்படி அறை (12×6)',
    widthFt: 12,
    heightFt: 6,
    areaSqFt: 72,
    roomType: 'Corridor',
    floorFinish: 'Rough Granite Treads',
    description: '12\' × 6\' (72 sq.ft) — Dog-legged standard RCC staircase bay',
  },
];

export interface ArchitecturalOpeningSpec {
  id: string;
  kind: 'door' | 'window';
  title: string;
  tamilTitle: string;
  widthFt: number;
  heightFt: number;
  doorType?: DoorType;
  windowType?: WindowType;
  type?: DoorType | WindowType;
  spec: string;
}

export const ARCHITECTURAL_OPENINGS_PALETTE: ArchitecturalOpeningSpec[] = [
  {
    id: 'door_main',
    kind: 'door',
    title: 'Main Entrance Door (3\'6" × 7\')',
    tamilTitle: 'தலைவாசல் கதவு (3.5 அடி)',
    widthFt: 3.5,
    heightFt: 7.0,
    doorType: 'Main Entrance',
    type: 'Main Entrance',
    spec: 'Solid Teak Wood 3\'6" × 7\' with brass handles and safety latch',
  },
  {
    id: 'door_internal',
    kind: 'door',
    title: 'Internal Room Door (3\'0" × 7\')',
    tamilTitle: 'உள் அறை கதவு (3.0 அடி)',
    widthFt: 3.0,
    heightFt: 7.0,
    doorType: 'Single',
    type: 'Single',
    spec: 'Moulded Panel / Flush Door 3\'0" × 7\' with cylindrical lock',
  },
  {
    id: 'door_toilet',
    kind: 'door',
    title: 'Toilet Door (2\'6" × 7\')',
    tamilTitle: 'கழிவறை கதவு (2.5 அடி)',
    widthFt: 2.5,
    heightFt: 7.0,
    doorType: 'Bathroom',
    type: 'Bathroom',
    spec: 'Waterproof FRP / PVC Flush Door 2\'6" × 7\'',
  },
  {
    id: 'window_4x4',
    kind: 'window',
    title: 'Standard Window (4\'0" × 4\'0\')',
    tamilTitle: 'நிலையான ஜன்னல் (4×4 அடி)',
    widthFt: 4.0,
    heightFt: 4.0,
    windowType: 'Double Window',
    type: 'Double Window',
    spec: 'UPVC 2-Track Sliding Window 4\'0" × 4\'0" with 5mm clear glass',
  },
  {
    id: 'window_5x4',
    kind: 'window',
    title: 'Wide Window (5\'0" × 4\'0\')',
    tamilTitle: 'அகலமான ஜன்னல் (5×4 அடி)',
    widthFt: 5.0,
    heightFt: 4.0,
    windowType: 'Large Window',
    type: 'Large Window',
    spec: 'UPVC 3-Track Window with mosquito mesh 5\'0" × 4\'0"',
  },
];

export interface ArchitecturalBlockDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onStampRoom?: (block: ArchitecturalRoomBlock) => void;
  onSelectRoomBlock?: (block: ArchitecturalRoomBlock) => void;
  onSelectOpening: (opening: ArchitecturalOpeningSpec) => void;
  unit: FloorPlanUnit;
}

export const ArchitecturalBlockDrawer: React.FC<ArchitecturalBlockDrawerProps> = ({
  isOpen,
  onClose,
  onStampRoom,
  onSelectRoomBlock,
  onSelectOpening,
  unit,
}) => {
  const [activeTab, setActiveTab] = React.useState<'rooms' | 'openings'>('rooms');

  const handleSelectRoom = (block: ArchitecturalRoomBlock) => {
    if (onSelectRoomBlock) onSelectRoomBlock(block);
    else if (onStampRoom) onStampRoom(block);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: '380px',
        maxWidth: '85vw',
        background: '#ffffff',
        zIndex: 1500,
        boxShadow: '4px 0 24px rgba(15, 23, 42, 0.18)',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #e2e8f0',
        fontFamily: 'var(--font-body, inherit)',
      }}
    >
      {/* Drawer Header */}
      <div
        style={{
          padding: '16px 20px',
          background: '#0f172a',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}
          >
            <LayoutGrid size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, letterSpacing: '-0.01em' }}>
              Architectural Library
            </h3>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>1-Click Pre-dimensioned Blocks</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Tabs Switcher: Rooms vs Openings */}
      <div
        style={{
          display: 'flex',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          padding: '4px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('rooms')}
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: '12px',
            fontWeight: 700,
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            background: activeTab === 'rooms' ? '#ffffff' : 'transparent',
            color: activeTab === 'rooms' ? '#4f46e5' : '#64748b',
            boxShadow: activeTab === 'rooms' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          Room Blocks (அறைகள்)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('openings')}
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: '12px',
            fontWeight: 700,
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            background: activeTab === 'openings' ? '#ffffff' : 'transparent',
            color: activeTab === 'openings' ? '#4f46e5' : '#64748b',
            boxShadow: activeTab === 'openings' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          Openings (கதவு / ஜன்னல்)
        </button>
      </div>

      {/* Drawer Body Items List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {activeTab === 'rooms' && (
          <>
            <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
              Click any standard pre-dimensioned room block to stamp it onto the floor plan canvas.
            </p>

            {ARCHITECTURAL_ROOM_BLOCKS.map((block) => (
              <div
                key={block.id}
                onClick={() => {
                  handleSelectRoom(block);
                }}
                style={{
                  background: '#ffffff',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#4f46e5';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 10px rgba(79, 70, 229, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: '#eef2ff',
                        color: '#4f46e5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {block.category === 'bedroom' && <Bed size={13} />}
                      {block.category === 'living' && <Sofa size={13} />}
                      {block.category === 'kitchen' && <Utensils size={13} />}
                      {block.category === 'bath' && <Bath size={13} />}
                      {block.category === 'parking' && <Car size={13} />}
                      {block.category === 'utility' && <Maximize2 size={13} />}
                    </span>
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>{block.title}</strong>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#059669',
                      background: '#ecfdf5',
                      padding: '2px 6px',
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                    }}
                  >
                    {block.areaSqFt} sq.ft
                  </span>
                </div>

                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                  {block.tamilTitle}
                </div>

                <div style={{ fontSize: '10px', color: '#475569', background: '#f8fafc', padding: '6px 8px', borderRadius: '6px' }}>
                  {block.description}
                </div>

                {block.attached && (
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '10px',
                      color: '#4f46e5',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Plus size={11} /> Includes {block.attached.title} ({block.attached.widthFt}'×{block.attached.heightFt}')
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {activeTab === 'openings' && (
          <>
            <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
              Select an architectural opening to snap it directly onto walls with verified standard dimensions.
            </p>

            {ARCHITECTURAL_OPENINGS_PALETTE.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  onSelectOpening(item);
                  onClose();
                }}
                style={{
                  background: '#ffffff',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#4f46e5';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 10px rgba(79, 70, 229, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: item.kind === 'door' ? '#fef3c7' : '#e0f2fe',
                        color: item.kind === 'door' ? '#b45309' : '#0284c7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {item.kind === 'door' ? <DoorOpen size={13} /> : <AppWindow size={13} />}
                    </span>
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>{item.title}</strong>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      background: '#f1f5f9',
                      padding: '2px 6px',
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                    }}
                  >
                    {item.widthFt}' W
                  </span>
                </div>

                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                  {item.tamilTitle}
                </div>

                <div style={{ fontSize: '10px', color: '#475569', background: '#f8fafc', padding: '6px 8px', borderRadius: '6px' }}>
                  {item.spec}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Drawer Footer Tip */}
      <div
        style={{
          padding: '12px 16px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          fontSize: '11px',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <Sparkles size={14} style={{ color: '#4f46e5', flexShrink: 0 }} />
        <span>Snaps automatically to grid and aligned wall borders.</span>
      </div>
    </div>
  );
};
