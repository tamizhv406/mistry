/**
 * Bundled tool photographs and their licences.
 *
 * Every file listed here is stored in `public/tool-images/` and was taken from Wikimedia
 * Commons under the licence shown, then cropped/resized to 480x360. See
 * `public/tool-images/CREDITS.md` for the same list in readable form.
 * A tool with no entry simply shows a neutral placeholder.
 *
 * Generated file: edit the selection in the asset build script, not here.
 */
export interface ToolImage {
  file: string;       // path relative to the app base
  author: string;
  license: string;
  source: string;     // Wikimedia Commons file page
}

export const TOOL_IMAGES: Record<string, ToolImage> = {
  'claw-hammer': { file: 'tool-images/claw-hammer.jpg', author: 'Santeri Viinamäki', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Magnum_25116_claw_hammer.jpg' },
  'pliers': { file: 'tool-images/pliers.jpg', author: 'Jacek Halicki', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:2023_Kombinerki_(2).jpg' },
  'spanner': { file: 'tool-images/spanner.jpg', author: 'Ocdp', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Combination_wrenches.jpg' },
  'screwdriver': { file: 'tool-images/screwdriver.jpg', author: '多多123', license: 'CC BY 4.0', source: 'https://commons.wikimedia.org/wiki/File:Black_screwdriver.png' },
  'brick-trowel': { file: 'tool-images/brick-trowel.jpg', author: 'Mike Lupinacci', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Masons_trowel.jpg' },
  'crowbar': { file: 'tool-images/crowbar.jpg', author: 'Juha Kämäräinen', license: 'Public domain', source: 'https://commons.wikimedia.org/wiki/File:Crowbar_without_haft.jpg' },
  'shovel': { file: 'tool-images/shovel.jpg', author: 'Shixart1985', license: 'CC BY 2.0', source: 'https://commons.wikimedia.org/wiki/File:Garden_tool_resting_on_fresh_soil_in_preparation_for_planting_seeds_in_a_home_garden.jpg' },
  'pickaxe': { file: 'tool-images/pickaxe.jpg', author: 'Hyena~commonswiki', license: 'Public domain', source: 'https://commons.wikimedia.org/wiki/File:Pickaxe.jpg' },
  'chisel': { file: 'tool-images/chisel.jpg', author: 'Za', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Chisel_wood_24mm.jpg' },
  'hand-saw': { file: 'tool-images/hand-saw.jpg', author: 'Mnemosine', license: 'Public domain', source: 'https://commons.wikimedia.org/wiki/File:Pily_rozne_01.jpg' },
  'hacksaw': { file: 'tool-images/hacksaw.jpg', author: 'Luke Milburn', license: 'CC BY 2.0', source: 'https://commons.wikimedia.org/wiki/File:Hacksaw_with_grey_handle.jpg' },
  'measuring-tape': { file: 'tool-images/measuring-tape.jpg', author: '多多123', license: 'CC BY 4.0', source: 'https://commons.wikimedia.org/wiki/File:B%26Q_Tape_Measure.jpg' },
  'spirit-level': { file: 'tool-images/spirit-level.jpg', author: 'Evan-Amos', license: 'Public domain', source: 'https://commons.wikimedia.org/wiki/File:Tool-level.jpg' },
  'laser-measure': { file: 'tool-images/laser-measure.jpg', author: 'Krzysztof Maria Różański, ( Upior polnocy )', license: 'CC BY 2.5', source: 'https://commons.wikimedia.org/wiki/File:Handheld_laser_distance_meter.jpg' },
  'plumb-bob': { file: 'tool-images/plumb-bob.jpg', author: 'Salil Kumar Mukherjee', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Plumb_bob_with_string.jpg' },
  'try-square': { file: 'tool-images/try-square.jpg', author: 'Luke Milburn', license: 'CC BY 2.0', source: 'https://commons.wikimedia.org/wiki/File:Try_Square.jpg' },
  'wheelbarrow': { file: 'tool-images/wheelbarrow.jpg', author: 'Oto Zapletal', license: 'CC BY 4.0', source: 'https://commons.wikimedia.org/wiki/File:Two_wheelbarrows.jpg' },
  'ladder': { file: 'tool-images/ladder.jpg', author: 'Amin', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Ladder_aluminum.jpg' },
  'chain-block': { file: 'tool-images/chain-block.jpg', author: 'HardMediaGroup', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:%D0%A6%D0%B5%D0%BF%D0%BD%D0%B0%D1%8F_%D1%82%D0%B0%D0%BB%D1%8C.jpg' },
  'bucket': { file: 'tool-images/bucket.jpg', author: 'Chandapiwa Malema', license: 'CC0', source: 'https://commons.wikimedia.org/wiki/File:A_metal_bucket_for_collecting_water_to_water_plants.jpg' },
  'drill': { file: 'tool-images/drill.jpg', author: 'Wilfredor', license: 'CC0', source: 'https://commons.wikimedia.org/wiki/File:Repair_tool_kit.jpg' },
  'angle-grinder': { file: 'tool-images/angle-grinder.jpg', author: 'soulfish (Flickr)', license: 'CC BY-SA 2.0', source: 'https://commons.wikimedia.org/wiki/File:AngleGrinder.jpg' },
  'tile-cutter': { file: 'tool-images/tile-cutter.jpg', author: 'Wielkijacek', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Montolit_MASTERPIUMA_93_P3.jpg' },
  'concrete-vibrator': { file: 'tool-images/concrete-vibrator.jpg', author: 'Lievers holland', license: 'CC0', source: 'https://commons.wikimedia.org/wiki/File:P14Eactie1_(cropped_to_concrete_vibrator).JPG' },
  'scaffolding': { file: 'tool-images/scaffolding.jpg', author: 'Fons Heijnsbroek from Amsterdam, Netherlands', license: 'CC0', source: 'https://commons.wikimedia.org/wiki/File:2006.10_-_%27Building_construction_site_%26_many_scaffold_tubes%27_-_Amsterdam_photos_and_pictures,_ath_the_construction_site,_at_the_Oosterdok_Docklands;_Dutch_city_%2B_geotag,_Fons_Heijnsbroek,_The_Netherlands_(27572224141).jpg' },
  'concrete-mixer': { file: 'tool-images/concrete-mixer.jpg', author: 'Jacks Rache', license: 'Public domain', source: 'https://commons.wikimedia.org/wiki/File:Cement_mixer2.jpg' },
  'safety-helmet': { file: 'tool-images/safety-helmet.jpg', author: 'רנדום', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Yellow_hard_hat.jpg' },
};
