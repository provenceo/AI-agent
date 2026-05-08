/**
 * 钉钉审批流结构树生成器（纯函数/规则版）。
 * 入参：pipelineOutput（其中 workflow.bpmnLike.nodes / transitions / permissionSketch）。
 *
 * 说明：
 * - 这里不依赖外部 SDK；用于演示“Node 侧生成结构树，再前端渲染”。
 * - 结构树为嵌套形式（root -> children），同时附带节点/边元信息。
 */

function buildEdges(workflow) {
  const nodes = workflow?.bpmnLike?.nodes || [];
  const transitions = workflow?.bpmnLike?.transitions || [];
  const outgoing = new Map();
  const incomingCount = new Map();

  for (const n of nodes) {
    outgoing.set(n.id, []);
    incomingCount.set(n.id, 0);
  }

  for (const t of transitions) {
    if (!outgoing.has(t.from)) outgoing.set(t.from, []);
    if (!incomingCount.has(t.to)) incomingCount.set(t.to, 0);
    outgoing.get(t.from).push(t);
    incomingCount.set(t.to, (incomingCount.get(t.to) || 0) + 1);
  }

  return { nodes, transitions, outgoing, incomingCount };
}

function findRoots(incomingCount) {
  const roots = [];
  for (const [id, cnt] of incomingCount.entries()) {
    if (cnt === 0) roots.push(id);
  }
  return roots;
}

function getPerm(workflow, nodeId) {
  const list = workflow?.permissionSketch || [];
  return list.find((x) => x.node === nodeId) || null;
}

function nodeById(workflow, id) {
  const nodes = workflow?.bpmnLike?.nodes || [];
  return nodes.find((n) => n.id === id) || null;
}

function toActionList(perm) {
  const actions = perm?.actions || [];
  // DingTalk 通常需要“提交/审批/驳回”语义，这里做一个最小映射
  const mapped = new Set();
  for (const a of actions) {
    if (a === 'submit') mapped.add('submit');
    else if (a === 'approve') mapped.add('approve');
    else if (a === 'reject') mapped.add('reject');
    else if (a === 'approve' || a === 'reject') mapped.add(a);
  }
  // 如果没命中映射，退化到原始动作集
  return mapped.size ? Array.from(mapped) : actions;
}

export function generateDingTalkApprovalStructureTree(pipelineOutput, maxDepth = 16) {
  const workflow = pipelineOutput?.workflow;
  if (!workflow) {
    return { processName: 'DingTalk 结构树', error: 'missing workflow' };
  }

  const { nodes, outgoing, incomingCount } = buildEdges(workflow);
  if (!nodes.length) return { processName: 'DingTalk 结构树', error: 'missing nodes' };

  const roots = findRoots(incomingCount);
  const rootId = roots[0] || nodes[0].id;

  const visited = new Set();

  const buildNode = (id, depth) => {
    if (depth > maxDepth) {
      return { id, truncated: true, children: [] };
    }
    if (visited.has(id)) {
      return { id, cycle: true, children: [] };
    }
    visited.add(id);

    const n = nodeById(workflow, id);
    const perm = getPerm(workflow, id);
    const childrenEdges = outgoing.get(id) || [];
    const childIds = childrenEdges.map((e) => e.to);

    const children = [];
    for (const cid of childIds) {
      children.push(buildNode(cid, depth + 1));
    }

    visited.delete(id);

    return {
      id,
      name: n?.name || id,
      role: n?.role || perm?.rolesAllowed?.[0] || null,
      approver: perm?.rolesAllowed || (n ? [n.role] : []),
      actions: toActionList(perm),
      children,
    };
  };

  const rootTree = buildNode(rootId, 0);

  return {
    processName: 'DingTalk 审批流结构树',
    root: rootTree,
    meta: {
      rootId,
      nodeCount: nodes.length,
      nodeIds: nodes.map((n) => n.id),
    },
  };
}

