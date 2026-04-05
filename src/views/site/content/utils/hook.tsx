import editForm from "../form.vue";
import { message } from "@/utils/message";
import { addDialog } from "@/components/ReDialog";
import type { PaginationProps } from "@pureadmin/table";
import { reactive, ref, onMounted, h, toRaw } from "vue";
import { deviceDetection, isAllEmpty } from "@pureadmin/utils";
import { ElMessageBox } from "element-plus";
import type { FormItemProps } from "./types";
import { getSiteCategoryList } from "@/api/siteCategory";
import { getSiteTagList } from "@/api/siteTag";
import {
  getSiteContentList,
  createSiteContent,
  updateSiteContent,
  deleteSiteContent,
  updateSiteContentStatus
} from "@/api/siteContent";

export function useSiteContent() {
  const form = reactive({
    keyword: "",
    status: "" as number | "",
    categoryId: "" as number | "",
    tagId: "" as number | ""
  });
  const formRef = ref();
  const dataList = ref([]);
  const categoryOptions = ref<any[]>([]);
  const tagOptions = ref<any[]>([]);
  const loading = ref(true);
  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 10,
    currentPage: 1,
    background: true
  });

  const columns: TableColumnList = [
    {
      label: "标题",
      prop: "title",
      minWidth: 180
    },
    {
      label: "Slug",
      prop: "slug",
      minWidth: 180
    },
    {
      label: "类别",
      prop: "categoryNames",
      minWidth: 180,
      formatter: ({ categoryNames }) => (categoryNames ?? []).join(", ")
    },
    {
      label: "标签",
      prop: "tagNames",
      minWidth: 180,
      formatter: ({ tagNames }) => (tagNames ?? []).join(", ")
    },
    {
      label: "状态",
      prop: "status",
      minWidth: 130,
      cellRenderer: ({ row, props }) => (
        <el-switch
          size={props.size === "small" ? "small" : "default"}
          modelValue={row.status}
          active-value={1}
          inactive-value={0}
          active-text="发布"
          inactive-text="草稿"
          inline-prompt
          onChange={val => handleStatusChange(row, Number(val))}
        />
      )
    },
    {
      label: "发布时间",
      prop: "publishedAt",
      minWidth: 170,
      formatter: ({ publishedAt }) => publishedAt || "-"
    },
    {
      label: "排序",
      prop: "sort",
      width: 80
    },
    {
      label: "更新时间",
      prop: "updatedAt",
      minWidth: 170
    },
    {
      label: "操作",
      fixed: "right",
      width: 160,
      slot: "operation"
    }
  ];

  async function onSearch() {
    loading.value = true;
    try {
      const params: any = {
        pageNum: pagination.currentPage,
        pageSize: pagination.pageSize
      };
      if (!isAllEmpty(form.keyword)) {
        params.keyword = form.keyword;
      }
      if (form.status !== "") {
        params.status = form.status;
      }
      if (form.categoryId !== "") {
        params.categoryId = form.categoryId;
      }
      if (form.tagId !== "") {
        params.tagId = form.tagId;
      }
      const res: any = await getSiteContentList(params);
      const data = res?.data ?? {};
      dataList.value = data.list ?? [];
      pagination.total = data.total ?? 0;
      pagination.currentPage = data.currentPage ?? pagination.currentPage;
      pagination.pageSize = data.pageSize ?? pagination.pageSize;
    } catch {
      dataList.value = [];
      pagination.total = 0;
      message("获取官网内容失败", { type: "error" });
    } finally {
      loading.value = false;
    }
  }

  async function loadCategoryOptions() {
    try {
      const res: any = await getSiteCategoryList({
        pageNum: 1,
        pageSize: 999,
        status: 1
      });
      categoryOptions.value = res?.data?.list ?? [];
    } catch {
      categoryOptions.value = [];
    }
  }

  async function loadTagOptions() {
    try {
      const res: any = await getSiteTagList({
        pageNum: 1,
        pageSize: 999,
        status: 1
      });
      tagOptions.value = res?.data?.list ?? [];
    } catch {
      tagOptions.value = [];
    }
  }

  function resetForm(formEl) {
    if (!formEl) return;
    formEl.resetFields();
    pagination.currentPage = 1;
    onSearch();
  }

  function handleSizeChange(val: number) {
    pagination.pageSize = val;
    pagination.currentPage = 1;
    onSearch();
  }

  function handleCurrentChange(val: number) {
    pagination.currentPage = val;
    onSearch();
  }

  function openDialog(title = "新增", row?: any) {
    addDialog({
      title: `${title}官网内容`,
      props: {
        formInline: {
          id: row?.id,
          categoryOptions: categoryOptions.value,
          categoryIds: row?.categoryIds ?? [],
          tagOptions: tagOptions.value,
          tagIds: row?.tagIds ?? [],
          title: row?.title ?? "",
          slug: row?.slug ?? "",
          summary: row?.summary ?? "",
          cover: row?.cover ?? "",
          content: row?.content ?? "",
          seoKeywords: row?.seoKeywords ?? "",
          seoDescription: row?.seoDescription ?? "",
          status: row?.status ?? 1,
          sort: row?.sort ?? 0
        }
      },
      width: "62%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(editForm, { ref: formRef, formInline: null }),
      beforeSure: (done, { options }) => {
        const FormRef = formRef.value.getRef();
        const curData = toRaw(options.props.formInline) as FormItemProps;

        FormRef.validate(async valid => {
          if (!valid) return;
          const payload = {
            title: curData.title,
            categoryIds: curData.categoryIds ?? [],
            tagIds: curData.tagIds ?? [],
            slug: curData.slug,
            summary: curData.summary,
            cover: curData.cover,
            content: curData.content,
            seoKeywords: curData.seoKeywords,
            seoDescription: curData.seoDescription,
            status: curData.status,
            sort: curData.sort
          };

          try {
            if (title === "新增") {
              await createSiteContent(payload);
              message("新增成功", { type: "success" });
            } else {
              await updateSiteContent(curData.id as number, payload);
              message("修改成功", { type: "success" });
            }
            done();
            onSearch();
          } catch {
            message(`${title}失败`, { type: "error" });
          }
        });
      }
    });
  }

  function handleDelete(row: any) {
    deleteSiteContent(row.id)
      .then(res => {
        if (res?.code !== 200) {
          message(res?.msg || "删除失败", { type: "error" });
          return;
        }
        message("删除成功", { type: "success" });
        onSearch();
      })
      .catch(() => message("删除失败", { type: "error" }));
  }

  function handleStatusChange(row: any, status: number) {
    const text = status === 1 ? "发布" : "下线";
    ElMessageBox.confirm(`确认要${text}《${row.title}》吗？`, "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
      draggable: true
    })
      .then(async () => {
        await updateSiteContentStatus(row.id, { status });
        message("状态更新成功", { type: "success" });
        onSearch();
      })
      .catch(() => {
        // no-op
      });
  }

  onMounted(() => {
    Promise.all([loadCategoryOptions(), loadTagOptions(), onSearch()]);
  });

  return {
    form,
    loading,
    categoryOptions,
    tagOptions,
    columns,
    dataList,
    pagination,
    onSearch,
    resetForm,
    handleSizeChange,
    handleCurrentChange,
    openDialog,
    handleDelete
  };
}
