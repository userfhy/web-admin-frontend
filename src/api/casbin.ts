import { http } from "@/utils/http";

type Result<T = any> = {
  code: number;
  success?: boolean;
  msg?: string;
  message?: string;
  data?: T;
};

type PageResult<T = any> = {
  list: Array<T>;
  total: number;
  pageSize: number;
};

export type CasbinRuleRow = {
  id: number;
  v0: string;
  v1: string;
  v2: string;
};

export const getCasbinList = (params: {
  p: number;
  n: number;
  role?: string;
  path?: string;
  method?: string;
}) => {
  return http.request<Result<PageResult<CasbinRuleRow>>>("get", "/api/casbin", {
    params
  });
};

export const createCasbin = (data: { v0: string; v1: string; v2: string }) => {
  return http.request<Result>("post", "/api/casbin", { data });
};

export const updateCasbin = (
  id: number | string,
  data: { v0: string; v1: string; v2: string }
) => {
  return http.request<Result>("put", `/api/casbin/${id}`, { data });
};

// 注意：后端 DeleteCasbin 实际上读取 body（v0/v1/v2），path 参数 id 并未使用
export const deleteCasbin = (
  id: number | string,
  data: { v0: string; v1: string; v2: string }
) => {
  return http.request<Result>("delete", `/api/casbin/${id}`, { data });
};
