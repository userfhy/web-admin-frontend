<script setup lang="ts">
import { computed } from "vue";
import "vue-json-pretty/lib/styles.css";
import VueJsonPretty from "vue-json-pretty";

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  }
});

const detail = computed(() => (props.data[0] as any) || {});

const columns = [
  {
    label: "日志分类",
    prop: "category"
  },
  {
    label: "操作用户",
    prop: "username"
  },
  {
    label: "IP 地址",
    prop: "ip"
  },
  {
    label: "所属模块",
    prop: "module"
  },
  {
    label: "请求时间",
    prop: "requestTime"
  },
  {
    label: "请求方法",
    prop: "method"
  },
  {
    label: "请求耗时(ms)",
    prop: "takesTime"
  },
  {
    label: "请求接口",
    prop: "url",
    copy: true
  },
  {
    label: "动作",
    prop: "action"
  },
  {
    label: "状态码",
    prop: "status"
  }
];

const dataList = computed(() => [
  {
    title: "日志消息",
    name: "message",
    data: detail.value.message || ""
  },
  {
    title: "请求头",
    name: "requestHeaders",
    data: detail.value.requestHeaders || {}
  },
  {
    title: "请求体",
    name: "requestBody",
    data: detail.value.requestBody || {}
  },
  {
    title: "响应头",
    name: "responseHeaders",
    data: detail.value.responseHeaders || {}
  },
  {
    title: "响应体",
    name: "responseBody",
    data: detail.value.responseBody || {}
  }
]);
</script>

<template>
  <div>
    <el-scrollbar>
      <PureDescriptions border :data="detail" :columns="columns" :column="5" />
    </el-scrollbar>
    <el-tabs :modelValue="'message'" type="border-card" class="mt-4">
      <el-tab-pane
        v-for="(item, index) in dataList"
        :key="index"
        :name="item.name"
        :label="item.title"
      >
        <el-scrollbar max-height="calc(100vh - 240px)">
          <div
            v-if="typeof item.data === 'string'"
            class="whitespace-pre-wrap break-all p-4"
          >
            {{ item.data || "-" }}
          </div>
          <vue-json-pretty v-else v-model:data="item.data" />
        </el-scrollbar>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>
