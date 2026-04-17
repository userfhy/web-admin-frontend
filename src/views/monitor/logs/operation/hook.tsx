import dayjs from "dayjs";
import { message } from "@/utils/message";
import { getKeyList } from "@pureadmin/utils";
import { deleteOperationLogs, getOperationLogsList } from "@/api/system";
import { usePublicHooks } from "@/views/system/hooks";
import type { PaginationProps } from "@pureadmin/table";
import { type Ref, reactive, ref, onMounted } from "vue";

export function useRole(tableRef: Ref) {
  const form = reactive({
    module: "",
    status: "",
    operatingTime: [] as string[]
  });
  const dataList = ref([]);
  const loading = ref(true);
  const selectedNum = ref(0);
  const { tagStyle } = usePublicHooks();

  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 10,
    currentPage: 1,
    background: true
  });
  const columns: TableColumnList = [
    {
      label: "勾选列",
      type: "selection",
      fixed: "left",
      reserveSelection: true
    },
    {
      label: "序号",
      prop: "id",
      minWidth: 90
    },
    {
      label: "操作人员",
      prop: "username",
      minWidth: 120
    },
    {
      label: "所属模块",
      prop: "module",
      minWidth: 120
    },
    {
      label: "操作概要",
      prop: "summary",
      minWidth: 220,
      showOverflowTooltip: true
    },
    {
      label: "操作 IP",
      prop: "ip",
      minWidth: 160
    },
    {
      label: "操作状态",
      prop: "status",
      minWidth: 100,
      cellRenderer: ({ row, props }) => (
        <el-tag size={props.size} style={tagStyle.value(row.status)}>
          {row.status === 1 ? "成功" : "失败"}
        </el-tag>
      )
    },
    {
      label: "操作时间",
      prop: "operatingTime",
      minWidth: 180,
      formatter: ({ operatingTime }) =>
        dayjs(operatingTime).format("YYYY-MM-DD HH:mm:ss")
    }
  ];

  function buildParams() {
    const [startTime, endTime] = form.operatingTime || [];
    return {
      pageNum: pagination.currentPage,
      pageSize: pagination.pageSize,
      module: form.module || undefined,
      status: form.status || undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined
    };
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

  function handleSelectionChange(val) {
    selectedNum.value = val.length;
    tableRef.value.setAdaptive();
  }

  function onSelectionCancel() {
    selectedNum.value = 0;
    tableRef.value.getTableRef().clearSelection();
  }

  async function onbatchDel() {
    const curSelected = tableRef.value.getTableRef().getSelectionRows();
    const ids = getKeyList(curSelected, "id") as number[];
    if (!ids.length) return;
    const { code, msg } = await deleteOperationLogs(ids);
    if (code === 200 || code === 0) {
      message(msg || "删除成功", { type: "success" });
      tableRef.value.getTableRef().clearSelection();
      onSearch();
    }
  }

  async function clearAll() {
    const { code, msg } = await deleteOperationLogs();
    if (code === 200 || code === 0) {
      message(msg || "已清空操作日志", { type: "success" });
      onSearch();
    }
  }

  async function onSearch() {
    loading.value = true;
    const { code, data } = await getOperationLogsList(buildParams());
    if ((code === 200 || code === 0) && data) {
      dataList.value = data.list || [];
      pagination.total = data.total || 0;
      pagination.pageSize = data.pageSize || pagination.pageSize;
      pagination.currentPage = data.currentPage || pagination.currentPage;
    }
    loading.value = false;
  }

  const resetForm = formEl => {
    if (!formEl) return;
    formEl.resetFields();
    pagination.currentPage = 1;
    onSearch();
  };

  onMounted(() => {
    onSearch();
  });

  return {
    form,
    loading,
    columns,
    dataList,
    pagination,
    selectedNum,
    onSearch,
    clearAll,
    resetForm,
    onbatchDel,
    handleSizeChange,
    onSelectionCancel,
    handleCurrentChange,
    handleSelectionChange
  };
}
