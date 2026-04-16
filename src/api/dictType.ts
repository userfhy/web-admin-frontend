import { http } from "@/utils/http";
import { baseUrlApi } from "./utils";

export type DictTypeRow = {
  id: number;
  name: string;
  type: string;
  status: number;
  remark?: string;
  sort: number;
  createdAt?: string;
  updatedAt?: string;
};

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

export type DictTypeListParams = {
  pageNum: number;
  pageSize: number;
  name?: string;
  type?: string;
  status?: number | "";
};

export const getDictTypeList = (params: DictTypeListParams) => {
  return http.request<ResultTable<DictTypeRow>>(
    "get",
    baseUrlApi("dict/type"),
    {
      params
    }
  );
};

export const getAllDictTypes = (params?: { status?: number }) => {
  return http.request<Result<DictTypeRow[]>>(
    "get",
    baseUrlApi("dict/type/all"),
    {
      params
    }
  );
};

export const createDictType = (data: {
  name: string;
  type: string;
  status: number;
  sort: number;
  remark?: string;
}) => {
  return http.request<Result>("post", baseUrlApi("dict/type"), { data });
};

export const updateDictType = (
  id: number | string,
  data: {
    name: string;
    type: string;
    status: number;
    sort: number;
    remark?: string;
  }
) => {
  return http.request<Result>("put", baseUrlApi(`dict/type/${id}`), { data });
};

export const deleteDictType = (id: number | string) => {
  return http.request<Result>("delete", baseUrlApi(`dict/type/${id}`));
};
