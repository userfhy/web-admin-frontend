<script setup lang="ts">
import { ref } from "vue";
import ReCol from "@/components/ReCol";
import { formRules } from "./utils/rule";
import type { FormProps } from "./utils/types";
import VditorEditor from "@/views/markdown/components/Vditor.vue";

const props = withDefaults(defineProps<FormProps>(), {
  formInline: () => ({
    categoryOptions: [],
    categoryIds: [],
    tagOptions: [],
    tagIds: [],
    title: "",
    slug: "",
    summary: "",
    cover: "",
    content: "",
    seoKeywords: "",
    seoDescription: "",
    status: 1,
    sort: 0
  })
});

const ruleFormRef = ref();
const newFormInline = ref(props.formInline);

function fillSlugByTitle() {
  const title = String(newFormInline.value.title || "")
    .trim()
    .toLowerCase();
  if (!title) return;
  const slug = title
    .replace(/[^\w\u4e00-\u9fa5\s/-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\/+|\/+$/g, "");
  newFormInline.value.slug = slug;
}

function getRef() {
  return ruleFormRef.value;
}

defineExpose({ getRef });
</script>

<template>
  <el-form
    ref="ruleFormRef"
    :model="newFormInline"
    :rules="formRules"
    label-width="100px"
  >
    <el-row :gutter="18">
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item label="标题" prop="title">
          <el-input
            v-model="newFormInline.title"
            clearable
            placeholder="请输入标题"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item label="Slug" prop="slug">
          <el-input
            v-model="newFormInline.slug"
            clearable
            placeholder="例如：about-us/company"
          >
            <template #append>
              <el-button @click="fillSlugByTitle">由标题生成</el-button>
            </template>
          </el-input>
        </el-form-item>
      </re-col>

      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item label="封面图">
          <el-input
            v-model="newFormInline.cover"
            clearable
            placeholder="请输入封面图 URL"
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
      <re-col>
        <el-form-item label="关联类别">
          <el-select
            v-model="newFormInline.categoryIds"
            class="w-full"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="请选择类别"
          >
            <el-option
              v-for="item in newFormInline.categoryOptions"
              :key="item.id"
              :label="item.name"
              :value="item.id"
              :disabled="item.status === 0"
            />
          </el-select>
        </el-form-item>
      </re-col>
      <re-col>
        <el-form-item label="关联标签">
          <el-select
            v-model="newFormInline.tagIds"
            class="w-full"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="请选择标签"
          >
            <el-option
              v-for="item in newFormInline.tagOptions"
              :key="item.id"
              :label="item.name"
              :value="item.id"
              :disabled="item.status === 0"
            />
          </el-select>
        </el-form-item>
      </re-col>

      <re-col>
        <el-form-item label="摘要">
          <el-input
            v-model="newFormInline.summary"
            type="textarea"
            :rows="3"
            placeholder="请输入摘要"
          />
        </el-form-item>
      </re-col>

      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item label="SEO 关键词">
          <el-input
            v-model="newFormInline.seoKeywords"
            clearable
            placeholder="多个关键词可用逗号分隔"
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
            active-text="发布"
            inactive-text="草稿"
          />
        </el-form-item>
      </re-col>

      <re-col>
        <el-form-item label="SEO 描述">
          <el-input
            v-model="newFormInline.seoDescription"
            type="textarea"
            :rows="2"
            placeholder="请输入 SEO 描述"
          />
        </el-form-item>
      </re-col>

      <re-col>
        <el-form-item label="正文内容">
          <VditorEditor
            v-model="newFormInline.content"
            :options="{
              height: 420,
              outline: { enable: false },
              toolbarConfig: { pin: true }
            }"
          />
        </el-form-item>
      </re-col>
    </el-row>
  </el-form>
</template>
