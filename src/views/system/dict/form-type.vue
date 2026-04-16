<script setup lang="ts">
import { ref } from "vue";
import ReCol from "@/components/ReCol";
import { dictTypeFormRules } from "./utils/rule";
import type { DictTypeFormProps } from "./utils/types";

const props = withDefaults(defineProps<DictTypeFormProps>(), {
  formInline: () => ({
    name: "",
    type: "",
    status: 1,
    sort: 0,
    remark: ""
  })
});

const ruleFormRef = ref();
const newFormInline = ref(props.formInline);

function getRef() {
  return ruleFormRef.value;
}

defineExpose({ getRef });
</script>

<template>
  <el-form
    ref="ruleFormRef"
    :model="newFormInline"
    :rules="dictTypeFormRules"
    label-width="100px"
  >
    <el-row :gutter="18">
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item label="字典名称" prop="name">
          <el-input
            v-model="newFormInline.name"
            clearable
            placeholder="请输入字典名称"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item label="字典类型" prop="type">
          <el-input
            v-model="newFormInline.type"
            clearable
            placeholder="例如：sys_user_status"
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
