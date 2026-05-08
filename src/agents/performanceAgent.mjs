/**
 * 性能优化 Agent：扫描模拟接口负载，识别 Base64 与大字段并给出改造建议。
 */
export function runPerformanceAgent(apiSample) {
  const issues = [];
  const recommendations = [];

  const walk = (obj, path = '$') => {
    if (obj == null) return;
    if (typeof obj === 'string') {
      if (/^data:image\/[a-zA-Z+]+;base64,/.test(obj) && obj.length > 50_000) {
        issues.push({
          kind: 'large_base64',
          path,
          approxBytes: Math.floor((obj.length * 3) / 4),
        });
        recommendations.push({
          action: 'migrate_to_object_storage',
          path,
          detail: '将 Base64 改为上传后返回 URL；列表接口只返回缩略图 URL 与 metadata',
        });
      }
      return;
    }
    if (Array.isArray(obj)) {
      obj.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    if (typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) walk(v, `${path}.${k}`);
    }
  };

  walk(apiSample);

  const keys = apiSample && typeof apiSample === 'object' ? Object.keys(apiSample) : [];
  if (keys.length > 80) {
    issues.push({ kind: 'wide_payload', path: '$', fieldCount: keys.length });
    recommendations.push({
      action: 'split_read_models',
      detail: '拆分为「列表轻量 DTO」与「详情完整 DTO」两个接口',
    });
  }

  if (!issues.length) {
    issues.push({ kind: 'none', path: '$', detail: '未发现明显大字段模式' });
    recommendations.push({ action: 'keep_monitoring', detail: '持续对慢 SQL 与热点 key 做采样' });
  }

  return { stage: 'performance', issues, recommendations };
}
