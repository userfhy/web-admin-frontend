import { reactive } from "vue";
import type { FormRules } from "element-plus";

/** 自定义表单规则校验 */
export const formRules = reactive(<FormRules>{
  roleKey: [{ required: true, message: "角色为必选项", trigger: "change" }],
  path: [{ required: true, message: "API路径为必填项", trigger: "blur" }],
  method: [{ required: true, message: "请求方法为必选项", trigger: "change" }]
});
