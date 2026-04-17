import dayjs from "dayjs";
import { message } from "@/utils/message";
import { getKeyList } from "@pureadmin/utils";
import { deleteLoginLogs, getLoginLogsList } from "@/api/system";
import { usePublicHooks } from "@/views/system/hooks";
import type { PaginationProps } from "@pureadmin/table";
import { type Ref, reactive, ref, onMounted } from "vue";

export function useRole(tableRef: Ref) {
  const form = reactive({
    username: "",
    status: "",
    loginTime: [] as string[]
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
      label: "用户名",
      prop: "username",
      minWidth: 120
    },
    {
      label: "登录 IP",
      prop: "ip",
      minWidth: 160
    },
    {
      label: "登录状态",
      prop: "status",
      minWidth: 100,
      cellRenderer: ({ row, props }) => (
        <el-tag size={props.size} style={tagStyle.value(row.status)}>
          {row.status === 1 ? "成功" : "失败"}
        </el-tag>
      )
    },
    {
      label: "登录行为",
      prop: "behavior",
      minWidth: 220,
      showOverflowTooltip: true
    },
    {
      label: "登录时间",
      prop: "loginTime",
      minWidth: 180,
      formatter: ({ loginTime }) =>
        dayjs(loginTime).format("YYYY-MM-DD HH:mm:ss")
    }
  ];

  function buildParams() {
    const [startTime, endTime] = form.loginTime || [];
    return {
      pageNum: pagination.currentPage,
      pageSize: pagination.pageSize,
      username: form.username || undefined,
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
    const { code, msg } = await deleteLoginLogs(ids);
    if (code === 200 || code === 0) {
      message(msg || "删除成功", { type: "success" });
      tableRef.value.getTableRef().clearSelection();
      onSearch();
    }
  }

  async function clearAll() {
    const { code, msg } = await deleteLoginLogs();
    if (code === 200 || code === 0) {
      message(msg || "已清空登录日志", { type: "success" });
      onSearch();
    }
  }

  async function onSearch() {
    loading.value = true;
    const { code, data } = await getLoginLogsList(buildParams());
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
