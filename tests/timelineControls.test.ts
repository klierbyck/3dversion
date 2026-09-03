import { describe, expect, it } from 'vitest';
import {
  durationUnits,
  formatDurationInput,
  parseDurationInput,
  preferredDurationUnit,
} from '../src/lib/timelineDuration';
import { TIMELINE_SPEEDS, normalizeTimeline } from '../src/timeline';

describe('时长单位换算', () => {
  it('按秒数自动选择合适单位', () => {
    expect(preferredDurationUnit(12)).toBe('seconds');
    expect(preferredDurationUnit(120)).toBe('minutes');
    expect(preferredDurationUnit(3600)).toBe('hours');
  });

  it('秒/分/时换算系数正确', () => {
    expect(durationUnits.seconds.factor).toBe(1);
    expect(durationUnits.minutes.factor).toBe(60);
    expect(durationUnits.hours.factor).toBe(3600);
  });

  it('120 秒按“分”展示为 2，12 秒按“秒”展示为 12', () => {
    expect(formatDurationInput(120, 'minutes')).toBe('2');
    expect(formatDurationInput(12, 'seconds')).toBe('12');
    expect(formatDurationInput(3600, 'hours')).toBe('1');
  });

  it('输入文本按单位换算回秒数，支持逗号小数点', () => {
    expect(parseDurationInput('2', 'minutes')).toBe(120);
    expect(parseDurationInput('1,5', 'minutes')).toBe(90);
  });

  it('非法或非正输入返回 null', () => {
    expect(parseDurationInput('', 'seconds')).toBeNull();
    expect(parseDurationInput('abc', 'seconds')).toBeNull();
    expect(parseDurationInput('-3', 'seconds')).toBeNull();
    expect(parseDurationInput('0', 'seconds')).toBeNull();
  });
});

describe('时间轴播放速度', () => {
  it('提供 0.25/0.5/1/2 四档，最低档为 0.25', () => {
    expect([...TIMELINE_SPEEDS]).toEqual([0.25, 0.5, 1, 2]);
  });

  it('合法速度被保留，非法速度回落到 1', () => {
    expect(normalizeTimeline({ duration: 12, loop: false, speed: 0.25, keyframes: [] }).speed).toBe(0.25);
    // @ts-expect-error 故意传入非法档位
    expect(normalizeTimeline({ duration: 12, loop: false, speed: 3, keyframes: [] }).speed).toBe(1);
  });
});
