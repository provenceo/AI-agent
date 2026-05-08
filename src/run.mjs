import {
  runApprovalPipeline,
  runPlaybackPipeline,
  runPerformancePipeline,
} from './pipeline.mjs';

function printTitle(title) {
  console.log('\n' + '='.repeat(64));
  console.log(title);
  console.log('='.repeat(64));
}

function parseArgs(argv) {
  const out = { scenario: 'approval' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--scenario' && argv[i + 1]) {
      out.scenario = argv[++i];
    }
  }
  return out;
}

const { scenario } = parseArgs(process.argv);

if (scenario === 'approval' || scenario === 'all') {
  printTitle('场景一：审批 / 动态表单 — 多 Agent 长链推理（规则模拟）');
  const userText =
    '做一个请假审批：需要申请人、请假天数、事由和附件；先主管审批，再人事归档。';
  const result = runApprovalPipeline(userText);
  console.log(JSON.stringify(result, null, 2));
}

if (scenario === 'playback' || scenario === 'all') {
  printTitle('场景二：智能播放 — 根据行为事件推断控制策略');
  const playback = runPlaybackPipeline({
    policyGoal: 'effective_learning',
    events: [
      { type: 'seek', from: 10, to: 400, deltaMs: 80 },
      { type: 'seek', from: 400, to: 900, deltaMs: 90 },
      { type: 'ratechange', rate: 2.5 },
    ],
  });
  console.log(JSON.stringify(playback, null, 2));
}

if (scenario === 'performance' || scenario === 'all') {
  printTitle('场景三：性能治理 — 识别大 Base64 并给出 URL 化建议');
  const perf = runPerformancePipeline();
  console.log(JSON.stringify(perf, null, 2));
}

if (!['approval', 'playback', 'performance', 'all'].includes(scenario)) {
  console.error(`Unknown --scenario ${scenario}. Use: approval | playback | performance | all`);
  process.exitCode = 1;
}
