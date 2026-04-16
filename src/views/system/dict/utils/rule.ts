import { reactive } from "vue";
import type { FormRules } from "element-plus";

const dictTypeRegex = /^[a-z][a-z0-9_:-]*$/;

export const dictTypeFormRules = reactive<FormRules>({
  name: [{ required: true, message: "字典名称为必填项", trigger: "blur" }],
  type: [
    { required: true, message: "字典类型为必填项", trigger: "blur" },
    {
      validator: (_rule, value, callback) => {
        if (!value) {
          callback(new Error("字典类型为必填项"));
          return;
        }
        if (!dictTypeRegex.test(value)) {
          callback(new Error("字典类型仅支持小写字母开头，以及数字、_、:、-"));
          return;
        }
        callback();
      },
      trigger: "blur"
    }
  ]
});

export const dictDataFormRules = reactive<FormRules>({
  dictType: [
    { required: true, message: "所属字典为必填项", trigger: "change" }
  ],
  label: [{ required: true, message: "字典标签为必填项", trigger: "blur" }],
  value: [{ required: true, message: "字典键值为必填项", trigger: "blur" }]
});
