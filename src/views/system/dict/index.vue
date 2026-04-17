<script setup lang="ts">
import { computed, ref } from "vue";
import { useDict } from "./utils/hook";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

import Delete from "~icons/ep/delete";
import EditPen from "~icons/ep/edit-pen";
import Refresh from "~icons/ep/refresh";
import AddFill from "~icons/ri/add-circle-line";

defineOptions({
  name: "SystemDict"
});

const typeFormRef = ref();
const dataFormRef = ref();
const typeTableRef = ref();
const dataTableRef = ref();

const {
  typeSearchForm,
  dataSearchForm,
  typeLoading,
  dataLoading,
  refreshCacheLoading,
  typeList,
  dataList,
  currentDictType,
  typePagination,
  dataPagination,
  typeColumns,
  dataColumns,
  onTypeSearch,
  onDataSearch,
  resetTypeSearch,
  resetDataSearch,
  handleTypeSizeChange,
  handleTypeCurrentChange,
  handleDataSizeChange,
  handleDataCurrentChange,
  handleTypeRowClick,
  openTypeDialog,
  openDataDialog,
  handleTypeDelete,
  handleDataDelete,
  handleRefreshCache
} = useDict();

const currentDictSummary = computed(() => {
  if (!currentDictType.value) return "请先在左侧选择字典类型";
  return currentDictType.value.remark || "可直接在右侧维护该字典类型下的数据项";
});

function onTypeFullscreen() {
  typeTableRef.value.setAdaptive();
}

function onDataFullscreen() {
  dataTableRef.value.setAdaptive();
}
</script>

