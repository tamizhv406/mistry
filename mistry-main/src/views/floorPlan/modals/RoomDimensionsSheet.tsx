import React from 'react';
import { Trash2, Check } from 'lucide-react';
import { Sheet, Field, Note, Segmented } from '../../../components/mobile/kit';
import { roomBox } from '../../../domain/planEdit';
import { roomArea, formatPlanArea } from '../../../domain/planGeometry';
import { formatDimension, type RoomInterior } from '../../../domain/planMeasure';
import type { FloorPlanRoom, FloorPlanUnit, RoomType } from '../../../db/types';

export interface RoomSheetState {
  id: string;
  width: string;
  length: string;
  widthSide: 'left' | 'right';
  lengthSide: 'top' | 'bottom';
  error?: string;
}

export interface RoomDimensionsSheetProps {
  roomSheet: RoomSheetState | null;
  rooms: FloorPlanRoom[];
  unit: FloorPlanUnit;
  roomInteriors: Map<string, RoomInterior>;
  onClose: () => void;
  onUpdateRoomName: (id: string, name: string) => void;
  onUpdateRoomType: (id: string, type: RoomType) => void;
  onRoomSheetChange: (changes: Partial<RoomSheetState>) => void;
  onApplyRoomSize: () => void;
  onDeleteRoom: (room: FloorPlanRoom) => void;
}

const COMMON_ROOM_TYPES: RoomType[] = [
  'Bedroom',
  'Master Bedroom',
  'Kitchen',
  'Bathroom',
  'Toilet',
  'Living Room',
  'Dining',
  'Balcony',
  'Pooja',
  'Store',
  'Study',
  'Utility',
];

export const RoomDimensionsSheet: React.FC<RoomDimensionsSheetProps> = ({
  roomSheet,
  rooms,
  unit,
  roomInteriors,
  onClose,
  onUpdateRoomName,
  onUpdateRoomType,
  onRoomSheetChange,
  onApplyRoomSize,
  onDeleteRoom,
}) => {
  if (!roomSheet) return null;
  const room = rooms.find(r => r.id === roomSheet.id);
  if (!room) return null;

  const box = roomBox(room);
  const inner = roomInteriors.get(room.id);

  return (
    <Sheet
      open
      title={room.label || room.roomType}
      subtitle={`${formatPlanArea(roomArea(room), unit)}${
        inner ? ` · inside ${formatDimension(inner.width, unit)} × ${formatDimension(inner.height, unit)}` : ''
      }`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="m-btn is-danger"
            onClick={() => onDeleteRoom(room)}
            disabled={!!room.locked}
            id="fp-room-sheet-delete"
          >
            <Trash2 size={18} /> Delete
          </button>
          <button
            type="button"
            className="m-btn is-primary"
            onClick={onApplyRoomSize}
            disabled={!!room.locked}
            id="fp-room-sheet-apply"
          >
            <Check size={18} /> Done
          </button>
        </>
      }
    >
      {roomSheet.error && (
        <div style={{ marginBottom: 12 }}>
          <Note tone="bad" role="alert">{roomSheet.error}</Note>
        </div>
      )}
      {room.locked && (
        <div style={{ marginBottom: 12 }}>
          <Note>This room is locked. Unlock it to change it.</Note>
        </div>
      )}
      <Field label="Name">
        <input
          type="text"
          value={room.label}
          maxLength={40}
          disabled={!!room.locked}
          onChange={e => onUpdateRoomName(room.id, e.target.value)}
          id="fp-room-sheet-name"
        />
      </Field>
      <div className="m-chips fp-room-type-chips" role="group" aria-label="Room type">
        {COMMON_ROOM_TYPES.map(rt => (
          <button
            key={rt}
            type="button"
            className={`m-chip ${room.roomType === rt ? 'is-on' : ''}`}
            aria-pressed={room.roomType === rt}
            disabled={!!room.locked}
            onClick={() => onUpdateRoomType(room.id, rt)}
          >
            {rt}
          </button>
        ))}
      </div>
      {box || !room.polygonPoints ? (
        <>
          <div className="m-field-2" style={{ marginTop: 12 }}>
            <Field label="Width (left to right)">
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={roomSheet.width}
                disabled={!!room.locked}
                onChange={e => onRoomSheetChange({ width: e.target.value, error: '' })}
                id="fp-room-sheet-width"
              />
            </Field>
            <Field label="Length (top to bottom)">
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={roomSheet.length}
                disabled={!!room.locked}
                onChange={e => onRoomSheetChange({ length: e.target.value, error: '' })}
                id="fp-room-sheet-length"
              />
            </Field>
          </div>
          {room.fromWalls && (
            <div className="m-field-2">
              <Segmented
                label="Wall that moves for the width"
                value={roomSheet.widthSide}
                onChange={v => onRoomSheetChange({ widthSide: v as 'left' | 'right' })}
                options={[
                  { value: 'right', label: 'Right wall' },
                  { value: 'left', label: 'Left wall' },
                ]}
              />
              <Segmented
                label="Wall that moves for the length"
                value={roomSheet.lengthSide}
                onChange={v => onRoomSheetChange({ lengthSide: v as 'top' | 'bottom' })}
                options={[
                  { value: 'bottom', label: 'Bottom wall' },
                  { value: 'top', label: 'Top wall' },
                ]}
              />
            </div>
          )}
          <p className="m-calc-note">
            Wall centre to wall centre, the same as the area. {room.fromWalls ? 'Rooms next to the moved wall grow or shrink with it.' : ''}
          </p>
        </>
      ) : (
        <p className="m-calc-note">
          This room is not a rectangle, so its size is changed by moving its walls or corners.
        </p>
      )}
    </Sheet>
  );
};
