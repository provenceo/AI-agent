/**
 * 需求解析 Agent：从自然语言中抽取字段与审批意图（规则模拟，可替换为真实 LLM）。
 */
export function runRequirementAgent({ text }) {
  const normalized = String(text || '').trim();
  const fields = [];

  const pushUnique = (name, type, required, hint) => {
    if (!name) return;
    if (fields.some((f) => f.name === name)) return;
    fields.push({ name, type, required, hint });
  };

  if (/请假|休假|年假/.test(normalized)) {
    pushUnique('applicantName', 'string', true, '申请人');
    pushUnique('leaveDays', 'number', true, '请假天数');
    pushUnique('reason', 'string', true, '事由');
    pushUnique('attachments', 'file[]', false, '附件');
  }
  if (/报销/.test(normalized)) {
    pushUnique('amount', 'number', true, '金额');
    pushUnique('invoiceNo', 'string', true, '发票号');
    pushUnique('attachments', 'file[]', true, '票据附件');
  }
  if (/采购/.test(normalized)) {
    pushUnique('itemName', 'string', true, '采购物品');
    pushUnique('quantity', 'number', true, '数量');
    pushUnique('budget', 'number', false, '预算');
  }

  if (fields.length === 0) {
    pushUnique('title', 'string', true, '标题');
    pushUnique('description', 'string', false, '说明');
  }

  const needsManager = /主管|经理|领导/.test(normalized);
  const needsHr = /人事|HR|归档/.test(normalized);
  const needsFinance = /财务|出纳/.test(normalized);

  return {
    stage: 'requirement',
    summary: normalized.slice(0, 120) || '(empty)',
    fields,
    flowHints: { needsManager, needsHr, needsFinance },
  };
}
