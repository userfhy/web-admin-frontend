<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { message } from "@/utils/message";
import { handleTree } from "@/utils/tree";
import { getPermissionVisualization } from "@/api/system";
import type {
  PermissionIssue,
  PermissionMenu,
  PermissionRole,
  PermissionVisualizationResult
} from "@/api/system";

defineOptions({
  name: "PermissionVisualization"
});

type DiffRow = {
  type: string;
  label: string;
  value: string;
};

const viewModules = import.meta.glob("/src/views/**/*.{vue,tsx}");
const viewModuleKeys = Object.keys(viewModules);
const viewModuleSet = new Set(viewModuleKeys);

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function emptyVisualizationData(): PermissionVisualizationResult {
  return {
    roles: [],
    menus: [],
    apiRules: [],
    backendRoutes: [],
    scans: {
      menuWithoutRole: [],
      menuMissingPeer: [],
      roleWithoutMenu: [],
      roleWithoutApi: [],
      casbinNoRole: [],
      casbinNoRoute: [],
      roleMenuOrphan: []
    }
  };
}

function normalizeVisualizationData(
  value?: Partial<PermissionVisualizationResult> | null
): PermissionVisualizationResult {
  const fallback = emptyVisualizationData();
  const scans = value?.scans ?? fallback.scans;

  return {
    roles: asArray(value?.roles).map(role => ({
      ...role,
      menuIds: asArray(role.menuIds),
      apiRules: asArray(role.apiRules)
    })),
    menus: asArray(value?.menus).map(menu => ({
      ...menu,
      roleKeys: asArray(menu.roleKeys)
    })),
    apiRules: asArray(value?.apiRules),
    backendRoutes: asArray(value?.backendRoutes),
    scans: {
      menuWithoutRole: asArray(scans.menuWithoutRole),
      menuMissingPeer: asArray(scans.menuMissingPeer),
      roleWithoutMenu: asArray(scans.roleWithoutMenu),
      roleWithoutApi: asArray(scans.roleWithoutApi),
      casbinNoRole: asArray(scans.casbinNoRole),
      casbinNoRoute: asArray(scans.casbinNoRoute),
      roleMenuOrphan: asArray(scans.roleMenuOrphan)
    }
  };
}

const loading = ref(false);
const data = ref<PermissionVisualizationResult>(emptyVisualizationData());
const compareRoleKeys = ref<string[]>([]);
const previewRoleKey = ref("");

const roleOptions = computed(() =>
  data.value.roles.map(item => ({
    label: `${item.name}（${item.key}）`,
    value: item.key
  }))
);

const currentPreviewRole = computed(() =>
  data.value.roles.find(item => item.key === previewRoleKey.value)
);

const roleMap = computed(() => {
  const map = new Map<string, PermissionRole>();
  data.value.roles.forEach(item => map.set(item.key, item));
  return map;
});

const previewMenus = computed(() => {
  const ids = new Set(currentPreviewRole.value?.menuIds ?? []);
  return handleTree(data.value.menus.filter(item => ids.has(item.id)));
});

const previewApis = computed(() => currentPreviewRole.value?.apiRules ?? []);

const compareRows = computed<DiffRow[]>(() => {
  const [leftKey, rightKey] = compareRoleKeys.value;
  const left = roleMap.value.get(leftKey);
  const right = roleMap.value.get(rightKey);
  if (!left || !right || left.key === right.key) {
    return [];
  }

  const rows: DiffRow[] = [];
  const leftMenuIds = new Set(asArray(left.menuIds));
  const rightMenuIds = new Set(asArray(right.menuIds));
  data.value.menus.forEach(menu => {
    const inLeft = leftMenuIds.has(menu.id);
    const inRight = rightMenuIds.has(menu.id);
    if (inLeft !== inRight) {
      rows.push({
        type: inLeft ? "仅左侧菜单" : "仅右侧菜单",
        label: menu.title || menu.name || menu.path,
        value: menu.path || String(menu.id)
      });
    }
  });

  const leftApiRules = asArray(left.apiRules);
  const rightApiRules = asArray(right.apiRules);
  const leftApis = new Set(leftApiRules.map(apiKey));
  const rightApis = new Set(rightApiRules.map(apiKey));
  const allApis = [...leftApiRules, ...rightApiRules];
  const visited = new Set<string>();
  allApis.forEach(api => {
    const key = apiKey(api);
    if (visited.has(key)) return;
    visited.add(key);
    const inLeft = leftApis.has(key);
    const inRight = rightApis.has(key);
    if (inLeft !== inRight) {
      rows.push({
        type: inLeft ? "仅左侧 API" : "仅右侧 API",
        label: `${api.method} ${api.path}`,
        value: api.existsRoute ? "路由存在" : "路由缺失"
      });
    }
  });

  return rows;
});

