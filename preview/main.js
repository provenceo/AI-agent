import {
  runApprovalPipeline,
  runPlaybackPipeline,
  runPerformancePipeline,
} from '@src/pipeline.mjs';

const DEFAULT_APPROVAL =
  '做一个请假审批：需要申请人、请假天数、事由和附件；先主管审批，再人事归档。';

const DEFAULT_PLAYBACK_EVENTS = [
  { type: 'seek', from: 10, to: 400, deltaMs: 80 },
  { type: 'seek', from: 400, to: 900, deltaMs: 90 },
  { type: 'ratechange', rate: 2.5 },
];

function qs(sel, root = document) {
  const el = root.querySelector(sel);
  if (!el) throw new Error(`Missing element: ${sel}`);
  return el;
}

function pretty(obj) {
  return JSON.stringify(obj, null, 2);
}

function renderApprovalSteps(result) {
  const parts = [
    ['需求解析', result.requirement],
    ['Schema / 校验', result.schema],
    ['代码生成', result.codegen],
    ['流程 / 权限', result.workflow],
  ];
  return parts
    .map(
      ([title, data]) => `
    <details class="step" open>
      <summary>${title}<span class="badge">${data.stage}</span></summary>
      <pre>${escapeHtml(pretty(data))}</pre>
    </details>`,
    )
    .join('');
}

function escapeHtml(s) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** @type {HTMLElement} */
const approvalText = qs('#approval-text');
const approvalOut = qs('#approval-out');
const runApproval = qs('#run-approval');

const playbackGoal = qs('#playback-goal');
const playbackEvents = qs('#playback-events');
const playbackOut = qs('#playback-out');
const runPlayback = qs('#run-playback');

const performanceJson = qs('#performance-json');
const performanceOut = qs('#performance-out');
const runPerformance = qs('#run-performance');
const resetPerf = qs('#reset-performance-sample');
const clearPerf = qs('#clear-performance-json');

const PERFORMANCE_PLACEHOLDER = `{
  "userId": "u-1001",
  "displayName": "自定义样本",
  "meta": "可粘贴接口 JSON；清空后点「扫描」将使用内置大 Base64 演示数据"
}`;

approvalText.value = DEFAULT_APPROVAL;
playbackEvents.value = pretty(DEFAULT_PLAYBACK_EVENTS);
performanceJson.value = PERFORMANCE_PLACEHOLDER;

// Tabs
for (const btn of document.querySelectorAll('.tab[data-tab]')) {
  btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-tab');
    for (const b of document.querySelectorAll('.tab')) {
      b.classList.toggle('is-active', b === btn);
      b.setAttribute('aria-selected', String(b === btn));
    }
    for (const panel of document.querySelectorAll('.panel')) {
      const show = panel.id === `panel-${id}`;
      panel.classList.toggle('is-visible', show);
      panel.hidden = !show;
    }
  });
}

runApproval.addEventListener('click', () => {
  approvalOut.hidden = false;
  try {
    const result = runApprovalPipeline(approvalText.value);
    approvalOut.innerHTML = `<div class="steps">${renderApprovalSteps(result)}</div>`;
  } catch (e) {
    approvalOut.innerHTML = `<p class="error">${escapeHtml(String(e))}</p>`;
  }
});

runPlayback.addEventListener('click', () => {
  playbackOut.hidden = false;
  try {
    const raw = playbackEvents.value.trim();
    const events = JSON.parse(raw);
    if (!Array.isArray(events)) throw new TypeError('事件必须是 JSON 数组');
    const result = runPlaybackPipeline({
      policyGoal: playbackGoal.value,
      events,
    });
    playbackOut.innerHTML = `<div class="steps">
      <details class="step" open>
        <summary>播放策略<span class="badge">${result.playback.stage}</span></summary>
        <pre>${escapeHtml(pretty(result))}</pre>
      </details>
    </div>`;
  } catch (e) {
    playbackOut.innerHTML = `<p class="error">JSON 解析失败：${escapeHtml(String(e))}</p>`;
  }
});

runPerformance.addEventListener('click', () => {
  performanceOut.hidden = false;
  try {
    const raw = performanceJson.value.trim();
    let result;
    if (!raw) {
      result = runPerformancePipeline();
    } else {
      const sample = JSON.parse(raw);
      if (sample == null || typeof sample !== 'object' || Array.isArray(sample)) {
        throw new TypeError('根节点必须是 JSON 对象');
      }
      result = runPerformancePipeline(sample);
    }
    performanceOut.innerHTML = `<div class="steps">
      <details class="step" open>
        <summary>扫描结果<span class="badge">${result.performance.stage}</span></summary>
        <pre>${escapeHtml(pretty(result))}</pre>
      </details>
    </div>`;
  } catch (e) {
    performanceOut.innerHTML = `<p class="error">${escapeHtml(String(e))}</p>`;
  }
});

resetPerf.addEventListener('click', () => {
  performanceJson.value = PERFORMANCE_PLACEHOLDER;
});

clearPerf.addEventListener('click', () => {
  performanceJson.value = '';
});
