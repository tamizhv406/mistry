import test from 'node:test';
import assert from 'node:assert/strict';
import { SHAPE_LIBRARY_CATALOG, createEntityFromShape } from '../src/services/shapeLibraryCatalog';
import { defaultWallThickness, wallThicknessPresets } from '../src/domain/planMeasure';

test('Architectural Furniture Library & Wall System Verification', async (t) => {
  await t.test('1. Shape Library has corrected wall thickness defaults (9" exterior, 4.5" interior)', () => {
    const extWall = SHAPE_LIBRARY_CATALOG.find(s => s.id === 'fp-exterior-wall');
    assert.ok(extWall, 'Exterior wall exists in catalog');
    assert.equal(extWall.height, 0.75, 'Exterior wall catalog height is 0.75 ft (9 inches)');

    const intWall = SHAPE_LIBRARY_CATALOG.find(s => s.id === 'fp-interior-wall');
    assert.ok(intWall, 'Interior wall exists in catalog');
    assert.equal(intWall.height, 0.375, 'Interior wall catalog height is 0.375 ft (4.5 inches)');

    // Verify entity creation
    const createdExt = createEntityFromShape(extWall, 0, 0, 'feet');
    assert.equal((createdExt.payload as any).thickness, 0.75, 'Created exterior wall has 0.75 ft thickness');

    const createdInt = createEntityFromShape(intWall, 0, 0, 'feet');
    assert.equal((createdInt.payload as any).thickness, 0.375, 'Created interior wall has 0.375 ft thickness');
  });

  await t.test('2. Wall thickness presets provide 9", 4.5" and 3" options', () => {
    const presetsFeet = wallThicknessPresets('feet');
    assert.deepEqual(
      presetsFeet.map(p => ({ label: p.label, value: p.value })),
      [
        { label: '9"', value: 0.75 },
        { label: '4.5"', value: 0.375 },
        { label: '3"', value: 0.25 },
      ],
      'Wall thickness presets in feet include 9", 4.5" and 3"'
    );

    const presetsMeters = wallThicknessPresets('meters');
    assert.equal(presetsMeters.length, 3, 'Wall thickness presets in meters exist');
    assert.equal(presetsMeters[0].value, 0.23, '230 mm main wall');
    assert.equal(presetsMeters[1].value, 0.115, '115 mm partition wall');
  });

  await t.test('3. New professional furniture items exist in catalog with realistic dimensions', () => {
    const indianToilet = SHAPE_LIBRARY_CATALOG.find(s => s.id === 'bath-indian-toilet');
    assert.ok(indianToilet, 'Indian toilet exists in shape library');
    assert.equal(indianToilet.width, 2.5);
    assert.equal(indianToilet.height, 3);

    const sofa2 = SHAPE_LIBRARY_CATALOG.find(s => s.id === 'furn-sofa-2');
    assert.ok(sofa2, '2-Seater Sofa exists in shape library');
    assert.equal(sofa2.width, 5);
    assert.equal(sofa2.height, 3);

    const dressingTable = SHAPE_LIBRARY_CATALOG.find(s => s.id === 'furn-dressing-table');
    assert.ok(dressingTable, 'Dressing Table exists in shape library');
    assert.equal(dressingTable.width, 3.5);
    assert.equal(dressingTable.height, 1.5);
  });

  await t.test('4. Comprehensive architectural categories in catalog', () => {
    const requiredItems = [
      'Single Bed', 'Double Bed', 'Queen Bed', 'King Bed', 'Wardrobe',
      'Toilet', 'Wash Basin', 'Shower', 'Bathtub',
      'Sofa', 'L Sofa', 'Chair', 'Armchair', 'Coffee Table', 'TV Stand', 'Bookshelf',
      'Kitchen Counter', 'Sink', 'Stove', 'Oven', 'Refrigerator', 'Island',
      'Dining Table', '2-seat Dining Table', '4-seat Dining Table', '8-seat Dining Table',
      'Desk', 'Study Chair', 'Washing Machine', 'Ceiling Fan',
    ];

    for (const item of requiredItems) {
      const match = SHAPE_LIBRARY_CATALOG.find(s => s.name === item || s.iconType === item);
      assert.ok(match, `Shape catalog contains item: ${item}`);
    }
  });
});