const frontendMissingIssues = computed<PermissionIssue[]>(() =>
  data.value.menus
    .filter(item => item.menuType < 2 && item.component)
    .filter(item => !componentExists(item))
    .map(item => ({
      code: "menu_missing_frontend_component",
      level: "error",
      message: `菜单配置的前端页面不存在: ${item.title || item.path}（component=${item.component || "-"}，path=${item.path || "-"}）`,
      menuId: item.id,
      path: item.component
    }))
);

const issueGroups = computed(() => [
  { title: "菜单未分配角色", data: data.value.scans.menuWithoutRole },
  { title: "菜单父级异常", data: data.value.scans.menuMissingPeer },
  { title: "菜单前端页面缺失", data: frontendMissingIssues.value },
  { title: "角色未配置菜单", data: data.value.scans.roleWithoutMenu },
  { title: "角色未配置 API", data: data.value.scans.roleWithoutApi },
  { title: "Casbin 角色缺失", data: data.value.scans.casbinNoRole },
  { title: "Casbin 路由残留", data: data.value.scans.casbinNoRoute },
  { title: "角色菜单关联残留", data: data.value.scans.roleMenuOrphan }
]);

const totalIssueCount = computed(() =>
  issueGroups.value.reduce((total, group) => total + group.data.length, 0)
);

function apiKey(api: { method: string; path: string }) {
  return `${api.method.toUpperCase()} ${api.path}`;
}

