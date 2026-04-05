<script setup lang="ts">
import { useDark } from "@pureadmin/utils";
import { javascript } from "@codemirror/lang-javascript";
import CodeMirror from "vue-codemirror6";
import { ref } from "vue";

const { isDark } = useDark();
const lang = javascript();

const code = ref(`function sayHello() {
    console.log("Hello, World!");
}

sayHello();`);
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <span class="font-medium">
          代码编辑器组件，采用开源的
          <el-link
            href="https://github.com/logue/vue-codemirror6"
            target="_blank"
            style="margin: 0 4px 5px; font-size: 16px"
          >
            vue-codemirror6
          </el-link>
        </span>
      </div>
      <el-link
        class="mt-2"
        href="https://github.com/pure-admin/vue-pure-admin/blob/main/src/views/codemirror/index.vue"
        target="_blank"
      >
        代码位置 src/views/codemirror/index.vue
      </el-link>
    </template>
    <CodeMirror
      v-model="code"
      basic
      :lang="lang"
      :dark="isDark"
      :tab-size="4"
      style="height: 400px"
    />
  </el-card>
</template>

<style lang="scss" scoped>
:deep(.cm-editor) {
  border: 1px solid var(--pure-border-color);
}

:deep(.cm-scroller) {
  min-height: 400px;
}
</style>
