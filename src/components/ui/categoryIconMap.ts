import {
  Anvil, BrickWall, Boxes, Construction, Cylinder, Disc3, Drill, Droplets, Grid2x2, Hammer, HardHat, Link, Mountain,
  Package, PaintRoller, Pickaxe, Ruler, Scissors, Shovel, TreePine, Wrench, Zap, type LucideIcon,
} from 'lucide-react';
import type { IconName } from '../../domain/categoryIcons';

/** The lucide-react component for each icon name in `domain/categoryIcons.ts`. */
export const ICON_COMPONENTS: Record<IconName, LucideIcon> = {
  Package, Mountain, Anvil, BrickWall, Wrench, Zap, Droplets, PaintRoller, Boxes,
  Grid2x2, TreePine, Hammer, Shovel, Pickaxe, Ruler, Drill, Disc3, HardHat, Construction, Cylinder, Link, Scissors,
};
