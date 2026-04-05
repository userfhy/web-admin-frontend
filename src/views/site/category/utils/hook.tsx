import editForm from "../form.vue";
import { message } from "@/utils/message";
import { addDialog } from "@/components/ReDialog";
import type { PaginationProps } from "@pureadmin/table";
import { reactive, ref, onMounted, h, toRaw } from "vue";
import { deviceDetection, isAllEmpty } from "@pureadmin/utils";
import type { FormItemProps } from "./types";
import {
  getSiteCategoryList,
  createSiteCategory,
  updateSiteCategory,
  deleteSiteCategory
} from "@/api/siteCategory";

export function useSiteCategory() {
  const form = reactive({
    keyword: "",
    status: "" as number | ""
  });
  const formRef = ref();
  const dataList = ref([]);
  const loading = ref(true);
  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 10,
    currentPage: 1,
    background: true
  });

  const columns: TableColumnList = [
    { label: "分类名称", prop: "name", minWidth: 180 },
    { label: "Slug", prop: "slug", minWidth: 180 },
    {
      label: "状态",
      prop: "status",
      minWidth: 90,
      cellRenderer: ({ row, props }) => (
        <el-tag size={props.size} type={row.status === 1 ? "success" : "info"}>
          {row.status === 1 ? "启用" : "停用"}
        </el-tag>
      )
    },
    { label: "排序", prop: "sort", width: 80 },
    { label: "描述", prop: "description", minWidth: 220 },
    { label: "更新时间", prop: "updatedAt", minWidth: 170 },
    { label: "操作", fixed: "right", width: 160, slot: "operation" }
  ];

  async function onSearch() {
    loading.value = true;
    try {
      const params: any = {
        pageNum: pagination.currentPage,
        pageSize: pagination.pageSize
      };
      if (!isAllEmpty(form.keyword)) params.keyword = form.keyword;
      if (form.status !== "") params.status = form.status;

      const res: any = await getSiteCategoryList(params);
      const data = res?.data ?? {};
      dataList.value = data.list ?? [];
      pagination.total = data.total ?? 0;
      pagination.currentPage = data.currentPage ?? pagination.currentPage;
      pagination.pageSize = data.pageSize ?? pagination.pageSize;
    } catch {
      dataList.value = [];
      pagination.total = 0;
      message("获取类别失败", { type: "error" });
    } finally {
      loading.value = false;
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
      title: `${title}类别`,
      props: {
        formInline: {
          id: row?.id,
          name: row?.name ?? "",
          slug: row?.slug ?? "",
          description: row?.description ?? "",
          status: row?.status ?? 1,
          sort: row?.sort ?? 0
        }
      },
      width: "42%",
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
            name: curData.name,
            slug: curData.slug,
            description: curData.description,
            status: curData.status,
            sort: curData.sort
          };
          try {
            if (title === "新增") {
              await createSiteCategory(payload);
              message("新增成功", { type: "success" });
            } else {
              await updateSiteCategory(curData.id as number, payload);
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
    deleteSiteCategory(row.id)
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
    onSearch();
  });

  return {
    form,
    loading,
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
