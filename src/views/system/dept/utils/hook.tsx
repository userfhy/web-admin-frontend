import editForm from "../form.vue";
import { handleTree } from "@/utils/tree";
import { message } from "@/utils/message";
import { usePublicHooks } from "../../hooks";
import { addDialog } from "@/components/ReDialog";
import { reactive, ref, onMounted, h } from "vue";
import type { FormItemProps } from "../utils/types";
import { cloneDeep, isAllEmpty, deviceDetection } from "@pureadmin/utils";
import {
  getDeptTree,
  getDeptList,
  createDept,
  updateDept,
  deleteDept,
  type DeptRow
} from "@/api/dept";

function collectDescendants(list: any[], rootId: number): any[] {
  const childrenMap = new Map<number, any[]>();
  for (const item of list) {
    const pid = item.parentId ?? 0;
    const arr = childrenMap.get(pid) ?? [];
    arr.push(item);
    childrenMap.set(pid, arr);
  }

  const res: any[] = [];
  const queue: number[] = [rootId];
  const visited = new Set<number>();
  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const self = list.find(x => x.id === id);
    if (self) res.push(self);

    const children = childrenMap.get(id) ?? [];
    for (const c of children) queue.push(c.id);
  }

  return res;
}

export function useDept() {
  const form = reactive({
    deptName: "",
    status: null as null | number
  });

  const formRef = ref();
  const treeData = ref<any[]>([]);
  const dataList = ref<any[]>([]);
  const flatList = ref<DeptRow[]>([]);
  const selectedDeptId = ref<number>(0);
  const loading = ref(true);
  const { tagStyle } = usePublicHooks();

  const columns: TableColumnList = [
    {
      label: "部门名称",
      prop: "deptName",
      width: 180,
      align: "left"
    },
    {
      label: "排序",
      prop: "orderNum",
      minWidth: 70
    },
    {
      label: "负责人",
      prop: "leader",
      minWidth: 120
    },
    {
      label: "状态",
      prop: "status",
      minWidth: 100,
      cellRenderer: ({ row, props }) => (
        <el-tag size={props.size} style={tagStyle.value(row.status)}>
          {row.status === 1 ? "启用" : "停用"}
        </el-tag>
      )
    },
    {
      label: "备注",
      prop: "remark",
      minWidth: 220
    },
    {
      label: "操作",
      fixed: "right",
      width: 210,
      slot: "operation"
    }
  ];

  function handleSelectionChange(_val) {
    // no-op
  }

  function resetForm(formEl) {
    if (!formEl) return;
    formEl.resetFields();
    onSearch();
  }

  async function loadTree() {
    const res = await getDeptTree();
    treeData.value = res?.data ?? [];
  }

  async function loadList() {
    const res = await getDeptList();
    flatList.value = (res?.data ?? []) as DeptRow[];
  }

  function applyFilterAndSelection() {
    let base: any[] = flatList.value;

    if (selectedDeptId.value) {
      base = collectDescendants(base, selectedDeptId.value);
    }

    if (!isAllEmpty(form.deptName)) {
      base = base.filter(item => (item.deptName ?? "").includes(form.deptName));
    }
    if (!isAllEmpty(form.status)) {
      base = base.filter(item => item.status === form.status);
    }

    // 右表以“树表格”展示（与现有页面一致），这里把筛选后的列表再转成树
    dataList.value = handleTree(base);
  }

  async function onSearch() {
    loading.value = true;
    try {
      await Promise.all([loadTree(), loadList()]);
      applyFilterAndSelection();
    } catch {
      message("获取部门数据失败", { type: "error" });
    } finally {
      loading.value = false;
    }
  }

  function onTreeNodeClick(node: any) {
    selectedDeptId.value = node?.id ?? 0;
    applyFilterAndSelection();
  }

  function formatHigherDeptOptions(treeList: any[]) {
    if (!treeList || !treeList.length) return;
    const newTreeList: any[] = [];
    for (let i = 0; i < treeList.length; i++) {
      treeList[i].disabled = treeList[i].status === 0;
      formatHigherDeptOptions(treeList[i].children);
      newTreeList.push(treeList[i]);
    }
    return newTreeList;
  }

  function openDialog(title = "新增", row?: any) {
    addDialog({
      title: `${title}部门`,
      props: {
        formInline: {
          id: row?.id,
          higherDeptOptions: formatHigherDeptOptions(cloneDeep(treeData.value)),
          parentId: row?.parentId ?? 0,
          deptName: row?.deptName ?? "",
          leader: row?.leader ?? "",
          phone: row?.phone ?? "",
          email: row?.email ?? "",
          orderNum: row?.orderNum ?? 0,
          status: row?.status ?? 1,
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
        FormRef.validate(async valid => {
          if (!valid) return;
          try {
            const payload = {
              parentId: curData.parentId,
              deptName: curData.deptName,
              orderNum: curData.orderNum,
              leader: curData.leader,
              phone: String(curData.phone ?? ""),
              email: curData.email,
              status: curData.status,
              remark: curData.remark
            };

            if (title === "新增") {
              await createDept(payload);
              message("新增成功", { type: "success" });
            } else {
              await updateDept(curData.id as any, payload);
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
    // 后端禁止删除存在子部门的节点
    deleteDept(row.id)
      .then(res => {
        if (res?.code !== 200) {
          message(res?.msg || "删除失败", { type: "error" });
          return;
        }
        message("删除成功", { type: "success" });
        onSearch();
      })
      .catch(() => {
        message("删除失败", { type: "error" });
      });
  }

  onMounted(() => {
    onSearch();
  });

  return {
    form,
    loading,
    columns,
    dataList,
    treeData,
    onTreeNodeClick,
    /** 搜索 */
    onSearch,
    /** 重置 */
    resetForm,
    /** 新增、修改部门 */
    openDialog,
    /** 删除部门 */
    handleDelete,
    handleSelectionChange
  };
}
