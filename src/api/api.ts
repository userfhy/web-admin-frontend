import { http } from "@/utils/http";

export type ApiRow = {
  id: number;
  path: string;
  description: string;
  apiGroup: string;
  method: string;
  createTime?: string;
  updateTime?: string;
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

export type ApiListParams = {
  currentPage: number;
  pageSize: number;
  path?: string;
  description?: string;
  apiGroup?: string;
  method?: string;
};

export const getApiList = (params: ApiListParams) => {
  return http.request<ResultTable<ApiRow>>("get", "/api/api", { params });
};
