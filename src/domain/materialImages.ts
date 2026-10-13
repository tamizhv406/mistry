/**
 * Bundled material photographs and their licences.
 *
 * Every file listed here is stored in `public/material-images/` and was taken from Wikimedia
 * Commons under the licence shown, then cropped/resized to 480x360. See
 * `public/material-images/CREDITS.md` for the same list in readable form.
 * A material with no entry simply shows a neutral placeholder.
 *
 * The photos show the kind of material, not a particular brand or product on sale.
 */
import type { ToolImage } from './toolImages';

export const MATERIAL_IMAGES: Record<string, ToolImage> = {
  'aggregate': { file: 'material-images/aggregate.jpg', author: 'RanjithSiji', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Stone_Crush_Metel.JPG' },
  'blocks': { file: 'material-images/blocks.jpg', author: 'Anish nellickal', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Concrete_masonry_unit_5z_.jpg' },
  'bricks': { file: 'material-images/bricks.jpg', author: '玄史生', license: 'CC0', source: 'https://commons.wikimedia.org/wiki/File:Red_Bricks_Stack_on_Sidewalk_of_Lane_212,_Section_5,_Minsheng_East_Road,_Taipei_20160829.jpg' },
  'cement': { file: 'material-images/cement.jpg', author: 'Szlomo Lejb', license: 'CC BY 3.0', source: 'https://commons.wikimedia.org/wiki/File:Cement_04.JPG' },
  'electrical': { file: 'material-images/electrical.jpg', author: 'PattayaPatrol', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:DZ6_2542_A_narrow_cluttered_electronics_shop_aisle_lined_with_shelves_of_components_spools_of_wire_and_glass_display_cases_overflowing_with_parts.jpg' },
  'hardware': { file: 'material-images/hardware.jpg', author: 'tinspoon from Saarlouis', license: 'CC BY 2.0', source: 'https://commons.wikimedia.org/wiki/File:Cluster-2.jpg' },
  'm-sand': { file: 'material-images/m-sand.jpg', author: 'Thamizhpparithi Maari', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:M-Sand_in_Salem.jpg' },
  'paint': { file: 'material-images/paint.jpg', author: 'United Soybean Board', license: 'CC BY 2.0', source: 'https://commons.wikimedia.org/wiki/File:Open_Soy_Paint_Cans_(10481725136).jpg' },
  'plumbing': { file: 'material-images/plumbing.jpg', author: 'Стрелец Игорь', license: 'CC BY 3.0', source: 'https://commons.wikimedia.org/wiki/File:PVC_pressure.jpg' },
  'river-sand': { file: 'material-images/river-sand.jpg', author: 'W.carter', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Pile_of_fine_sand_at_Brastad_Arena_2.jpg' },
  'steel-rods': { file: 'material-images/steel-rods.jpg', author: 'W.carter', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:A_bunch_of_rebar.jpg' },
  'tiles': { file: 'material-images/tiles.jpg', author: 'Houss 2020', license: 'CC0', source: 'https://commons.wikimedia.org/wiki/File:Ceramic_tiles_01.jpg' },
  'wood': { file: 'material-images/wood.jpg', author: 'Elke Wetzig (elya)', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Tischlerplatte_2009.jpg' },
};
