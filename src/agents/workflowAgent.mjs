/**
 * 流程推理 Agent：根据需求 hints 生成审批节点与权限占位。
 */
export function runWorkflowAgent(requirementOutput) {
  const nodes = [];
  let order = 0;
  const add = (id, name, role) => {
    nodes.push({ id, name, role, order: order++ });
  };

  add('draft', '填写', 'applicant');
  add('submit', '提交', 'applicant');

  const hints = requirementOutput.flowHints || {};
  if (hints.needsManager) add('manager', '主管审批', 'manager');
  if (hints.needsFinance) add('finance', '财务审核', 'finance');
  if (hints.needsHr) add('hr', '人事归档', 'hr');

  if (nodes.length <= 2) {
    add('manager', '主管审批', 'manager');
    add('hr', '人事归档', 'hr');
  }

  const transitions = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    transitions.push({ from: nodes[i].id, to: nodes[i + 1].id, on: 'approve' });
  }

  return {
    stage: 'workflow',
    bpmnLike: { nodes, transitions },
    permissionSketch: nodes.map((n) => ({
      node: n.id,
      rolesAllowed: [n.role],
      actions: n.id === 'draft' ? ['edit', 'save'] : ['view', 'approve', 'reject'],
    })),
  };
}
