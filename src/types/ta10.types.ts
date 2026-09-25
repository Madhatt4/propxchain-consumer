// TA10 Fittings & Contents Form - TypeScript Types
// Law Society standard form for items included/excluded in sale
// Fully editable, room-based checklist (NOT PDF upload)

import { Principal } from '@propxchain/core-client';

export interface TA10FittingItem {
  item: string;
  included: boolean; // true = included in sale, false = excluded
  notes: string | null;
}

export interface TA10Room {
  roomName: string; // "Kitchen", "Living Room", "Bedroom 1", etc.
  fittings: TA10FittingItem[];
}

export interface TA10FittingsAndContents {
  // Room-based inventory
  rooms: TA10Room[];

  // Garden/Outdoor items
  outdoorItems: TA10FittingItem[];

  // Additional items not listed above
  additionalItems: string;

  // Metadata
  completedBy: Principal;
  completedAt: string | null; // ISO timestamp
  lastModifiedBy: Principal;
  lastModifiedAt: string; // ISO timestamp
}

// Default room templates (pre-populated for convenience)
export const DEFAULT_ROOMS: TA10Room[] = [
  {
    roomName: 'Kitchen',
    fittings: [
      { item: 'Oven/Hob', included: false, notes: null },
      { item: 'Extractor Fan', included: false, notes: null },
      { item: 'Dishwasher', included: false, notes: null },
      { item: 'Fridge/Freezer', included: false, notes: null },
      { item: 'Washing Machine', included: false, notes: null },
      { item: 'Tumble Dryer', included: false, notes: null },
      { item: 'Microwave', included: false, notes: null },
      { item: 'Kitchen Units', included: true, notes: null },
      { item: 'Worktops', included: true, notes: null },
      { item: 'Sink and Taps', included: true, notes: null },
      { item: 'Light Fittings', included: true, notes: null },
      { item: 'Curtains/Blinds', included: false, notes: null },
    ],
  },
  {
    roomName: 'Living Room',
    fittings: [
      { item: 'Light Fittings', included: true, notes: null },
      { item: 'Curtains/Blinds', included: false, notes: null },
      { item: 'Curtain Poles/Rails', included: true, notes: null },
      { item: 'Fireplace', included: true, notes: null },
      { item: 'Television Aerial', included: true, notes: null },
      { item: 'Shelving', included: false, notes: null },
    ],
  },
  {
    roomName: 'Dining Room',
    fittings: [
      { item: 'Light Fittings', included: true, notes: null },
      { item: 'Curtains/Blinds', included: false, notes: null },
      { item: 'Curtain Poles/Rails', included: true, notes: null },
    ],
  },
  {
    roomName: 'Master Bedroom',
    fittings: [
      { item: 'Light Fittings', included: true, notes: null },
      { item: 'Curtains/Blinds', included: false, notes: null },
      { item: 'Curtain Poles/Rails', included: true, notes: null },
      { item: 'Fitted Wardrobes', included: true, notes: null },
      { item: 'Carpet', included: true, notes: null },
    ],
  },
  {
    roomName: 'Bedroom 2',
    fittings: [
      { item: 'Light Fittings', included: true, notes: null },
      { item: 'Curtains/Blinds', included: false, notes: null },
      { item: 'Curtain Poles/Rails', included: true, notes: null },
      { item: 'Carpet', included: true, notes: null },
    ],
  },
  {
    roomName: 'Bedroom 3',
    fittings: [
      { item: 'Light Fittings', included: true, notes: null },
      { item: 'Curtains/Blinds', included: false, notes: null },
      { item: 'Curtain Poles/Rails', included: true, notes: null },
      { item: 'Carpet', included: true, notes: null },
    ],
  },
  {
    roomName: 'Bathroom',
    fittings: [
      { item: 'Shower', included: true, notes: null },
      { item: 'Bath', included: true, notes: null },
      { item: 'Toilet', included: true, notes: null },
      { item: 'Basin', included: true, notes: null },
      { item: 'Bathroom Cabinet/Mirror', included: false, notes: null },
      { item: 'Towel Rail', included: true, notes: null },
      { item: 'Light Fittings', included: true, notes: null },
      { item: 'Extractor Fan', included: true, notes: null },
    ],
  },
  {
    roomName: 'Hallway/Landing',
    fittings: [
      { item: 'Light Fittings', included: true, notes: null },
      { item: 'Carpet/Flooring', included: true, notes: null },
      { item: 'Smoke Detectors', included: true, notes: null },
    ],
  },
];

export const DEFAULT_OUTDOOR_ITEMS: TA10FittingItem[] = [
  { item: 'Garden Shed', included: false, notes: null },
  { item: 'Greenhouse', included: false, notes: null },
  { item: 'Garden Furniture', included: false, notes: null },
  { item: 'Outdoor Lighting', included: true, notes: null },
  { item: 'Garden Plants/Shrubs', included: true, notes: null },
  { item: 'Rotary Washing Line', included: false, notes: null },
  { item: 'BBQ', included: false, notes: null },
  { item: 'Garden Tools', included: false, notes: null },
  { item: 'Lawnmower', included: false, notes: null },
  { item: 'Outdoor Tap', included: true, notes: null },
];

// Empty TA10 form template
export const emptyTA10Form: TA10FittingsAndContents = {
  rooms: DEFAULT_ROOMS,
  outdoorItems: DEFAULT_OUTDOOR_ITEMS,
  additionalItems: '',
  completedBy: Principal.anonymous(),
  completedAt: null,
  lastModifiedBy: Principal.anonymous(),
  lastModifiedAt: new Date().toISOString(),
};

// Calculate completion percentage
export function calculateTA10Completion(data: TA10FittingsAndContents): {
  markedItems: number;
  totalItems: number;
  completedRooms: number;
  totalRooms: number;
  percentage: number;
} {
  const totalItems = data.rooms.reduce((sum, room) => sum + room.fittings.length, 0) + data.outdoorItems.length;

  // Count items that have been marked (either included or excluded with explicit choice)
  // Assume all items are "marked" - user makes conscious choice for each
  const markedItems = totalItems;

  // Count rooms (indoor + outdoor as 1 "room")
  const totalRooms = data.rooms.length + (data.outdoorItems.length > 0 ? 1 : 0);
  // All rooms are considered "completed" since they're pre-populated with items
  const completedRooms = totalRooms;

  return {
    markedItems,
    totalItems,
    completedRooms,
    totalRooms,
    percentage: totalItems > 0 ? 100 : 0, // All items visible = form ready to complete
  };
}

// Count included/excluded items
export function getItemCounts(data: TA10FittingsAndContents): {
  includedCount: number;
  excludedCount: number;
} {
  let includedCount = 0;
  let excludedCount = 0;

  data.rooms.forEach((room) => {
    room.fittings.forEach((fitting) => {
      if (fitting.included) {
        includedCount++;
      } else {
        excludedCount++;
      }
    });
  });

  data.outdoorItems.forEach((item) => {
    if (item.included) {
      includedCount++;
    } else {
      excludedCount++;
    }
  });

  return { includedCount, excludedCount };
}
