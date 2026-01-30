import editForm from "../form.vue";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import type { FormItemProps } from "../utils/types";
import type { PaginationProps } from "@pureadmin/table";
import { deviceDetection } from "@pureadmin/utils";
import {
  getCasbinList,
  createCasbin,
  updateCasbin,
  deleteCasbin
} from "@/api/casbin";
import { type Ref, reactive, ref, onMounted, h } from "vue";

function pickText(e: any) {
  return typeof e === "string" ? e : "";
}

export function useApi(_treeRef: Ref) {
  const form = reactive({
    roleKey: "",
    path: "",
    method: ""
  });

  const formRef = ref();
  const dataList = ref<any[]>([]);
  const loading = ref(true);

  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 10,
    currentPage: 1,
    background: true
  });

  const columns: TableColumnList = [
    { label: "ID", prop: "id", width: 90 },
    { label: "角色", prop: "roleKey", minWidth: 140 },
    { label: "API路径", prop: "path", minWidth: 240 },
    { label: "请求方法", prop: "method", width: 110 },
    { label: "操作", fixed: "right", width: 180, slot: "operation" }
  ];

  async function onSearch() {
    loading.value = true;
    try {
      const res = await getCasbinList({
        p: pagination.currentPage,
        n: pagination.pageSize,
        role: pickText(form.roleKey),
        path: pickText(form.path),
        method: pickText(form.method)
      });

      const page = res?.data;
      const list = page?.list ?? [];

      dataList.value = list.map((r: any) => ({
        id: r.id,
        roleKey: r.v0,
        path: r.v1,
        method: r.v2,
        raw: r
      }));

      pagination.total = page?.total ?? 0;
      pagination.pageSize = page?.pageSize ?? pagination.pageSize;
      // 后端 currentPage 目前可能返回 0，这里以前端为准
    } catch {
      message("获取Casbin规则列表失败", { type: "error" });
    } finally {
      loading.value = false;
    }
  }

  const resetForm = formEl => {
    if (!formEl) return;
    formEl.resetFields();
    pagination.currentPage = 1;
    onSearch();
  };

  function handleSizeChange(val: number) {
    pagination.pageSize = val;
    pagination.currentPage = 1;
    onSearch();
  }

  function handleCurrentChange(val: number) {
    pagination.currentPage = val;
    onSearch();
  }

  function handleSelectionChange(_val) {
    // no-op
  }

  function openDialog(title = "新增", row?: any) {
    addDialog({
      title: `${title}API权限`,
      props: {
        formInline: {
          id: row?.id,
          roleKey: row?.roleKey ?? "",
          path: row?.path ?? "",
          method: row?.method ?? "",
          apiGroup: "",
          description: ""
        }
      },
      width: "40%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () =>
        h(editForm, {
          ref: formRef,
          formInline: null,
          onVnodeMounted: () => {
            formRef.value?.loadBackendRoutes?.();
            formRef.value?.loadRoles?.();
          }
        }),
      beforeSure: async (done, { options }) => {
        const FormRef = formRef.value.getRef();
        const curData = options.props.formInline as FormItemProps;
        FormRef.validate(async valid => {
          if (!valid) return;
          try {
            const payload = {
              v0: curData.roleKey,
              v1: curData.path,
              v2: curData.method
            };

            if (title === "新增") {
              await createCasbin(payload);
              message("新增成功", { type: "success" });
            } else {
              await updateCasbin(curData.id as any, payload);
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

  function handleDelete(row) {
    ElMessageBox.confirm(
      `是否确认删除该权限：${row.roleKey} ${row.method} ${row.path} ?`,
      "系统提示",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
        draggable: true
      }
    )
      .then(async () => {
        try {
          await deleteCasbin(row.id, {
            v0: row.roleKey,
            v1: row.path,
            v2: row.method
          });
          message("删除成功", { type: "success" });
          onSearch();
        } catch {
          message("删除失败", { type: "error" });
        }
      })
      .catch(() => void 0);
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
    openDialog,
    handleDelete,
    handleSizeChange,
    handleCurrentChange,
    handleSelectionChange
  };
}