function normalizeViewPath(value: string) {
  return value
    .trim()
    .replace(/^@\/views\//, "")
    .replace(/^\/src\/views\//, "")
    .replace(/^src\/views\//, "")
    .replace(/^\//, "")
    .replace(/\/:[^/]+/g, "");
}

function viewCandidates(value: string) {
  const normalized = normalizeViewPath(value);
  if (!normalized) return [];
  return [
    `/src/views/${normalized}`,
    `/src/views/${normalized}.vue`,
    `/src/views/${normalized}.tsx`,
    `/src/views/${normalized}/index.vue`,
    `/src/views/${normalized}/index.tsx`
  ];
}

function componentExists(menu: PermissionMenu) {
  const component = normalizeViewPath(menu.component);
  const path = normalizeViewPath(menu.path);

  if (
    menu.name === "PermissionVisualization" ||
    component === "system/permission-visualization/index" ||
    path === "system/permission-visualization/index"
  ) {
    return true;
  }

  const pathSegments = path.split("/").filter(Boolean);
  const shortComponent =
    component && !component.includes("/") && pathSegments.length > 1
      ? pathSegments.slice(0, -1).concat(component).join("/")
      : "";
  const candidates = [
    ...viewCandidates(component),
    ...viewCandidates(path),
    ...viewCandidates(shortComponent)
  ];
  const normalizedCandidates = candidates.map(item => normalizeViewPath(item));
  const normalizedModuleKeys = viewModuleKeys.map(item =>
    normalizeViewPath(item)
  );

  if (
    candidates.some(item => viewModuleSet.has(item)) ||
    normalizedCandidates.some(item => normalizedModuleKeys.includes(item))
  ) {
    return true;
  }

  // Keep this aligned with src/router/utils.ts, which resolves backend routes
  // by checking whether a module key contains the returned component/path.
  return [component, path, shortComponent]
    .filter(Boolean)
    .some(item => normalizedModuleKeys.some(key => key.includes(item)));
}

function issueTagType(level: string) {
  if (level === "error") return "danger";
  if (level === "warning") return "warning";
  return "info";
}

async function loadData() {
  loading.value = true;
  try {
    const res = await getPermissionVisualization();
    if (res?.code !== 200 && res?.code !== 0) {
      message(res?.msg || res?.message || "获取权限可视化数据失败", {
        type: "error"
      });
      return;
    }
    data.value = normalizeVisualizationData(res.data);
    if (!previewRoleKey.value && data.value.roles.length > 0) {
      previewRoleKey.value = data.value.roles[0].key;
    }
    if (compareRoleKeys.value.length === 0 && data.value.roles.length > 1) {
      compareRoleKeys.value = data.value.roles
        .slice(0, 2)
        .map(item => item.key);
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="main permission-visualization">
    <div class="toolbar bg-bg_color">
      <div>
        <div class="title">权限可视化</div>
        <div class="subtitle">
          <span>角色 {{ data.roles.length }} 个</span>
          <span>菜单 {{ data.menus.length }} 个</span>
          <span>API 权限 {{ data.apiRules.length }} 条</span>
          <span>扫描问题 {{ totalIssueCount }} 个</span>
        </div>
      </div>
      <el-button type="primary" :loading="loading" @click="loadData">
        刷新
      </el-button>
    </div>

    <el-tabs v-loading="loading" type="border-card" class="permission-tabs">
      <el-tab-pane label="角色概览">
        <el-table :data="data.roles" border height="calc(100vh - 260px)">
          <el-table-column prop="name" label="角色名称" min-width="140" />
          <el-table-column prop="key" label="角色标识" min-width="140" />
          <el-table-column label="管理员" width="90">
            <template #default="{ row }">
              <el-tag :type="row.isAdmin ? 'success' : 'info'" effect="plain">
                {{ row.isAdmin ? "是" : "否" }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="menuCount" label="菜单数" width="90" />
          <el-table-column prop="apiCount" label="API数" width="90" />
          <el-table-column prop="issueCount" label="相关问题" width="100" />
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="角色差异对比">
        <div class="compare-bar">
          <el-select
            v-model="compareRoleKeys"
            multiple
            :multiple-limit="2"
            placeholder="选择两个角色"
            class="w-[420px]!"
          >
            <el-option
              v-for="item in roleOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>
        <el-table :data="compareRows" border height="calc(100vh - 320px)">
          <el-table-column prop="type" label="差异类型" width="140" />
          <el-table-column prop="label" label="权限项" min-width="260" />
          <el-table-column prop="value" label="说明" min-width="220" />
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="最终权限预览">
        <div class="compare-bar">
          <el-select
            v-model="previewRoleKey"
            placeholder="选择角色"
            class="w-[320px]!"
          >
            <el-option
              v-for="item in roleOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>
        <div class="preview-grid">
          <el-table
            :data="previewMenus"
            row-key="id"
            border
            default-expand-all
            height="calc(100vh - 330px)"
          >
            <el-table-column prop="title" label="菜单" min-width="180" />
            <el-table-column prop="path" label="路径" min-width="220" />
            <el-table-column prop="component" label="组件" min-width="220" />
          </el-table>
          <el-table :data="previewApis" border height="calc(100vh - 330px)">
            <el-table-column prop="method" label="方法" width="90" />
            <el-table-column prop="path" label="API路径" min-width="260" />
            <el-table-column label="后端路由" width="110">
              <template #default="{ row }">
                <el-tag :type="row.existsRoute ? 'success' : 'danger'">
                  {{ row.existsRoute ? "存在" : "缺失" }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <el-tab-pane label="无效权限扫描">
        <div class="issue-grid">
          <section
            v-for="group in issueGroups"
            :key="group.title"
            class="issue-section"
          >
            <div class="issue-title">
              <span>{{ group.title }}</span>
              <el-tag size="small" effect="plain">
                {{ group.data.length }}
              </el-tag>
            </div>
            <el-empty v-if="group.data.length === 0" :image-size="48" />
            <el-scrollbar v-else max-height="220px">
              <div
                v-for="item in group.data"
                :key="`${item.code}-${item.message}`"
                class="issue-row"
              >
                <el-tag size="small" :type="issueTagType(item.level)">
                  {{ item.level }}
                </el-tag>
                <span>{{ item.message }}</span>
              </div>
            </el-scrollbar>
          </section>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style lang="scss" scoped>
.permission-visualization {
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    margin-bottom: 12px;
  }

  .title {
    font-size: 18px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .subtitle {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 14px;
    margin-top: 4px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .permission-tabs {
    min-height: calc(100vh - 180px);
  }

  .compare-bar {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 12px;
  }

  .preview-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 12px;
  }

  .issue-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 12px;
  }

  .issue-section {
    padding: 12px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-light);
    border-radius: 6px;
  }

  .issue-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    font-weight: 600;
  }

  .issue-row {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    padding: 7px 0;
    font-size: 13px;
    line-height: 1.5;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }
}

@media (width <= 900px) {
  .permission-visualization {
    .preview-grid {
      grid-template-columns: 1fr;
    }
  }
}
</style>
