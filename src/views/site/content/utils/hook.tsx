import editForm from "../form.vue";
import { message } from "@/utils/message";
import { addDialog } from "@/components/ReDialog";
import type { PaginationProps } from "@pureadmin/table";
import { reactive, ref, onMounted, h, toRaw } from "vue";
import { deviceDetection, isAllEmpty } from "@pureadmin/utils";
import type { FormItemProps } from "./types";
import { getSiteCategoryList } from "@/api/siteCategory";
import {
  getSiteContentList,
  createSiteContent,
  updateSiteContent,
  deleteSiteContent
} from "@/api/siteContent";

export function useSiteContent() {
  const form = reactive({
    keyword: "",
    status: "" as number | "",
    categoryId: "" as number | ""
  });
  const formRef = ref();
  const dataList = ref([]);
  const categoryOptions = ref<any[]>([]);
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
      label: "状态",
      prop: "status",
      minWidth: 90,
      cellRenderer: ({ row, props }) => (
        <el-tag size={props.size} type={row.status === 1 ? "success" : "info"}>
          {row.status === 1 ? "已发布" : "草稿"}
        </el-tag>
      )
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

  onMounted(() => {
    Promise.all([loadCategoryOptions(), onSearch()]);
  });

  return {
    form,
    loading,
    categoryOptions,
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
