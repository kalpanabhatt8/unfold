import {
  CloudLightning,
  Contrast,
  Eye,
  Gavel,
  HeartHandshake,
  Hourglass,
  RefreshCw,
  Scale,
  ShieldQuestion,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { PatternName } from "@/lib/patterns/vocabulary";

/** One quiet, neutral glyph per mental pattern. */
export const PATTERN_ICONS: Record<PatternName, LucideIcon> = {
  comparison: Scale,
  self_doubt: ShieldQuestion,
  overthinking: RefreshCw,
  perfectionism: Target,
  avoidance: Hourglass,
  catastrophizing: CloudLightning,
  people_pleasing: HeartHandshake,
  fear_of_judgment: Eye,
  self_criticism: Gavel,
  all_or_nothing: Contrast,
};
