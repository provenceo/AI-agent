import { runRequirementAgent } from './agents/requirementAgent.mjs';
import { runSchemaAgent } from './agents/schemaAgent.mjs';
import { runCodegenAgent } from './agents/codegenAgent.mjs';
import { runWorkflowAgent } from './agents/workflowAgent.mjs';
import { runPlaybackAgent } from './agents/playbackAgent.mjs';
import { runPerformanceAgent } from './agents/performanceAgent.mjs';

/**
 * 长链流水线：需求 → Schema → 代码草稿 + 流程（与描述中的阶段对齐）。
 */
export function runApprovalPipeline(userText) {
  const requirement = runRequirementAgent({ text: userText });
  const schema = runSchemaAgent(requirement);
  const codegen = runCodegenAgent(schema);
  const workflow = runWorkflowAgent(requirement);
  return { requirement, schema, codegen, workflow };
}

export function runPlaybackPipeline(input) {
  return { playback: runPlaybackAgent(input) };
}

export function runPerformancePipeline() {
  const tinyPngBase64 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const huge = tinyPngBase64 + 'A'.repeat(120_000);
  const apiSample = {
    userId: 'u-1001',
    displayName: '演示用户',
    avatarBase64: huge,
    training: { coverBase64: huge },
  };
  return { performance: runPerformanceAgent(apiSample) };
}
