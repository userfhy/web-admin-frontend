<script setup lang="ts">
import { computed, ref } from "vue";
import ReCol from "@/components/ReCol";
import { dictDataFormRules } from "./utils/rule";
import type { DictDataFormProps } from "./utils/types";

const props = withDefaults(defineProps<DictDataFormProps>(), {
  formInline: () => ({
    dictType: "",
    label: "",
    value: "",
    status: 1,
    sort: 0,
    cssClass: "",
    listClass: "default",
    isDefault: 0,
    remark: ""
  }),
  dictTypeOptions: () => []
});

const ruleFormRef = ref();
const newFormInline = ref(props.formInline);

const tagTypeOptions = computed(() => [
  { label: "默认", value: "default" },
  { label: "主要", value: "primary" },
  { label: "成功", value: "success" },
  { label: "信息", value: "info" },
  { label: "警告", value: "warning" },
  { label: "危险", value: "danger" }
]);

function getRef() {
  return ruleFormRef.value;
}

defineExpose({ getRef });
</script>

<template>
  <el-form
    ref="ruleFormRef"
    :model="newFormInline"
    :rules="dictDataFormRules"
    label-width="100px"
  >
    <el-row :gutter="18">
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item label="所属字典" prop="dictType">
          <el-select
            v-model="newFormInline.dictType"
            filterable
            clearable
            placeholder="请选择所属字典"
            class="w-full!"
          >
            <el-option
              v-for="item in dictTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item label="字典标签" prop="label">
          <el-input
            v-model="newFormInline.label"
            clearable
            placeholder="请输入字典标签"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item label="字典键值" prop="value">
          <el-input
            v-model="newFormInline.value"
            clearable
            placeholder="请输入字典键值"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item label="排序">
          <el-input-number
            v-model="newFormInline.sort"
            class="w-full!"
            :min="0"
            :max="9999"
            controls-position="right"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item label="状态">
          <el-switch
            v-model="newFormInline.status"
            inline-prompt
            :active-value="1"
            :inactive-value="0"
            active-text="启用"
            inactive-text="停用"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item label="默认项">
          <el-switch
            v-model="newFormInline.isDefault"
            inline-prompt
            :active-value="1"
            :inactive-value="0"
            active-text="是"
            inactive-text="否"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item label="回显样式">
          <el-select
            v-model="newFormInline.listClass"
            clearable
            placeholder="请选择标签样式"
            class="w-full!"
          >
            <el-option
              v-for="item in tagTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item label="CSS Class">
          <el-input
            v-model="newFormInline.cssClass"
            clearable
            placeholder="可选，自定义类名"
          />
        </el-form-item>
      </re-col>
      <re-col>
        <el-form-item label="备注">
          <el-input
            v-model="newFormInline.remark"
            type="textarea"
            :rows="3"
            placeholder="请输入备注"
          />
        </el-form-item>
      </re-col>
    </el-row>
  </el-form>
</template>