<template>
  <div class="dict-page flex flex-wrap xl:flex-nowrap gap-4 items-start">
    <section class="dict-panel dict-panel-left w-full xl:w-[38%] min-w-0">
      <el-form
        ref="typeFormRef"
        :inline="true"
        :model="typeSearchForm"
        class="search-form bg-bg_color w-full pl-5 pr-4 pt-[12px] overflow-auto"
      >
        <el-form-item label="名称" prop="name">
          <el-input
            v-model="typeSearchForm.name"
            placeholder="字典名称"
            clearable
            class="w-[160px]!"
          />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-input
            v-model="typeSearchForm.type"
            placeholder="字典类型"
            clearable
            class="w-[180px]!"
          />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select
            v-model="typeSearchForm.status"
            placeholder="状态"
            clearable
            class="w-[120px]!"
          >
            <el-option label="启用" :value="1" />
            <el-option label="停用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            :icon="useRenderIcon('ri/search-line')"
            :loading="typeLoading"
            @click="onTypeSearch(false)"
          >
            搜索
          </el-button>
          <el-button
            :icon="useRenderIcon(Refresh)"
            @click="resetTypeSearch(typeFormRef)"
          >
            重置
          </el-button>
        </el-form-item>
      </el-form>

      <PureTableBar
        title="字典类型"
        :columns="typeColumns"
        :tableRef="typeTableRef?.getTableRef()"
        @refresh="onTypeSearch()"
        @fullscreen="onTypeFullscreen"
      >
        <template #buttons>
          <el-button
            type="primary"
            plain
            :icon="useRenderIcon(Refresh)"
            :loading="refreshCacheLoading"
            @click="handleRefreshCache"
          >
            刷新缓存
          </el-button>
          <el-button
            type="primary"
            :icon="useRenderIcon(AddFill)"
            @click="openTypeDialog()"
          >
            新增类型
          </el-button>
        </template>

        <template v-slot="{ size, dynamicColumns }">
          <pure-table
            ref="typeTableRef"
            adaptive
            :adaptiveConfig="{ offsetBottom: 108 }"
            align-whole="center"
            row-key="id"
            highlight-current-row
            showOverflowTooltip
            table-layout="auto"
            :loading="typeLoading"
            :size="size"
            :data="typeList"
            :columns="dynamicColumns"
            :pagination="{ ...typePagination, size }"
            :header-cell-style="{
              background: 'var(--el-fill-color-light)',
              color: 'var(--el-text-color-primary)'
            }"
            @row-click="handleTypeRowClick"
            @page-size-change="handleTypeSizeChange"
            @page-current-change="handleTypeCurrentChange"
          >
            <template #typeOperation="{ row }">
              <el-button
                class="reset-margin"
                link
                type="primary"
                :size="size"
                :icon="useRenderIcon(EditPen)"
                @click="openTypeDialog('修改', row)"
              >
                修改
              </el-button>
              <el-popconfirm
                :title="`是否确认删除字典类型 ${row.name}`"
                @confirm="handleTypeDelete(row)"
              >
                <template #reference>
                  <el-button
                    class="reset-margin"
                    link
                    type="primary"
                    :size="size"
                    :icon="useRenderIcon(Delete)"
                  >
                    删除
                  </el-button>
                </template>
              </el-popconfirm>
            </template>
          </pure-table>
        </template>
      </PureTableBar>
    </section>

    <section class="dict-panel dict-panel-right w-full xl:flex-1 min-w-0">
      <div class="dict-summary bg-bg_color mb-3 px-5 py-4 rounded-[12px]">
        <div class="flex flex-wrap items-center gap-3 mb-2">
          <span class="dict-summary__label">当前字典</span>
          <el-tag v-if="currentDictType" type="primary" effect="dark">
            {{ currentDictType.name }} / {{ currentDictType.type }}
          </el-tag>
          <el-tag v-else type="info">未选择</el-tag>
          <el-tag v-if="currentDictType" effect="plain">
            数据 {{ dataPagination.total }} 条
          </el-tag>
        </div>
        <div class="dict-summary__desc">{{ currentDictSummary }}</div>
        <div class="dict-summary__tips">
          <span>操作建议：先选左侧字典类型，再在右侧新增或筛选字典数据。</span>
          <el-button
            type="primary"
            link
            :disabled="!currentDictType"
            @click="openDataDialog()"
          >
            直接新增数据
          </el-button>
        </div>
      </div>

      <el-form
        ref="dataFormRef"
        :inline="true"
        :model="dataSearchForm"
        class="search-form bg-bg_color w-full pl-5 pr-4 pt-[12px] overflow-auto"
      >
        <el-form-item label="标签" prop="label">
          <el-input
            v-model="dataSearchForm.label"
            placeholder="字典标签"
            clearable
            class="w-[160px]!"
            :disabled="!currentDictType"
          />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select
            v-model="dataSearchForm.status"
            placeholder="状态"
            clearable
            class="w-[120px]!"
            :disabled="!currentDictType"
          >
            <el-option label="启用" :value="1" />
            <el-option label="停用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            :icon="useRenderIcon('ri/search-line')"
            :loading="dataLoading"
            :disabled="!currentDictType"
            @click="onDataSearch"
          >
            搜索
          </el-button>
          <el-button
            :icon="useRenderIcon(Refresh)"
            :disabled="!currentDictType"
            @click="resetDataSearch(dataFormRef)"
          >
            重置
          </el-button>
        </el-form-item>
      </el-form>

      <PureTableBar
        :title="
          currentDictType ? `字典数据 - ${currentDictType.name}` : '字典数据'
        "
        :columns="dataColumns"
        :tableRef="dataTableRef?.getTableRef()"
        @refresh="onDataSearch"
        @fullscreen="onDataFullscreen"
      >
        <template #buttons>
          <el-button
            type="primary"
            :icon="useRenderIcon(AddFill)"
            :disabled="!currentDictType"
            @click="openDataDialog()"
          >
            新增数据
          </el-button>
        </template>

        <template v-slot="{ size, dynamicColumns }">
          <pure-table
            ref="dataTableRef"
            adaptive
            :adaptiveConfig="{ offsetBottom: 108 }"
            align-whole="center"
            row-key="id"
            showOverflowTooltip
            table-layout="auto"
            :loading="dataLoading"
            :size="size"
            :data="dataList"
            :columns="dynamicColumns"
            :pagination="{ ...dataPagination, size }"
            :header-cell-style="{
              background: 'var(--el-fill-color-light)',
              color: 'var(--el-text-color-primary)'
            }"
            @page-size-change="handleDataSizeChange"
            @page-current-change="handleDataCurrentChange"
          >
            <template #dataOperation="{ row }">
              <el-button
                class="reset-margin"
                link
                type="primary"
                :size="size"
                :icon="useRenderIcon(EditPen)"
                @click="openDataDialog('修改', row)"
              >
                修改
              </el-button>
              <el-popconfirm
                :title="`是否确认删除字典数据 ${row.label}`"
                @confirm="handleDataDelete(row)"
              >
                <template #reference>
                  <el-button
                    class="reset-margin"
                    link
                    type="primary"
                    :size="size"
                    :icon="useRenderIcon(Delete)"
                  >
                    删除
                  </el-button>
                </template>
              </el-popconfirm>
            </template>
          </pure-table>
        </template>
      </PureTableBar>
    </section>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-table__inner-wrapper::before) {
  height: 0;
}

.dict-panel {
  border-radius: 12px;
}

.dict-summary {
  border: 1px solid var(--el-border-color-light);
}

.dict-summary__label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.dict-summary__desc {
  font-size: 13px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

.dict-summary__tips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.search-form {
  :deep(.el-form-item) {
    margin-right: 12px;
    margin-bottom: 12px;
  }
}

@media (width >= 1280px) {
  .dict-panel-left {
    max-width: 560px;
  }
}
</style>
