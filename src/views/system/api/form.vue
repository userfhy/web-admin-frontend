<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { formRules } from "./utils/rule";
import { FormProps } from "./utils/types";
import { getBackendRouterList } from "@/api/sys";
import { getRoleListForCasbin } from "@/api/role";

const props = withDefaults(defineProps<FormProps>(), {
  formInline: () => ({
    roleKey: "",
    path: "",
    method: "",
    apiGroup: "",
    description: "",
    id: undefined
  })
});

const ruleFormRef = ref();
const newFormInline = ref(props.formInline);

const backendRoutes = ref<Array<{ path: string; method: string }>>([]);
const roles = ref<
  Array<{ role_id: number; role_name: string; role_key: string }>
>([]);

const routeOptions = computed(() => {
  const map = new Map<string, { path: string; method: string }>();
  for (const r of backendRoutes.value) {
    const key = `${r.method} ${r.path}`;
    if (!map.has(key)) map.set(key, r);
  }
  return Array.from(map.values());
});

async function loadBackendRoutes() {
  const res = await getBackendRouterList();
  backendRoutes.value = res?.data ?? [];
}

async function loadRoles() {
  const res = await getRoleListForCasbin({ p: 1, n: 999 });
  roles.value = res?.data?.list ?? [];
}

function onPathPicked(val: string) {
  const matched = routeOptions.value.find(r => r.path === val);
  if (matched) {
    newFormInline.value.path = matched.path;
    newFormInline.value.method = matched.method;
  } else {
    newFormInline.value.path = val;
  }
}

watch(
  () => props.formInline,
  v => {
    newFormInline.value = v;
  }
);

function getRef() {
  return ruleFormRef.value;
}

defineExpose({ getRef, loadBackendRoutes, loadRoles });
</script>

<template>
  <el-form
    ref="ruleFormRef"
    :model="newFormInline"
    :rules="formRules"
    label-width="82px"
  >
    <el-form-item label="角色" prop="roleKey">
      <el-select
        v-model="newFormInline.roleKey"
        filterable
        clearable
        placeholder="请选择角色"
        class="w-full"
      >
        <el-option
          v-for="r in roles"
          :key="r.role_key"
          :label="`${r.role_name}（${r.role_key}）`"
          :value="r.role_key"
        />
      </el-select>
    </el-form-item>

    <el-form-item label="API路径" prop="path">
      <el-select
        v-model="newFormInline.path"
        filterable
        allow-create
        default-first-option
        clearable
        placeholder="可输入或选择后端路由"
        class="w-full"
        @change="onPathPicked"
      >
        <el-option
          v-for="item in routeOptions"
          :key="`${item.method}-${item.path}`"
          :label="`${item.method} ${item.path}`"
          :value="item.path"
        />
      </el-select>
    </el-form-item>

    <el-form-item label="请求方法" prop="method">
      <el-select
        v-model="newFormInline.method"
        placeholder="请选择请求方法"
        clearable
      >
        <el-option label="GET" value="GET" />
        <el-option label="POST" value="POST" />
        <el-option label="PUT" value="PUT" />
        <el-option label="DELETE" value="DELETE" />
      </el-select>
    </el-form-item>

    <el-form-item label="API分组" prop="apiGroup">
      <el-input
        v-model="newFormInline.apiGroup"
        clearable
        placeholder="（可选）"
      />
    </el-form-item>

    <el-form-item label="API描述" prop="description">
      <el-input
        v-model="newFormInline.description"
        placeholder="（可选）"
        type="textarea"
      />
    </el-form-item>
  </el-form>
</template>
