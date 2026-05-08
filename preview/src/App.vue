<template>
  <div class="app">
    <header class="hero">
      <h1>多 Agent 工程流水线</h1>
      <p class="lede">
        规则模拟长链推理：需求解析 → Schema → 代码草稿 → 流程；播放策略；性能扫描。
        页面提供「审批流执行」与「可预览钉钉结构树」。
      </p>
    </header>

    <nav class="tabs" role="tablist" aria-label="场景">
      <button
        type="button"
        class="tab"
        :class="{ 'is-active': activeTab === 'approval' }"
        role="tab"
        aria-selected="activeTab === 'approval'"
        @click="activeTab = 'approval'"
      >
        审批 / 表单
      </button>
      <button
        type="button"
        class="tab"
        :class="{ 'is-active': activeTab === 'playback' }"
        role="tab"
        aria-selected="activeTab === 'playback'"
        @click="activeTab = 'playback'"
      >
        智能播放
      </button>
      <button
        type="button"
        class="tab"
        :class="{ 'is-active': activeTab === 'performance' }"
        role="tab"
        aria-selected="activeTab === 'performance'"
        @click="activeTab = 'performance'"
      >
        性能治理
      </button>
    </nav>

    <main>
      <section v-if="activeTab === 'approval'" class="panel is-visible" role="tabpanel">
        <div class="panel-head">
          <h2>场景一：审批与动态表单</h2>
          <button type="button" class="btn primary" @click="runPipeline">运行流水线</button>
        </div>

        <label class="field">
          <span>业务需求（自然语言）</span>
          <textarea v-model="approvalText" rows="6" spellcheck="false" />
        </label>

        <div v-if="pipelineOutput" class="output" style="margin-top: 1rem">
          <details
            v-for="(item, idx) in approvalSteps"
            :key="idx"
            class="step"
            open
          >
            <summary>
              {{ item.title }}
              <span class="badge">{{ item.data.stage }}</span>
            </summary>
            <pre>{{ pretty(item.data) }}</pre>
          </details>
        </div>

        <div v-if="pipelineOutput" id="approval-business" class="output" style="margin-top: 1.2rem">
          <div class="panel-head" style="margin-bottom: 0.75rem">
            <h2 style="margin: 0; font-size: 1.05rem">业务模拟（审批流执行）</h2>
            <div class="actions">
              <button type="button" class="btn" @click="resetBusiness">重置业务模拟</button>
            </div>
          </div>

          <div class="row" style="margin-top: 0.2rem">
            <label class="field grow" style="margin-bottom: 0.75rem">
              <span>当前角色</span>
              <select v-model="role">
                <option value="applicant">申请人</option>
                <option value="manager">主管</option>
                <option value="hr">人事</option>
                <option value="finance">财务</option>
              </select>
            </label>
          </div>

          <div class="actions" style="margin-bottom: 0.75rem">
            <button type="button" class="btn" :disabled="!can('save')" @click="doAction('save')">保存</button>
            <button
              type="button"
              class="btn primary"
              :disabled="!can('submit')"
              @click="doAction('submit')"
            >
              提交
            </button>
            <button
              type="button"
              class="btn primary"
              :disabled="!can('approve')"
              @click="doAction('approve')"
            >
              审批通过
            </button>
            <button
              type="button"
              class="btn"
              :disabled="!can('reject')"
              @click="doAction('reject')"
            >
              驳回
            </button>
          </div>

          <div v-if="error" class="error" style="margin-bottom: 0.75rem">
            {{ error }}
          </div>

          <div class="output" style="margin-bottom: 1rem">
            <div class="steps">
              <details class="step" :open="true">
                <summary>
                  节点状态
                  <span class="badge">{{ business?.currentNodeId }}</span>
                </summary>
                <pre>{{ pretty(businessSummary) }}</pre>
              </details>
            </div>
          </div>

          <div class="output" style="margin-bottom: 1rem">
            <div class="panel-head" style="margin-bottom: 0.5rem">
              <h2 style="margin: 0; font-size: 1rem">表单 UI（自动渲染）</h2>
            </div>

            <div class="row" style="gap: 0.75rem; margin-bottom: 1rem">
              <div style="flex: 1; min-width: 280px">
                <div v-for="(def, key) in formFields" :key="key" class="field">
                  <span>{{ def.description || key }}</span>
                  <template v-if="def.type === 'number'">
                    <input v-model.number="formData[key]" type="number" />
                  </template>
                  <template v-else-if="def.type === 'array'">
                    <textarea
                      :value="arrayText[key]"
                      @input="onArrayTextInput(key, $event.target.value)"
                      rows="4"
                      placeholder="一行一个 URL / 文件名"
                    />
                  </template>
                  <template v-else>
                    <input v-model="formData[key]" type="text" />
                  </template>
                </div>
              </div>
              <div style="flex: 1; min-width: 260px">
                <details class="step" open>
                  <summary>
                    表单数据预览
                    <span class="badge">json</span>
                  </summary>
                  <pre>{{ pretty(formData) }}</pre>
                </details>
              </div>
            </div>
          </div>

          <div class="output" style="margin-top: 0.5rem">
            <div class="panel-head" style="margin-bottom: 0.5rem">
              <h2 style="margin: 0; font-size: 1rem">钉钉审批流结构树（Node 生成）</h2>
            </div>
            <details class="step" open>
              <summary>
                结构树
                <span class="badge">dingtalk</span>
              </summary>
              <pre>{{ pretty(dingTree) }}</pre>
            </details>
          </div>

          <div v-if="history.length" class="output" style="margin-top: 0.75rem">
            <details class="step" open>
              <summary>
                最近操作
                <span class="badge">{{ history.length }}</span>
              </summary>
              <pre>{{ pretty(history) }}</pre>
            </details>
          </div>
        </div>
      </section>

      <section v-if="activeTab === 'playback'" class="panel is-visible" role="tabpanel">
        <div class="panel-head">
          <h2>场景二：播放行为策略</h2>
          <button type="button" class="btn primary" @click="runPlayback">推断策略</button>
        </div>

        <div class="row">
          <label class="field grow">
            <span>学习目标</span>
            <select v-model="playbackGoal">
              <option value="effective_learning">有效学习（默认）</option>
              <option value="strict_compliance">严格合规</option>
            </select>
          </label>
        </div>

        <label class="field">
          <span>事件 JSON 数组（seek / ratechange）</span>
          <textarea v-model="playbackEventsText" rows="10" spellcheck="false" />
        </label>

        <div v-if="playbackOut" class="output" style="margin-top: 1.2rem">
          <details class="step" open>
            <summary>
              播放策略
              <span class="badge">{{ playbackOut.playback.stage }}</span>
            </summary>
            <pre>{{ pretty(playbackOut) }}</pre>
          </details>
        </div>
      </section>

      <section v-if="activeTab === 'performance'" class="panel is-visible" role="tabpanel">
        <div class="panel-head">
          <h2>场景三：接口与大字段扫描</h2>
          <div class="actions">
            <button type="button" class="btn" @click="resetPerf">恢复示例 JSON</button>
            <button type="button" class="btn" @click="clearPerf">清空（内置大字段）</button>
            <button type="button" class="btn primary" @click="runPerformance">扫描</button>
          </div>
        </div>

        <label class="field">
          <span>模拟接口 JSON（清空后点「扫描」使用内置大 Base64 演示）</span>
          <textarea v-model="performanceJsonText" rows="12" spellcheck="false" />
        </label>

        <div v-if="performanceOut" class="output" style="margin-top: 1.2rem">
          <details class="step" open>
            <summary>
              扫描结果
              <span class="badge">{{ performanceOut.performance.stage }}</span>
            </summary>
            <pre>{{ pretty(performanceOut) }}</pre>
          </details>
        </div>
      </section>
    </main>

    <footer class="foot">
      <span>CLI：<code>npm run demo:all</code></span>
      <span>预览：<code>npm run dev</code></span>
    </footer>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import {
  runApprovalPipeline,
  runPlaybackPipeline,
  runPerformancePipeline,
} from '@src/pipeline.mjs';
import { generateDingTalkApprovalStructureTree } from '@src/dingtalkWorkflowTree.mjs';

