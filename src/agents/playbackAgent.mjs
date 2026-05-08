/**
 * 播放行为 Agent：根据事件序列推断控制策略（禁止快进 / 仅后退等）。
 */
export function runPlaybackAgent({ events = [], policyGoal = 'effective_learning' }) {
  let forwardSkips = 0;
  let rapidSeeks = 0;
  let abnormalSpeed = 0;

  for (const e of events) {
    if (e.type === 'seek' && typeof e.from === 'number' && typeof e.to === 'number') {
      if (e.to - e.from > 30) forwardSkips += 1;
      if (e.deltaMs != null && e.deltaMs < 200) rapidSeeks += 1;
    }
    if (e.type === 'ratechange' && e.rate > 2) abnormalSpeed += 1;
  }

  let dragMode = 'free';
  let maxRate = 2;

  if (policyGoal === 'strict_compliance') {
    dragMode = 'no_forward';
    maxRate = 1.25;
  } else if (forwardSkips >= 2 || rapidSeeks >= 3) {
    dragMode = 'backward_only';
    maxRate = 1.5;
  } else if (forwardSkips >= 1) {
    dragMode = 'no_forward';
    maxRate = 2;
  }

  const reasons = [];
  if (forwardSkips) reasons.push(`检测到 ${forwardSkips} 次大幅向前跳转`);
  if (rapidSeeks) reasons.push(`检测到 ${rapidSeeks} 次快速拖动`);
  if (abnormalSpeed) reasons.push(`检测到 ${abnormalSpeed} 次异常倍速`);

  return {
    stage: 'playback',
    inferredPolicy: { dragMode, maxRate, persistProgress: true, syncAcrossDevices: true },
    signals: { forwardSkips, rapidSeeks, abnormalSpeed },
    reasons: reasons.length ? reasons : ['行为正常，维持默认策略'],
  };
}
