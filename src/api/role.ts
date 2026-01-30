import { http } from "@/utils/http";

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

export type RoleRow = {
  role_id: number;
  role_name: string;
  role_key: string;
};

export const getRoleListForCasbin = (params: { p: number; n: number }) => {
  return http.request<ResultTable<RoleRow>>("get", "/api/role", { params });
};
