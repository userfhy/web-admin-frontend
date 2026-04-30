import dayjs from "dayjs";
import { message } from "@/utils/message";
import { forceOfflineUser, getOnlineUserList } from "@/api/system";
import { reactive, ref, onMounted, toRaw } from "vue";
import type { PaginationProps } from "@pureadmin/table";
import type { OnlineUserRow } from "@/api/system";

export function useRole() {
  const form = reactive({
    username: "",
    ip: ""
  });
  const dataList = ref<OnlineUserRow[]>([]);
  const loading = ref(true);
  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 10,
    currentPage: 1,
    background: true
  });
  const columns: TableColumnList = [
    {
      label: "用户名",
      prop: "username",
      minWidth: 120
    },
    {
      label: "昵称",
      prop: "nickname",
      minWidth: 120
    },
    {
      label: "角色",
      prop: "roleName",
      minWidth: 120
    },
    {
      label: "会话 ID",
      prop: "sessionId",
      minWidth: 180
    },
    {
      label: "设备名",
      prop: "deviceName",
      minWidth: 140,
      formatter: ({ deviceName, os, browser }) =>
        deviceName || [os, browser].filter(Boolean).join(" / ") || "-"
    },
    {
      label: "登录 IP",
      prop: "ip",
      minWidth: 140
    },
    {
      label: "浏览器",
      prop: "browser",
      minWidth: 110
    },
    {
      label: "系统",
      prop: "os",
      minWidth: 100
    },
    {
      label: "最近活跃",
      prop: "lastActiveAt",
      minWidth: 180,
      formatter: ({ lastActiveAt }) =>
        lastActiveAt ? dayjs(lastActiveAt).format("YYYY-MM-DD HH:mm:ss") : "-"
    },
    {
      label: "登录时间",
      prop: "loginAt",
      minWidth: 180,
      formatter: ({ loginAt }) =>
        loginAt ? dayjs(loginAt).format("YYYY-MM-DD HH:mm:ss") : "-"
    },
    {
      label: "过期时间",
      prop: "expiresAt",
      minWidth: 180,
      formatter: ({ expiresAt }) =>
        expiresAt ? dayjs(expiresAt).format("YYYY-MM-DD HH:mm:ss") : "-"
    },
    {
      label: "Token剩余",
      prop: "tokenRemainingSeconds",
      minWidth: 120,
      formatter: ({ tokenRemainingSeconds, expiresAt }) =>
        formatTokenRemaining(tokenRemainingSeconds, expiresAt)
    },
    {
      label: "操作",
      fixed: "right",
      width: 120,
      slot: "operation"
    }
  ];

  function handleSizeChange(val: number) {
    pagination.pageSize = val;
    pagination.currentPage = 1;
    onSearch();
  }

  function handleCurrentChange(val: number) {
    pagination.currentPage = val;
    onSearch();
  }

  function handleSelectionChange() {}

  function formatTokenRemaining(seconds?: number, expiresAt?: string) {
    let remaining = Number(seconds);
    if (!Number.isFinite(remaining) && expiresAt) {
      remaining = dayjs(expiresAt).diff(dayjs(), "second");
    }
    if (!Number.isFinite(remaining) || remaining <= 0) {
      return "已过期";
    }
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    if (days > 0) {
      return `${days}天${hours}小时`;
    }
    if (hours > 0) {
      return `${hours}小时${minutes}分`;
    }
    return `${minutes}分`;
  }

  async function handleOffline(row: OnlineUserRow) {
    if (!row.sessionId) {
      message("当前会话缺少 sessionId，无法强制下线", { type: "error" });
      return;
    }
    const res = await forceOfflineUser(row.userId, row.sessionId);
    if (res?.code !== 200) {
      message(res?.msg || res?.message || "强制下线失败", { type: "error" });
      return;
    }
    message(`${row.username} 已被强制下线`, { type: "success" });
    onSearch();
  }

  async function onSearch() {
    loading.value = true;
    try {
      const {
        code,
        data,
        msg,
        message: errMessage
      } = await getOnlineUserList({
        pageNum: pagination.currentPage,
        pageSize: pagination.pageSize,
        username: toRaw(form).username || undefined,
        ip: toRaw(form).ip || undefined
      });
      if (code !== 200) {
        message(msg || errMessage || "获取在线用户失败", { type: "error" });
        return;
      }
      dataList.value = data?.list ?? [];
      pagination.total = data?.total ?? 0;
      pagination.pageSize = data?.pageSize ?? pagination.pageSize;
      pagination.currentPage = data?.currentPage ?? pagination.currentPage;
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
    handleOffline,
    handleSizeChange,
    handleCurrentChange,
    handleSelectionChange
  };
}
