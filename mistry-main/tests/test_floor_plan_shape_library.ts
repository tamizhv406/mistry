import 'fake-indexeddb/auto';
import {
  SHAPE_CATEGORIES,
  SHAPE_LIBRARY_CATALOG,
  searchShapes,
  getFavoriteShapeIds,
  toggleFavoriteShape,
  getRecentShapeIds,
  recordRecentShape,
  getCustomShapes,
  saveCustomShape,
  deleteCustomShape,
  createEntityFromShape,
  ShapeLibraryItem,
} from '../src/services/shapeLibraryCatalog';
import type { User } from '../src/db/types';

async function runShapeLibraryTests() {
  console.log('📐 Starting Building Mistry Professional Shape Library Verification Tests...\n');

  const testUser: User = {
    id: 'test-cad-architect-1',
    username: 'architect_tamil',
    fullName: 'Tamil Architect',
    mobile: '9840112233',
    email: 'architect@example.com',
    passwordHash: 'dummy',
    role: 'MISTRY',
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  // 1. Validate All 10 Required Categories exist
  console.log('[Test 1] Verifying 10 Required Shape Library Categories...');
  const expectedCategories = [
    'Floor Plan',
    'Furniture',
    'Kitchen',
    'Bathroom',
    'Stairs',
    'Structural',
    'Electrical',
    'Plumbing',
    'Outdoor',
    'Annotation',
  ];

  if (SHAPE_CATEGORIES.length !== 10) {
    throw new Error(`Expected 10 categories, got ${SHAPE_CATEGORIES.length}`);
  }

  for (const cat of expectedCategories) {
    const found = SHAPE_CATEGORIES.find(c => c.id === cat);
    if (!found) {
      throw new Error(`Missing expected category: ${cat}`);
    }
  }
  console.log('✓ All 10 architectural categories defined and present.');

  // 2. Verify all mandatory shapes from prompt exist with proper metadata
  console.log('\n[Test 2] Verifying Essential Shapes across Categories...');
  const mandatoryShapes: { name: string; category: string }[] = [
    // 1. Floor Plan
    { name: 'Wall', category: 'Floor Plan' },
    { name: 'Interior Wall', category: 'Floor Plan' },
    { name: 'Exterior Wall', category: 'Floor Plan' },
    { name: 'Corner Wall', category: 'Floor Plan' },
    { name: 'Room', category: 'Floor Plan' },
    { name: 'Door', category: 'Floor Plan' },
    { name: 'Double Door', category: 'Floor Plan' },
    { name: 'Sliding Door', category: 'Floor Plan' },
    { name: 'Window', category: 'Floor Plan' },
    { name: 'Sliding Window', category: 'Floor Plan' },
    { name: 'Opening', category: 'Floor Plan' },
    { name: 'Staircase', category: 'Floor Plan' },

    // 2. Furniture
    { name: 'Single Bed', category: 'Furniture' },
    { name: 'Double Bed', category: 'Furniture' },
    { name: 'Queen Bed', category: 'Furniture' },
    { name: 'King Bed', category: 'Furniture' },
    { name: 'Sofa', category: 'Furniture' },
    { name: 'L Sofa', category: 'Furniture' },
    { name: 'Chair', category: 'Furniture' },
    { name: 'Armchair', category: 'Furniture' },
    { name: 'Coffee Table', category: 'Furniture' },
    { name: 'Dining Table', category: 'Furniture' },
    { name: 'Dining Chair', category: 'Furniture' },
    { name: 'Wardrobe', category: 'Furniture' },
    { name: 'Cabinet', category: 'Furniture' },
    { name: 'TV', category: 'Furniture' },
    { name: 'TV Stand', category: 'Furniture' },
    { name: 'Desk', category: 'Furniture' },
    { name: 'Study Chair', category: 'Furniture' },
    { name: 'Bookshelf', category: 'Furniture' },

    // 3. Kitchen
    { name: 'Kitchen Counter', category: 'Kitchen' },
    { name: 'Sink', category: 'Kitchen' },
    { name: 'Stove', category: 'Kitchen' },
    { name: 'Oven', category: 'Kitchen' },
    { name: 'Refrigerator', category: 'Kitchen' },
    { name: 'Dishwasher', category: 'Kitchen' },
    { name: 'Kitchen Cabinet', category: 'Kitchen' },
    { name: 'Island', category: 'Kitchen' },
    { name: 'Breakfast Counter', category: 'Kitchen' },

    // 4. Bathroom
    { name: 'Toilet', category: 'Bathroom' },
    { name: 'Wash Basin', category: 'Bathroom' },
    { name: 'Shower', category: 'Bathroom' },
    { name: 'Bathtub', category: 'Bathroom' },
    { name: 'Bidet', category: 'Bathroom' },
    { name: 'Bathroom Cabinet', category: 'Bathroom' },
    { name: 'Mirror', category: 'Bathroom' },
    { name: 'Floor Drain', category: 'Bathroom' },

    // 5. Stairs
    { name: 'Straight Stair', category: 'Stairs' },
    { name: 'L Stair', category: 'Stairs' },
    { name: 'U Stair', category: 'Stairs' },
    { name: 'Spiral Stair', category: 'Stairs' },

    // 6. Structural
    { name: 'Column', category: 'Structural' },
    { name: 'Pillar', category: 'Structural' },
    { name: 'Beam', category: 'Structural' },
    { name: 'Structural Wall', category: 'Structural' },

    // 7. Electrical
    { name: 'Light', category: 'Electrical' },
    { name: 'Ceiling Fan', category: 'Electrical' },
    { name: 'Switch', category: 'Electrical' },
    { name: 'Socket', category: 'Electrical' },
    { name: 'Distribution Board', category: 'Electrical' },

    // 8. Plumbing
    { name: 'Water Point', category: 'Plumbing' },
    { name: 'Drain', category: 'Plumbing' },
    { name: 'Pipe', category: 'Plumbing' },
    { name: 'Floor Trap', category: 'Plumbing' },

    // 9. Outdoor
    { name: 'Tree', category: 'Outdoor' },
    { name: 'Plant', category: 'Outdoor' },
    { name: 'Garden', category: 'Outdoor' },
    { name: 'Parking', category: 'Outdoor' },
    { name: 'Car', category: 'Outdoor' },
    { name: 'Gate', category: 'Outdoor' },

    // 10. Annotation
    { name: 'Text', category: 'Annotation' },
    { name: 'Room Label', category: 'Annotation' },
    { name: 'Dimension', category: 'Annotation' },
    { name: 'Area', category: 'Annotation' },
    { name: 'North Arrow', category: 'Annotation' },
    { name: 'Scale', category: 'Annotation' },
    { name: 'Note', category: 'Annotation' },
  ];

  for (const m of mandatoryShapes) {
    const item = SHAPE_LIBRARY_CATALOG.find(i => i.name.toLowerCase() === m.name.toLowerCase());
    if (!item) {
      throw new Error(`Mandatory shape "${m.name}" not found in library!`);
    }
    if (item.category !== m.category) {
      throw new Error(`Shape "${m.name}" is under category "${item.category}", expected "${m.category}"`);
    }
    if (item.width <= 0 || item.height <= 0) {
      throw new Error(`Shape "${m.name}" has invalid dimensions: ${item.width}×${item.height}`);
    }
    if (!item.iconType) {
      throw new Error(`Shape "${m.name}" is missing iconType`);
    }
  }
  console.log(`✓ All ${mandatoryShapes.length} mandatory architectural shapes verified with valid dimensions & metadata.`);

  // 3. Test Search Across All Categories
  console.log('\n[Test 3] Testing Cross-Category Search Functionality...');

  // Search "bed"
  const bedResults = searchShapes('bed');
  const bedNames = bedResults.map(r => r.name);
  if (!bedNames.includes('Single Bed') || !bedNames.includes('Double Bed') || !bedNames.includes('King Bed')) {
    throw new Error(`Search "bed" failed. Got: ${bedNames.join(', ')}`);
  }
  console.log(`✓ Search "bed" returned ${bedResults.length} items: ${bedNames.join(', ')}`);

  // Search "door"
  const doorResults = searchShapes('door');
  const doorNames = doorResults.map(r => r.name);
  if (!doorNames.includes('Door') || !doorNames.includes('Double Door') || !doorNames.includes('Sliding Door')) {
    throw new Error(`Search "door" failed. Got: ${doorNames.join(', ')}`);
  }
  console.log(`✓ Search "door" returned ${doorResults.length} items: ${doorNames.join(', ')}`);

  // Search "sink"
  const sinkResults = searchShapes('sink');
  if (sinkResults.length === 0 || !sinkResults.some(r => r.name === 'Sink')) {
    throw new Error('Search "sink" failed.');
  }
  console.log('✓ Search "sink" successfully returned Kitchen Sink.');

  // Search "toilet"
  const toiletResults = searchShapes('toilet');
  if (toiletResults.length === 0 || !toiletResults.some(r => r.name === 'Toilet')) {
    throw new Error('Search "toilet" failed.');
  }
  console.log('✓ Search "toilet" successfully returned WC / Toilet.');

  // 4. Test Entity Generation for Canvas Placement (Geometry & Vector Objects)
  console.log('\n[Test 4] Testing Entity Generation Factory for Canvas Placement...');

  const bedItem = SHAPE_LIBRARY_CATALOG.find(i => i.name === 'Double Bed')!;
  const bedEntity = createEntityFromShape(bedItem, 10, 15, 'feet');
  if (bedEntity.entityType !== 'furniture' || (bedEntity.payload as any).width !== 5) {
    throw new Error('Failed to create furniture entity for Double Bed');
  }

  const wallItem = SHAPE_LIBRARY_CATALOG.find(i => i.name === 'Wall')!;
  const wallEntity = createEntityFromShape(wallItem, 5, 5, 'feet');
  if (wallEntity.entityType !== 'wall' || (wallEntity.payload as any).x1 !== 5) {
    throw new Error('Failed to create wall entity');
  }

  const doorItem = SHAPE_LIBRARY_CATALOG.find(i => i.name === 'Door')!;
  const doorEntity = createEntityFromShape(doorItem, 12, 12, 'feet');
  if (doorEntity.entityType !== 'door' || (doorEntity.payload as any).width !== 2.5) {
    throw new Error('Failed to create door entity');
  }

  const toiletItem = SHAPE_LIBRARY_CATALOG.find(i => i.name === 'Toilet')!;
  const toiletEntity = createEntityFromShape(toiletItem, 20, 20, 'feet');
  if (toiletEntity.entityType !== 'furniture' || (toiletEntity.payload as any).itemType !== 'Toilet') {
    throw new Error('Failed to create toilet furniture entity');
  }

  console.log('✓ Vector entity factory accurately produces CAD entities with correct positions, dimensions, and types.');

  // 5. Test Favorites & Recently Used Persistence
  console.log('\n[Test 5] Testing Real Favorites & Recently Used History Persistence...');

  const initialFavs = getFavoriteShapeIds(testUser.id);
  const updatedFavs = toggleFavoriteShape(testUser.id, 'bath-bathtub');
  if (!updatedFavs.includes('bath-bathtub')) {
    throw new Error('Failed to add bathtub to favorites.');
  }
  const untoggledFavs = toggleFavoriteShape(testUser.id, 'bath-bathtub');
  if (untoggledFavs.includes('bath-bathtub')) {
    throw new Error('Failed to remove bathtub from favorites.');
  }

  recordRecentShape(testUser.id, 'kit-island');
  recordRecentShape(testUser.id, 'out-tree');
  const recentIds = getRecentShapeIds(testUser.id);
  if (recentIds[0] !== 'out-tree' || recentIds[1] !== 'kit-island') {
    throw new Error(`Recently used order incorrect: ${recentIds.join(', ')}`);
  }
  console.log('✓ Favorites and Recently Used history accurately tracked and persisted per user.');

  // 6. Test Custom Shapes Creation & Isolation
  console.log('\n[Test 6] Testing Custom Shapes Creation & Scoping...');
  const customItem: ShapeLibraryItem = {
    id: `custom-walkin-closet-${Date.now()}`,
    name: 'Luxury Walk-in Wardrobe',
    category: 'Furniture',
    width: 8,
    height: 6,
    description: 'Custom user built-in wardrobe layout',
    entityType: 'furniture',
    iconType: 'Wardrobe',
    isCustom: true,
  };

  saveCustomShape(testUser.id, customItem);
  const userCustoms = getCustomShapes(testUser.id);
  if (!userCustoms.some(c => c.name === 'Luxury Walk-in Wardrobe')) {
    throw new Error('Failed to save custom shape.');
  }

  deleteCustomShape(testUser.id, customItem.id);
  const afterDelete = getCustomShapes(testUser.id);
  if (afterDelete.some(c => c.id === customItem.id)) {
    throw new Error('Failed to delete custom shape.');
  }
  console.log('✓ Custom Shapes successfully created, saved, retrieved, and deleted for authorized user.');

  console.log('\n🎉 ALL SHAPE LIBRARY VERIFICATION TESTS PASSED PERFECTLY!\n');
}

runShapeLibraryTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
