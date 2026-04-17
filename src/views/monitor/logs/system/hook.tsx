import dayjs from "dayjs";
import Detail from "./detail.vue";
import { message } from "@/utils/message";
import { addDialog } from "@/components/ReDialog";
import { usePublicHooks } from "@/views/system/hooks";
import type { PaginationProps } from "@pureadmin/table";
import { type Ref, reactive, ref, onMounted } from "vue";
import { getKeyList, useCopyToClipboard } from "@pureadmin/utils";
import {
  deleteSystemLogs,
  getSystemLogsDetail,
  getSystemLogsList
} from "@/api/system";
import Info from "~icons/ri/question-line";

export function useRole(tableRef: Ref) {
  const form = reactive({
    module: "",
    requestTime: [] as string[]
  });
  const dataList = ref([]);
  const loading = ref(true);
  const selectedNum = ref(0);
  const { copied, update } = useCopyToClipboard();
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
      label: "ID",
      prop: "id",
      minWidth: 90
    },
    {
      label: "日志分类",
      prop: "category",
      minWidth: 100
    },
    {
      label: "操作用户",
      prop: "username",
      minWidth: 120
    },
    {
      label: "所属模块",
      prop: "module",
      minWidth: 100
    },
    {
      headerRenderer: () => (
        <span class="flex-c">
          请求接口
          <iconifyIconOffline
            icon={Info}
            class="ml-1 cursor-help"
            v-tippy={{
              content: "双击下面请求接口进行拷贝"
            }}
          />
        </span>
      ),
      prop: "url",
      minWidth: 200,
      showOverflowTooltip: true
    },
    {
      label: "请求方法",
      prop: "method",
      minWidth: 100
    },
    {
      label: "IP 地址",
      prop: "ip",
      minWidth: 140
    },
    {
      label: "状态",
      prop: "status",
      minWidth: 100,
      cellRenderer: ({ row, props }) => (
        <el-tag
          size={props.size}
          style={tagStyle.value(row.status >= 200 && row.status < 400 ? 1 : 0)}
        >
          {row.status}
        </el-tag>
      )
    },
    {
      label: "请求耗时",
      prop: "takesTime",
      minWidth: 100,
      cellRenderer: ({ row, props }) => (
        <el-tag
          size={props.size}
          type={row.takesTime < 1000 ? "success" : "warning"}
          effect="plain"
        >
          {row.takesTime} ms
        </el-tag>
      )
    },
    {
      label: "请求时间",
      prop: "requestTime",
      minWidth: 180,
      formatter: ({ requestTime }) =>
        dayjs(requestTime).format("YYYY-MM-DD HH:mm:ss")
    },
    {
      label: "操作",
      fixed: "right",
      slot: "operation"
    }
  ];

  function buildParams() {
    const [startTime, endTime] = form.requestTime || [];
    return {
      pageNum: pagination.currentPage,
      pageSize: pagination.pageSize,
      module: form.module || undefined,
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

  function handleCellDblclick({ url }, { property }) {
    if (property !== "url") return;
    update(url);
    copied.value
      ? message(`${url} 已拷贝`, { type: "success" })
      : message("拷贝失败", { type: "warning" });
  }

  async function onbatchDel() {
    const curSelected = tableRef.value.getTableRef().getSelectionRows();
    const ids = getKeyList(curSelected, "id") as number[];
    if (!ids.length) return;
    const { code, msg } = await deleteSystemLogs(ids);
    if (code === 200 || code === 0) {
      message(msg || "删除成功", { type: "success" });
      tableRef.value.getTableRef().clearSelection();
      onSearch();
    }
  }

  async function clearAll() {
    const { code, msg } = await deleteSystemLogs();
    if (code === 200 || code === 0) {
      message(msg || "已清空系统日志", { type: "success" });
      onSearch();
    }
  }

  async function onDetail(row) {
    const { code, data, msg } = await getSystemLogsDetail(row.id);
    if ((code !== 200 && code !== 0) || !data) {
      message(msg || "获取日志详情失败", { type: "error" });
      return;
    }
    addDialog({
      title: "系统日志详情",
      fullscreen: true,
      hideFooter: true,
      contentRenderer: () => Detail,
      props: {
        data: [data]
      }
    });
  }

  async function onSearch() {
    loading.value = true;
    const { code, data } = await getSystemLogsList(buildParams());
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
    onDetail,
    clearAll,
    resetForm,
    onbatchDel,
    handleSizeChange,
    onSelectionCancel,
    handleCellDblclick,
    handleCurrentChange,
    handleSelectionChange
  };
}
