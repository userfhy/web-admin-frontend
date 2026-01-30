import dayjs from "dayjs";
import editForm from "../form.vue";
import { handleTree } from "@/utils/tree";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import { usePublicHooks } from "../../hooks";
import { transformI18n } from "@/plugins/i18n";
import { addDialog } from "@/components/ReDialog";
import type { FormItemProps } from "../utils/types";
import type { PaginationProps } from "@pureadmin/table";
import { getKeyList, deviceDetection } from "@pureadmin/utils";
import { getRoleList, getMenuList } from "@/api/system";
import {
  getRoleMenuIdsByRoleId,
  saveRoleMenuIdsByRoleId
} from "@/api/roleMenu";
import { type Ref, reactive, ref, onMounted, h, toRaw, watch } from "vue";

export function useRole(treeRef: Ref) {
  const form = reactive({
    name: "",
    code: "",
    status: ""
  });
  const curRow = ref<any>();
  const formRef = ref();
  const dataList = ref<any[]>([]);
  const treeIds = ref<number[]>([]);
  const treeData = ref<any[]>([]);
  const isShow = ref(false);
  const loading = ref(true);
  const isLinkage = ref(false);
  const treeSearchValue = ref();
  const switchLoadMap = ref<Record<string, any>>({});
  const isExpandAll = ref(false);
  const isSelectAll = ref(false);
  const { switchStyle } = usePublicHooks();

  const treeProps = {
    value: "id",
    label: "title",
    children: "children"
  };

  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 10,
    currentPage: 1,
    background: true
  });

  const columns: TableColumnList = [
    {
      label: "角色编号",
      prop: "id"
    },
    {
      label: "角色名称",
      prop: "name"
    },
    {
      label: "角色标识",
      prop: "code"
    },
    {
      label: "状态",
      cellRenderer: scope => (
        <el-switch
          size={scope.props.size === "small" ? "small" : "default"}
          loading={switchLoadMap.value[scope.index]?.loading}
          v-model={scope.row.status}
          active-value={1}
          inactive-value={0}
          active-text="已启用"
          inactive-text="已停用"
          inline-prompt
          style={switchStyle.value}
          onChange={() => onChange(scope as any)}
        />
      ),
      minWidth: 90
    },
    {
      label: "备注",
      prop: "remark",
      minWidth: 160
    },
    {
      label: "创建时间",
      prop: "createTime",
      minWidth: 160,
      formatter: ({ createTime }) =>
        createTime ? dayjs(createTime).format("YYYY-MM-DD HH:mm:ss") : ""
    },
    {
      label: "更新时间",
      prop: "updateTime",
      minWidth: 160,
      formatter: ({ updateTime }) =>
        updateTime ? dayjs(updateTime).format("YYYY-MM-DD HH:mm:ss") : ""
    },
    {
      label: "操作",
      fixed: "right",
      width: 210,
      slot: "operation"
    }
  ];

  function onChange({ row, index }) {
    ElMessageBox.confirm(
      `确认要<strong>${
        row.status === 0 ? "停用" : "启用"
      }</strong><strong style='color:var(--el-color-primary)'>${
        row.name
      }</strong>吗?`,
      "系统提示",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
        dangerouslyUseHTMLString: true,
        draggable: true
      }
    )
      .then(() => {
        switchLoadMap.value[index] = Object.assign(
          {},
          switchLoadMap.value[index],
          {
            loading: true
          }
        );
        setTimeout(() => {
          switchLoadMap.value[index] = Object.assign(
            {},
            switchLoadMap.value[index],
            {
              loading: false
            }
          );
          message(`已${row.status === 0 ? "停用" : "启用"}${row.name}`, {
            type: "success"
          });
        }, 300);
      })
      .catch(() => {
        row.status === 0 ? (row.status = 1) : (row.status = 0);
      });
  }

  function handleDelete(row) {
    message(`您删除了角色名称为${row.name}的这条数据`, { type: "success" });
    onSearch();
  }

  function handleSizeChange(val: number) {
    console.log(`${val} items per page`);
  }

  function handleCurrentChange(val: number) {
    console.log(`current page: ${val}`);
  }

  function handleSelectionChange(val) {
    console.log("handleSelectionChange", val);
  }

  async function onSearch() {
    loading.value = true;
    try {
      const res: any = await getRoleList(toRaw(form));
      const ok = (res?.success && res?.code === 200) || res?.code === 0;
      const data = res?.data;
      if (ok && data) {
        dataList.value = data.list ?? [];
        pagination.total = data.total ?? 0;
        pagination.pageSize = data.pageSize ?? pagination.pageSize;
        pagination.currentPage = data.currentPage ?? pagination.currentPage;
      } else {
        dataList.value = [];
        pagination.total = 0;
      }
    } catch {
      message("获取角色列表失败", { type: "error" });
    } finally {
      loading.value = false;
    }
  }

  const resetForm = formEl => {
    if (!formEl) return;
    formEl.resetFields();
    onSearch();
  };

  function openDialog(title = "新增", row?: FormItemProps) {
    addDialog({
      title: `${title}角色`,
      props: {
        formInline: {
          name: row?.name ?? "",
          code: row?.code ?? "",
          remark: row?.remark ?? ""
        }
      },
      width: "40%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(editForm, { ref: formRef, formInline: null }),
      beforeSure: (done, { options }) => {
        const FormRef = formRef.value.getRef();
        const curData = options.props.formInline as FormItemProps;
        function chores() {
          message(`您${title}了角色名称为${curData.name}的这条数据`, {
            type: "success"
          });
          done();
          onSearch();
        }
        FormRef.validate(valid => {
          if (valid) {
            if (title === "新增") {
              chores();
            } else {
              chores();
            }
          }
        });
      }
    });
  }

  async function handleMenu(row?: any) {
    if (!row) {
      curRow.value = null;
      isShow.value = false;
      return;
    }

    const roleId = row.id;
    if (!roleId) return;

    curRow.value = row;
    isShow.value = true;

    try {
      const res = await getRoleMenuIdsByRoleId(roleId);
      const ids = res?.data ?? [];
      treeRef.value.setCheckedKeys(ids);
    } catch {
      message("获取角色菜单权限失败", { type: "error" });
    }
  }

  function rowStyle({ row: { role_id, id } }) {
    const rid = role_id ?? id;
    return {
      cursor: "pointer",
      background:
        rid === (curRow.value?.role_id ?? curRow.value?.id)
          ? "var(--el-fill-color-light)"
          : ""
    };
  }

  async function handleSave() {
    const row = curRow.value;
    const roleId = row?.id;
    if (!roleId) return;

    try {
      const menuIds = (treeRef.value.getCheckedKeys?.() ?? []) as number[];
      const res: any = await saveRoleMenuIdsByRoleId(roleId, menuIds);
      const ok = (res?.success && res?.code === 200) || res?.code === 0;
      if (!ok) {
        message(res?.msg || "保存失败", { type: "error" });
        return;
      }
      message("保存成功", { type: "success" });
    } catch {
      message("保存失败", { type: "error" });
    }
  }

  const onQueryChanged = (query: string) => {
    treeRef.value!.filter(query);
  };

  const filterMethod = (query: string, node) => {
    return transformI18n(node.title)!.includes(query);
  };

  onMounted(async () => {
    await onSearch();

    // 菜单树
    try {
      const res: any = await getMenuList();
      const ok = (res?.success && res?.code === 200) || res?.code === 0;
      if (ok) {
        const list = res?.data ?? [];
        treeIds.value = getKeyList(list, "id");
        treeData.value = handleTree(list);
      }
    } catch {
      message("获取菜单树失败", { type: "error" });
    }
  });

  watch(isExpandAll, val => {
    val
      ? treeRef.value.setExpandedKeys(treeIds.value)
      : treeRef.value.setExpandedKeys([]);
  });

  watch(isSelectAll, val => {
    val
      ? treeRef.value.setCheckedKeys(treeIds.value)
      : treeRef.value.setCheckedKeys([]);
  });

  return {
    form,
    isShow,
    curRow,
    loading,
    columns,
    rowStyle,
    dataList,
    treeData,
    treeProps,
    isLinkage,
    pagination,
    isExpandAll,
    isSelectAll,
    treeSearchValue,
    onSearch,
    resetForm,
    openDialog,
    handleMenu,
    handleSave,
    handleDelete,
    filterMethod,
    transformI18n,
    onQueryChanged,
    handleSizeChange,
    handleCurrentChange,
    handleSelectionChange
  };
}