const STORAGE_KEY = 'ai-engineering-demo.approvalBusiness.v4';

const activeTab = ref('approval');

const approvalText = ref(
  '做一个请假审批：需要申请人、请假天数、事由和附件；先主管审批，再人事归档。'
);
const role = ref('applicant');

const pipelineOutput = ref(null);
const approvalOut = ref(null);

const error = ref('');
const business = ref(null);
const formData = reactive({});
const arrayText = reactive({});

const playbackGoal = ref('effective_learning');
const playbackEventsText = ref(
  JSON.stringify(
    [
      { type: 'seek', from: 10, to: 400, deltaMs: 80 },
      { type: 'seek', from: 400, to: 900, deltaMs: 90 },
      { type: 'ratechange', rate: 2.5 },
    ],
    null,
    2,
  ),
);
const playbackOut = ref(null);

const performanceJsonText = ref(
  `{
  "userId": "u-1001",
  "displayName": "自定义样本",
  "meta": "可粘贴接口 JSON；清空后点「扫描」将使用内置大 Base64 演示数据"
}`
);
const performanceOut = ref(null);

const pretty = (v) => JSON.stringify(v, null, 2);
const approvalSteps = computed(() => {
  if (!pipelineOutput.value) return [];
  return [
    { title: '需求解析', data: pipelineOutput.value.requirement },
    { title: 'Schema / 校验', data: pipelineOutput.value.schema },
    { title: '代码生成', data: pipelineOutput.value.codegen },
    { title: '流程 / 权限', data: pipelineOutput.value.workflow },
  ];
});

