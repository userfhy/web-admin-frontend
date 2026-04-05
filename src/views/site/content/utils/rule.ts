import { reactive } from "vue";
import type { FormRules } from "element-plus";

const slugRegex = /^[a-z0-9][a-z0-9\-_/]*$/;

export const formRules = reactive<FormRules>({
  title: [{ required: true, message: "标题为必填项", trigger: "blur" }],
  slug: [
    { required: true, message: "Slug 为必填项", trigger: "blur" },
    {
      validator: (_rule, value, callback) => {
        if (!value) {
          callback(new Error("Slug 为必填项"));
          return;
        }
        if (!slugRegex.test(value)) {
          callback(new Error("Slug 仅支持小写字母、数字、-、_、/"));
          return;
        }
        callback();
      },
      trigger: "blur"
    }
  ]
});
