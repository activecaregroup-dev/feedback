import {
  ArrowRightCircle,
  CalendarCheck,
  CalendarClock,
  Activity,
  PackageCheck,
  Phone,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface StageConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  order: number;
}

// Keyed by STAGE_ORDER (1-6) for reliable lookup regardless of STAGE_KEY values in Snowflake
export const STAGE_CONFIG: Record<number, StageConfig> = {
  1: { key: 'admission',      label: 'Admission',      icon: ArrowRightCircle, order: 1 },
  2: { key: 'day-10',         label: 'Day 10',         icon: CalendarCheck,    order: 2 },
  3: { key: 'mid-stay',       label: 'Mid Stay',       icon: CalendarClock,    order: 3 },
  4: { key: 'pre-discharge',  label: 'Pre Discharge',  icon: Activity,         order: 4 },
  5: { key: 'discharge',      label: 'Discharge',      icon: PackageCheck,     order: 5 },
  6: { key: 'follow-up',      label: 'Follow Up',      icon: Phone,            order: 6 },
};

export const STAGE_ORDERS = [1, 2, 3, 4, 5, 6] as const;
