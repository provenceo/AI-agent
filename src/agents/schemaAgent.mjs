/**
 * Schema / 校验 Agent：由字段列表推断 JSON Schema 与校验规则。
 */
export function runSchemaAgent(requirementOutput) {
  const properties = {};
  const required = [];

  for (const f of requirementOutput.fields || []) {
    let schemaType = 'string';
    if (f.type === 'number') schemaType = 'number';
    if (f.type === 'file[]') {
      properties[f.name] = {
        type: 'array',
        items: { type: 'string', format: 'uri' },
        description: f.hint || f.name,
      };
    } else {
      properties[f.name] = { type: schemaType, description: f.hint || f.name };
    }
    if (f.required) required.push(f.name);
  }

  const validationRules = (requirementOutput.fields || []).map((f) => {
    const rules = [];
    if (f.required) rules.push({ kind: 'required', field: f.name });
    if (f.name === 'leaveDays') {
      rules.push({ kind: 'range', field: f.name, min: 0.5, max: 365 });
    }
    if (f.name === 'amount') {
      rules.push({ kind: 'range', field: f.name, min: 0.01, max: 1_000_000 });
    }
    return { field: f.name, rules };
  });

  return {
    stage: 'schema',
    jsonSchema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      additionalProperties: false,
      properties,
      required,
    },
    validationRules,
  };
}
