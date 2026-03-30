import {
  ArrowRightCircle,
  Sunrise,
  RefreshCw,
  ClipboardList,
  Phone,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface StageConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  order: number;
}

// Keyed by STAGE_ORDER (1-5) for reliable lookup regardless of STAGE_KEY values in Snowflake
export const STAGE_CONFIG: Record<number, StageConfig> = {
  1: { key: 'admission',      label: 'Admission',      icon: ArrowRightCircle, order: 1 },
  2: { key: 'early-stay',     label: 'Early Stay',     icon: Sunrise,       order: 2 },
  3: { key: 'mid-stay',       label: 'Mid Stay',       icon: RefreshCw,     order: 3 },
  4: { key: 'pre-discharge',  label: 'Pre-Discharge',  icon: ClipboardList, order: 4 },
  5: { key: 'follow-up',      label: 'Follow Up',      icon: Phone,         order: 5 },
};

export const STAGE_ORDERS = [1, 2, 3, 4, 5] as const;
