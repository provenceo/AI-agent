/**
 * 代码生成 Agent：由 Schema 产出简化版前端结构 + Java DTO 草稿。
 */
export function runCodegenAgent(schemaOutput) {
  const props = schemaOutput.jsonSchema?.properties || {};
  const vueFields = Object.entries(props).map(([key, def]) => {
    const label = def.description || key;
    if (def.type === 'array') {
      return `  <nut-form-item label="${label}"><nut-uploader v-model="form.${key}" /></nut-form-item>`;
    }
    if (def.type === 'number') {
      return `  <nut-form-item label="${label}"><nut-input-number v-model="form.${key}" /></nut-form-item>`;
    }
    return `  <nut-form-item label="${label}"><nut-input v-model="form.${key}" /></nut-form-item>`;
  });

  const javaFields = Object.entries(props).map(([key, def]) => {
    let jtype = 'String';
    if (def.type === 'number') jtype = 'BigDecimal';
    if (def.type === 'array') jtype = 'List<String>';
    const cap = key.charAt(0).toUpperCase() + key.slice(1);
    return `    private ${jtype} ${key}; // ${def.description || key}`;
  });

  const tsInterface = Object.entries(props)
    .map(([key, def]) => {
      let t = 'string';
      if (def.type === 'number') t = 'number';
      if (def.type === 'array') t = 'string[]';
      return `  ${key}: ${t};`;
    })
    .join('\n');

  return {
    stage: 'codegen',
    vueSnippet: `<template>\n<nut-form :model-value="form">\n${vueFields.join('\n')}\n</nut-form>\n</template>`,
    javaDtoSnippet: `public class ApprovalFormDTO {\n${javaFields.join('\n')}\n}`,
    typescriptTypes: `export interface ApprovalForm {\n${tsInterface}\n}`,
  };
}
