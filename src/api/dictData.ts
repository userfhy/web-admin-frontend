import { http } from "@/utils/http";
import { baseUrlApi } from "./utils";

export type DictDataRow = {
  id: number;
  dictType: string;
  label: string;
  value: string;
  status: number;
  sort: number;
  cssClass?: string;
  listClass?: string;
  isDefault: number;
  remark?: string;
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

export type DictDataListParams = {
  pageNum: number;
  pageSize: number;
  dictType?: string;
  label?: string;
  status?: number | "";
};

export const getDictDataList = (params: DictDataListParams) => {
  return http.request<ResultTable<DictDataRow>>(
    "get",
    baseUrlApi("dict/data"),
    {
      params
    }
  );
};

export const createDictData = (data: {
  dictType: string;
  label: string;
  value: string;
  status: number;
  sort: number;
  cssClass?: string;
  listClass?: string;
  isDefault: number;
  remark?: string;
}) => {
  return http.request<Result>("post", baseUrlApi("dict/data"), { data });
};

export const updateDictData = (
  id: number | string,
  data: {
    dictType: string;
    label: string;
    value: string;
    status: number;
    sort: number;
    cssClass?: string;
    listClass?: string;
    isDefault: number;
    remark?: string;
  }
) => {
  return http.request<Result>("put", baseUrlApi(`dict/data/${id}`), { data });
};

export const deleteDictData = (id: number | string) => {
  return http.request<Result>("delete", baseUrlApi(`dict/data/${id}`));
};
