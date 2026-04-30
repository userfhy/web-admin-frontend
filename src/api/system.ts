import { http } from "@/utils/http";
import { baseUrlApi } from "./utils";

type Result<T = any> = {
  code: number;
  success?: boolean;
  msg?: string;
  message?: string;
  data?: T;
};

type ResultTable<T = any> = {
  code: number;
  success?: boolean;
  msg?: string;
  message?: string;
  data?: {
    list: Array<T>;
    total?: number;
    pageSize?: number;
    currentPage?: number;
  };
};

export type OnlineUserRow = {
  sessionId: string;
  userId: number;
  username: string;
  nickname?: string;
  roleId: number;
  roleName?: string;
  roleKey?: string;
  isAdmin: boolean;
  ip: string;
  userAgent?: string;
  browser?: string;
  os?: string;
  deviceName?: string;
  loginAt: string;
  lastActiveAt: string;
  expiresAt: string;
  tokenHash: string;
  tokenRemainingSeconds?: number;
};

export type OnlineUserListParams = {
  pageNum: number;
  pageSize: number;
  username?: string;
  ip?: string;
};

export type MonitorSample = {
  timestamp: string;
  cpuUsage: number;
  memoryUsedPercent: number;
  swapUsedPercent: number;
  diskUsedPercent: number;
  load1: number;
  goroutines: number;
  heapAlloc: number;
  netBytesSent: number;
  netBytesRecv: number;
};

export type ServerMonitorSnapshot = {
  timestamp: string;
  host: {
    hostname: string;
    uptime: number;
    bootTime: string;
    os: string;
    platform: string;
    kernelArch: string;
    processCount: number;
    users: Array<{
      user: string;
      terminal: string;
      host: string;
      started: number;
    }>;
  };
  cpu: {
    cores: number;
    modelName: string;
    mhz: number;
    usage: number;
    coreUsages: number[];
    load1: number;
    load5: number;
    load15: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    available: number;
    cached: number;
    buffers: number;
    usedPercent: number;
  };
  swap: {
    total: number;
    used: number;
    free: number;
    usedPercent: number;
  };
  disks: Array<{
    path: string;
    fstype: string;
    total: number;
    used: number;
    free: number;
    usedPercent: number;
  }>;
  network: Array<{
    name: string;
    bytesSent: number;
    bytesRecv: number;
    packetsSent: number;
    packetsRecv: number;
    errin: number;
    errout: number;
    dropin: number;
    dropout: number;
  }>;
  goRuntime: {
    goroutines: number;
    heapAlloc: number;
    heapSys: number;
    heapIdle: number;
    heapInuse: number;
    stackInuse: number;
    numGC: number;
  };
  current: MonitorSample;
};

export type ServerMonitorResult = {
  snapshot: ServerMonitorSnapshot;
  history: MonitorSample[];
};

export type LoginLogRow = {
  id: number;
  username: string;
  ip: string;
  status: number;
  behavior: string;
  loginTime: string;
};

export type OperationLogRow = {
  id: number;
  username: string;
  module: string;
  summary: string;
  ip: string;
  status: number;
  operatingTime: string;
};

export type SystemLogRow = {
  id: number;
  category: string;
  username: string;
  module: string;
  url: string;
  method: string;
  ip: string;
  status: number;
  action: string;
  message: string;
  takesTime: number;
  requestTime: string;
};

export type SystemLogDetail = SystemLogRow & {
  requestHeaders: Record<string, any>;
  requestBody: any;
  responseHeaders: Record<string, any>;
  responseBody: any;
};

export type LogListParams = {
  pageNum: number;
  pageSize: number;
  username?: string;
  module?: string;
  ip?: string;
  status?: string | number;
  startTime?: string;
  endTime?: string;
};

/** 获取系统管理-用户管理列表 */
export const getUserList = (params?: object) => {
  return http.request<ResultTable>("get", baseUrlApi("user"), {
    params
  });
};

/** 系统管理-用户管理-获取所有角色列表 */
export const getAllRoleList = () => {
  return http.request<Result>("get", "/list-all-role");
};

/** 系统管理-用户管理-根据userId，获取对应角色id列表 */
export const getRoleIds = (data?: object) => {
  return http.request<Result>("post", "/list-role-ids", { data });
};

/** 获取系统管理-角色管理列表 */
export const getRoleList = (data?: object) => {
  return http.request<ResultTable>("post", "/role", { data });
};

/** 获取系统管理-菜单管理列表 */
export const getMenuList = (data?: object) => {
  return http.request<Result>("get", baseUrlApi("menu/all"), { params: data });
};

export const createMenu = (data?: object) => {
  return http.request<Result>("post", baseUrlApi("menu"), { data });
};

export const updateMenu = (id: number | string, data?: object) => {
  return http.request<Result>("put", baseUrlApi(`menu/${id}`), { data });
};

export const deleteMenu = (id: number | string) => {
  return http.request<Result>("delete", baseUrlApi(`menu/${id}`));
};

/** 获取系统监控-在线用户列表 */
export const getOnlineUserList = (params: OnlineUserListParams) => {
  return http.request<ResultTable<OnlineUserRow>>(
    "get",
    baseUrlApi("sys/online-users"),
    { params }
  );
};

export const forceOfflineUser = (
  userId: number | string,
  sessionId: string
) => {
  return http.request<Result>(
    "delete",
    baseUrlApi(`sys/online-users/${userId}`),
    {
      params: { sessionId }
    }
  );
};

/** 获取系统监控-服务器监控详情 */
export const getServerMonitor = () => {
  return http.request<Result<ServerMonitorResult>>(
    "get",
    baseUrlApi("sys/server-monitor")
  );
};

/** 获取系统监控-登录日志列表 */
export const getLoginLogsList = (params: LogListParams) => {
  return http.request<ResultTable<LoginLogRow>>(
    "get",
    baseUrlApi("sys/login-logs"),
    { params }
  );
};

export const deleteLoginLogs = (ids?: Array<number>) => {
  return http.request<Result>("delete", baseUrlApi("sys/login-logs"), {
    params: ids?.length ? { ids } : undefined
  });
};

/** 获取系统监控-操作日志列表 */
export const getOperationLogsList = (params: LogListParams) => {
  return http.request<ResultTable<OperationLogRow>>(
    "get",
    baseUrlApi("sys/operation-logs"),
    { params }
  );
};

export const deleteOperationLogs = (ids?: Array<number>) => {
  return http.request<Result>("delete", baseUrlApi("sys/operation-logs"), {
    params: ids?.length ? { ids } : undefined
  });
};

/** 获取系统监控-系统日志列表 */
export const getSystemLogsList = (params: LogListParams) => {
  return http.request<ResultTable<SystemLogRow>>(
    "get",
    baseUrlApi("sys/system-logs"),
    { params }
  );
};

/** 获取系统监控-系统日志-根据 id 查日志详情 */
export const getSystemLogsDetail = (id: number | string) => {
  return http.request<Result<SystemLogDetail>>(
    "get",
    baseUrlApi(`sys/system-logs/${id}`)
  );
};

export const deleteSystemLogs = (ids?: Array<number>) => {
  return http.request<Result>("delete", baseUrlApi("sys/system-logs"), {
    params: ids?.length ? { ids } : undefined
  });
};

/** 获取角色管理-权限-菜单权限 */
export const getRoleMenu = (data?: object) => {
  return http.request<Result>("post", "/role-menu", { data });
};

/** 获取角色管理-权限-菜单权限-根据角色 id 查对应菜单 */
export const getRoleMenuIds = (data?: object) => {
  return http.request<Result>("post", "/role-menu-ids", { data });
};