const formFields = computed(() => {
  return pipelineOutput.value?.schema?.jsonSchema?.properties || {};
});

const history = computed(() => (business.value?.history || []).slice(-6));
const businessSummary = computed(() => {
  if (!business.value || !pipelineOutput.value) return {};
  const nodes = [...(pipelineOutput.value.workflow?.bpmnLike?.nodes || [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
  const curId = business.value.currentNodeId;
  return {
    currentNodeId: curId,
    rolesAllowed: getPermissionForNode(pipelineOutput.value.workflow, curId)?.rolesAllowed || [],
    statusByNode: nodes.map((n) => ({ node: n.id, name: n.name, status: business.value.statusByNode?.[n.id] })),
  };
});

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function orderNodes(workflowOutput) {
  const nodes = workflowOutput?.bpmnLike?.nodes || [];
  return [...nodes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function getPermissionForNode(workflowOutput, nodeId) {
  const list = workflowOutput?.permissionSketch || [];
  return list.find((x) => x.node === nodeId);
}

function createDefaultForm(schemaOutput) {
  const props = schemaOutput?.jsonSchema?.properties || {};
  const obj = {};
  for (const [k, def] of Object.entries(props)) {
    if (def.type === 'number') obj[k] = 0;
    else if (def.type === 'array') obj[k] = [];
    else obj[k] = '';
  }
  if ('applicantName' in obj) obj.applicantName = '张三';
  if ('leaveDays' in obj) obj.leaveDays = 1;
  if ('reason' in obj) obj.reason = '因公请假';
  return obj;
}

function initFormFromSchema(schemaOutput) {
  const defaults = createDefaultForm(schemaOutput);
  Object.keys(formData).forEach((k) => delete formData[k]);
  Object.assign(formData, defaults);

  Object.keys(arrayText).forEach((k) => delete arrayText[k]);
  for (const [k, def] of Object.entries(schemaOutput?.jsonSchema?.properties || {})) {
    if (def.type === 'array') {
      arrayText[k] = (defaults[k] || []).join('\n');
    }
  }
}

function validateForm(schemaOutput, fd) {
  const errors = [];
  const required = schemaOutput?.jsonSchema?.required || [];
  for (const key of required) {
    const v = fd?.[key];
    const def = schemaOutput?.jsonSchema?.properties?.[key];
    if (def?.type === 'number') {
      if (typeof v !== 'number' || Number.isNaN(v)) errors.push(`${key} 必须是数字`);
    } else if (def?.type === 'array') {
      if (!Array.isArray(v)) errors.push(`${key} 必须是数组`);
    } else {
      if (typeof v !== 'string' || v.trim() === '') errors.push(`${key} 不能为空`);
    }
  }

  const rules = schemaOutput?.validationRules || [];
  for (const r of rules) {
    if (!r.rules) continue;
    for (const rule of r.rules) {
      if (rule.kind === 'range') {
        const v = fd?.[rule.field];
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

function buildInitialBusinessState(pipeline) {
  const nodes = orderNodes(pipeline.workflow);
  const statusByNode = {};
  for (const n of nodes) statusByNode[n.id] = 'pending';
  statusByNode[nodes[0]?.id || 'draft'] = 'current';
  return {
    currentNodeId: nodes[0]?.id || 'draft',
    statusByNode,
    history: [],
    updatedAt: Date.now(),
  };
}

function saveBusinessSnapshot(pipeline, state) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      pipeline,
      state,
      formData: JSON.parse(JSON.stringify(formData)),
    }),
  );
}

function loadBusinessSnapshot() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return safeJsonParse(raw);
}

function can(actionType) {
  if (!pipelineOutput.value || !business.value) return false;
  const curId = business.value.currentNodeId;
  const perm = getPermissionForNode(pipelineOutput.value.workflow, curId);
  if (!perm?.rolesAllowed?.includes(role.value)) return false;
  return (perm.actions || []).includes(actionType);
}

function applyApprovalAction(pipeline, state, actionType) {
  const curId = state.currentNodeId;
  const curPerm = getPermissionForNode(pipeline.workflow, curId);
  if (!curPerm?.rolesAllowed?.includes(role.value)) {
    return { ok: false, error: '当前角色无权限操作该节点' };
  }
  if (!(curPerm.actions || []).includes(actionType)) {
    return { ok: false, error: `动作 "${actionType}" 未在当前节点允许列表中` };
  }

  const nodes = orderNodes(pipeline.workflow);
  const curIndex = nodes.findIndex((n) => n.id === curId);
  if (curIndex < 0) return { ok: false, error: '流程状态异常（找不到当前节点）' };

  if (actionType === 'save') {
    const next = {
      ...state,
      history: [...(state.history || [])],
      updatedAt: Date.now(),
    };
    next.history.push({ at: new Date().toISOString(), role: role.value, action: 'save', form: JSON.parse(JSON.stringify(formData)) });
    return { ok: true, nextState: next };
  }

  if (actionType === 'reject') {
    if (curIndex <= 0) return { ok: false, error: '已在最初节点，无法驳回' };
    const next = {
      ...state,
      statusByNode: { ...state.statusByNode },
      history: [...(state.history || [])],
      updatedAt: Date.now(),
    };
    next.statusByNode[curId] = 'rejected';
    const prev = nodes[curIndex - 1];
    next.currentNodeId = prev.id;
    next.statusByNode[prev.id] = 'current';
    for (let i = curIndex + 1; i < nodes.length; i++) next.statusByNode[nodes[i].id] = 'pending';
    next.history.push({ at: new Date().toISOString(), role: role.value, action: 'reject', to: prev.id });
    return { ok: true, nextState: next };
  }

  // submit / approve：线性推进到后继节点
  const needsValidation = actionType === 'submit' || actionType === 'approve';
  if (needsValidation) {
    const { ok, errors } = validateForm(pipeline.schema, formData);
    if (!ok) return { ok: false, error: `校验失败：${errors.join('；')}` };
  }

  const transitions = pipeline.workflow?.bpmnLike?.transitions || [];
  const approveTransition = transitions.find((t) => t.from === curId && t.on === 'approve');
  if (!approveTransition) return { ok: false, error: '未找到可推进的审批转移' };

  const nextId = approveTransition.to;
  const next = {
    ...state,
    statusByNode: { ...state.statusByNode },
    history: [...(state.history || [])],
    updatedAt: Date.now(),
  };
  next.statusByNode[curId] = actionType === 'submit' ? 'approved' : 'approved';
  next.currentNodeId = nextId;
  next.statusByNode[nextId] = 'current';
  next.history.push({ at: new Date().toISOString(), role: role.value, action: actionType, from: curId, to: nextId });
  return { ok: true, nextState: next };
}

function doAction(actionType) {
  if (!pipelineOutput.value || !business.value) return;
  error.value = '';
  const snapshot = loadBusinessSnapshot();
  if (!snapshot?.state) {
    error.value = '业务状态丢失，请重置';
    return;
  }
  const applied = applyApprovalAction(pipelineOutput.value, snapshot.state, actionType);
  if (!applied.ok) {
    error.value = applied.error;
    return;
  }
  saveBusinessSnapshot(pipelineOutput.value, applied.nextState);
  business.value = applied.nextState;
}

const dingTree = computed(() => {
  if (!pipelineOutput.value) return null;
  return generateDingTalkApprovalStructureTree(pipelineOutput.value);
});

const approvalTextChangeWatcher = watch(
  () => approvalText.value,
  () => {
    // 不强制清空业务状态：用户可自己重置
  },
);

function runPipeline() {
  error.value = '';
  pipelineOutput.value = runApprovalPipeline(approvalText.value);
  initFormFromSchema(pipelineOutput.value.schema);

  // 清空业务状态，按新流程初始化
  business.value = buildInitialBusinessState(pipelineOutput.value);
  saveBusinessSnapshot(pipelineOutput.value, business.value);
}

function resetBusiness() {
  error.value = '';
  if (!pipelineOutput.value) return;
  business.value = buildInitialBusinessState(pipelineOutput.value);
  saveBusinessSnapshot(pipelineOutput.value, business.value);
}

function onArrayTextInput(key, text) {
  arrayText[key] = text;
  const lines = (text || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  formData[key] = lines;
}

function runPlayback() {
  error.value = '';
  const raw = playbackEventsText.value.trim();
  try {
    const events = JSON.parse(raw);
    if (!Array.isArray(events)) throw new TypeError('事件必须是 JSON 数组');
    playbackOut.value = runPlaybackPipeline({
      policyGoal: playbackGoal.value,
      events,
    });
  } catch (e) {
    error.value = `JSON 解析失败：${String(e)}`;
  }
}

function runPerformance() {
  error.value = '';
  const raw = performanceJsonText.value.trim();
  try {
    if (!raw) {
      performanceOut.value = runPerformancePipeline();
      return;
    }
    const sample = JSON.parse(raw);
    if (sample == null || typeof sample !== 'object' || Array.isArray(sample)) {
      throw new TypeError('根节点必须是 JSON 对象');
    }
    performanceOut.value = runPerformancePipeline(sample);
  } catch (e) {
    error.value = `JSON 解析/执行失败：${String(e)}`;
  }
}

function resetPerf() {
  performanceJsonText.value = `{
  "userId": "u-1001",
  "displayName": "自定义样本",
  "meta": "可粘贴接口 JSON；清空后点「扫描」将使用内置大 Base64 演示数据"
}`;
}

function clearPerf() {
  performanceJsonText.value = '';
}

onMounted(() => {
  // 如果本地已有快照，恢复 pipeline + business + formData
  const snap = loadBusinessSnapshot();
  if (!snap?.pipeline?.schema?.jsonSchema) return;

  pipelineOutput.value = snap.pipeline;
  business.value = snap.state;

  // 恢复表单数据
  Object.keys(formData).forEach((k) => delete formData[k]);
  Object.assign(formData, snap.formData || {});

  // 恢复 arrayText（仅用于 array 类型输入）
  Object.keys(arrayText).forEach((k) => delete arrayText[k]);
  const props = snap.pipeline?.schema?.jsonSchema?.properties || {};
  for (const [k, def] of Object.entries(props)) {
    if (def.type === 'array') arrayText[k] = (formData[k] || []).join('\n');
  }
});
</script>

