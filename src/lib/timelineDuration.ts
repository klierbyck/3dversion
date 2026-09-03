export type TimelineDurationUnit = 'seconds' | 'minutes' | 'hours';

export const durationUnits: Record<
  TimelineDurationUnit,
  { label: string; factor: number; precision: number }
> = {
  seconds: { label: '秒', factor: 1, precision: 2 },
  minutes: { label: '分', factor: 60, precision: 4 },
  hours: { label: '时', factor: 3600, precision: 6 },
};

/** 根据秒数自动选择最合适的展示单位。 */
export function preferredDurationUnit(seconds: number): TimelineDurationUnit {
  if (seconds >= 3600) return 'hours';
  if (seconds >= 60) return 'minutes';
  return 'seconds';
}

/** 把秒数按目标单位格式化为输入框文本。 */
export function formatDurationInput(seconds: number, unit: TimelineDurationUnit) {
  const config = durationUnits[unit];
  return String(Number((seconds / config.factor).toFixed(config.precision)));
}

/** 把输入框文本按单位换算回秒数；非法或非正数返回 null。 */
export function parseDurationInput(
  raw: string,
  unit: TimelineDurationUnit,
): number | null {
  const value = Number(raw.replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;
  return value * durationUnits[unit].factor;
}
