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

const approvalBusiness = qs('#approval-business');
const approvalBusinessOut = qs('#approval-business-out');
const approvalRole = qs('#approval-role');
const resetApproval = qs('#approval-reset');
const approvalSaveBtn = qs('#approval-save');
const approvalSubmitBtn = qs('#approval-submit');
const approvalApproveBtn = qs('#approval-approve');
const approvalRejectBtn = qs('#approval-reject');
const approvalFormJson = qs('#approval-form-json');

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

const STORAGE_KEY = 'ai-engineering-demo.approvalState.v1';
/** @type {ReturnType<typeof runApprovalPipeline> | null} */
let currentApprovalPipeline = null;

function tryParseJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function createDefaultForm(schemaOutput) {
  const props = schemaOutput?.jsonSchema?.properties || {};
  const obj = {};
  for (const [k, def] of Object.entries(props)) {
    if (def.type === 'number') obj[k] = 0;
    else if (def.type === 'array') obj[k] = [];
    else obj[k] = '';
  }
  // 给一些业务字段更像真实值（用于演示）
  if ('applicantName' in obj) obj.applicantName = '张三';
  if ('leaveDays' in obj) obj.leaveDays = 1;
  if ('reason' in obj) obj.reason = '因公请假';
  return obj;
}

function validateForm(schemaOutput, formData) {
  const errors = [];
  const required = schemaOutput?.jsonSchema?.required || [];
  for (const key of required) {
    const v = formData?.[key];
    const def = schemaOutput?.jsonSchema?.properties?.[key];
    if (def?.type === 'number') {
      if (typeof v !== 'number' || Number.isNaN(v)) errors.push(`${key} 必须是数字`);
    } else if (def?.type === 'array') {
      if (!Array.isArray(v)) errors.push(`${key} 必须是数组`);
    } else {
      if (typeof v !== 'string' || v.trim() === '') errors.push(`${key} 不能为空`);
    }
  }

  // 覆盖我们在 schemaAgent 里写死的规则范围（用于 demo）
  const rules = schemaOutput?.validationRules || [];
  for (const r of rules) {
    if (!r.rules) continue;
    for (const rule of r.rules) {
      if (rule.kind === 'range') {
        const v = formData?.[rule.field];
        if (typeof v === 'number') {
          if (v < rule.min || v > rule.max) {
            errors.push(`${rule.field} 超出范围 [${rule.min}, ${rule.max}]`);
          }
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

function getPermissionForNode(workflowOutput, nodeId) {
  const list = workflowOutput?.permissionSketch || [];
  return list.find((x) => x.node === nodeId);
}

function orderNodes(workflowOutput) {
  const nodes = workflowOutput?.bpmnLike?.nodes || [];
  return [...nodes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function buildInitialApprovalBusinessState(pipelineOutput) {
  const nodes = orderNodes(pipelineOutput.workflow);
  const statusByNode = {};
  for (const n of nodes) statusByNode[n.id] = 'pending';
  statusByNode[nodes[0].id] = 'current';

  return {
    currentNodeId: nodes[0].id,
    statusByNode,
    history: [],
    updatedAt: Date.now(),
  };
}

function saveApprovalBusinessState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadApprovalBusinessState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const parsed = tryParseJson(raw);
  return parsed;
}

function renderApprovalBusiness(state, pipelineOutput) {
  const nodes = orderNodes(pipelineOutput.workflow);
  const curId = state.currentNodeId;
  const curName = nodes.find((n) => n.id === curId)?.name || curId;

  const role = approvalRole.value;
  const curPerm = getPermissionForNode(pipelineOutput.workflow, curId);
  const allowed =
    curPerm?.rolesAllowed?.includes(role) ? curPerm.actions || [] : [];

  const statusLabel = (s) => {
    if (s === 'current') return `<span class="badge" style="color:#4fc3f7">当前</span>`;
    if (s === 'approved')
      return `<span class="badge" style="color:#81c784">已通过</span>`;
    if (s === 'rejected')
      return `<span class="badge" style="color:#ff8a80">已驳回</span>`;
    return `<span class="badge" style="color:#8b9cb3">待处理</span>`;
  };

  const stepHtml = nodes
    .map((n) => {
      const s = state.statusByNode[n.id] || 'pending';
      return `
        <details class="step" ${n.id === curId ? 'open' : ''}>
          <summary>
            ${n.name}
            ${statusLabel(s)}
          </summary>
          <pre>${escapeHtml(`节点=${n.id}`)}</pre>
        </details>`;
    })
    .join('');

  const history = (state.history || [])
    .slice(-6)
    .map((h) => `<pre>${escapeHtml(JSON.stringify(h, null, 2))}</pre>`)
    .join('');

  const message = [];
  message.push(`<p><strong>当前节点：</strong>${escapeHtml(curName)}</p>`);
  message.push(`<p><strong>允许动作：</strong>${allowed.length ? escapeHtml(allowed.join(', ')) : '无（检查角色/流程）'}</p>`);

  approvalBusinessOut.innerHTML = `
    <div class="steps">
      ${stepHtml}
    </div>
    <div class="output" style="margin-top:1.25rem;">
      ${message.join('')}
      <div style="margin-top:0.75rem;">
        <strong>最近操作：</strong>
        ${history || '<pre>暂无</pre>'}
      </div>
    </div>
  `;
  approvalBusinessOut.hidden = false;
}

function applyApprovalAction(pipelineOutput, businessState, actionType, formData) {
  const curId = businessState.currentNodeId;
  const curPerm = getPermissionForNode(pipelineOutput.workflow, curId);
  const role = approvalRole.value;

  if (!curPerm?.rolesAllowed?.includes(role)) {
    return { ok: false, error: '当前角色无权限操作该节点' };
  }

  if (!(curPerm.actions || []).includes(actionType)) {
    return { ok: false, error: `动作 "${actionType}" 未在当前节点允许列表中` };
  }

  const nodes = orderNodes(pipelineOutput.workflow);
  const curIndex = nodes.findIndex((n) => n.id === curId);
  if (curIndex < 0) return { ok: false, error: '流程状态异常（找不到当前节点）' };

  const transitions = pipelineOutput.workflow?.bpmnLike?.transitions || [];
  const approveTransition = transitions.find((t) => t.from === curId && t.on === 'approve');

  const nextState = {
    ...businessState,
    statusByNode: { ...businessState.statusByNode },
    history: [...(businessState.history || [])],
    updatedAt: Date.now(),
  };

  const now = new Date().toISOString();
  const pushHistory = (payload) => {
    nextState.history.push({ at: now, role, action: actionType, ...payload });
  };

  if (actionType === 'edit' || actionType === 'save') {
    // 保存不推进节点
    pushHistory({ kind: 'save', form: formData });
    return { ok: true, nextState };
  }

  if (actionType === 'reject') {
    if (curIndex <= 0) {
      return { ok: false, error: '已在最初节点，无法驳回' };
    }
    nextState.statusByNode[curId] = 'rejected';
    const prev = nodes[curIndex - 1];
    nextState.currentNodeId = prev.id;
    nextState.statusByNode[prev.id] = 'current';
    // 后续节点回到待处理
    // 注意：curId 本身保持 rejected，不能被覆盖
    for (let i = curIndex + 1; i < nodes.length; i++) {
      nextState.statusByNode[nodes[i].id] = 'pending';
    }
    pushHistory({ kind: 'reject', to: prev.id });
    return { ok: true, nextState };
  }

  // submit / approve：推进到后继节点（demo 为线性 approve）
  const needsValidation = actionType === 'submit' || actionType === 'approve';
  if (needsValidation) {
    const { ok, errors } = validateForm(pipelineOutput.schema, formData);
    if (!ok) return { ok: false, error: `校验失败：${errors.join('；')}` };
  }

  if (!approveTransition) {
    return { ok: false, error: '未找到可推进的审批转移' };
  }

  const next = approveTransition.to;
  nextState.statusByNode[curId] = 'approved';
  nextState.currentNodeId = next;
  nextState.statusByNode[next] = 'current';

  pushHistory({ kind: 'forward', from: curId, to: next });
  return { ok: true, nextState };
}

function syncApprovalUiFromState(pipelineOutput) {
  const state = loadApprovalBusinessState() || buildInitialApprovalBusinessState(pipelineOutput);
  saveApprovalBusinessState(state);
  renderApprovalBusiness(state, pipelineOutput);
}

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

    currentApprovalPipeline = result;
    // 重新初始化业务模拟
    approvalBusiness.hidden = false;
    approvalBusinessOut.hidden = true;
    const defaultForm = createDefaultForm(result.schema);
    approvalFormJson.value = pretty(defaultForm);

    saveApprovalBusinessState(buildInitialApprovalBusinessState(result));
    renderApprovalBusiness(loadApprovalBusinessState(), result);
  } catch (e) {
    approvalOut.innerHTML = `<p class="error">${escapeHtml(String(e))}</p>`;
  }
});

resetApproval.addEventListener('click', () => {
  if (!currentApprovalPipeline) {
    approvalBusiness.hidden = false;
    approvalBusinessOut.innerHTML = `<p class="error">请先点击「运行流水线」生成审批流。</p>`;
    approvalBusinessOut.hidden = false;
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
  approvalBusinessOut.hidden = true;
  saveApprovalBusinessState(buildInitialApprovalBusinessState(currentApprovalPipeline));
  syncApprovalUiFromState(currentApprovalPipeline);
});

function currentFormDataOrError() {
  const raw = approvalFormJson.value.trim();
  const parsed = tryParseJson(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: '表单 JSON 必须是对象' };
  }
  return { ok: true, formData: parsed };
}

function doAction(actionType) {
  if (!currentApprovalPipeline) {
    approvalBusinessOut.hidden = false;
    approvalBusinessOut.innerHTML = `<p class="error">请先点击「运行流水线」。</p>`;
    return;
  }
  const state = loadApprovalBusinessState();
  if (!state) {
    approvalBusinessOut.hidden = false;
    approvalBusinessOut.innerHTML = `<p class="error">业务状态丢失，请重置。</p>`;
    return;
  }

  const { ok, formData, error } = currentFormDataOrError();
  if (!ok) {
    approvalBusinessOut.hidden = false;
    approvalBusinessOut.innerHTML = `<p class="error">${escapeHtml(error)}</p>`;
    return;
  }

  // 按权限动作推进
  const applied = applyApprovalAction(currentApprovalPipeline, state, actionType, formData);
  if (!applied.ok) {
    approvalBusinessOut.hidden = false;
    approvalBusinessOut.innerHTML = `<p class="error">${escapeHtml(applied.error)}</p>`;
    return;
  }

  saveApprovalBusinessState(applied.nextState);
  renderApprovalBusiness(applied.nextState, currentApprovalPipeline);
}

approvalRole.addEventListener('change', () => {
  if (!currentApprovalPipeline) return;
  syncApprovalUiFromState(currentApprovalPipeline);
});

approvalSaveBtn.addEventListener('click', () => doAction('save'));
approvalSubmitBtn.addEventListener('click', () => doAction('submit'));
approvalApproveBtn.addEventListener('click', () => doAction('approve'));
approvalRejectBtn.addEventListener('click', () => doAction('reject'));

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
