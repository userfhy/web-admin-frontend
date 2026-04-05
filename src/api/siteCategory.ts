import { http } from "@/utils/http";

export type SiteCategoryRow = {
  id: number;
  name: string;
  slug: string;
  description: string;
  status: number;
  sort: number;
  contentCount: number;
  createdAt: string;
  updatedAt: string;
};

type Result<T = any> = {
  code: number;
  success?: boolean;
  msg?: string;
  data?: T;
};

export const getSiteCategoryList = (params: {
  pageNum: number;
  pageSize: number;
  keyword?: string;
  status?: number | "";
}) => {
  return http.request<
    Result<{
      list: SiteCategoryRow[];
      total: number;
      currentPage: number;
      pageSize: number;
    }>
  >("get", "/api/site-category", { params });
};

export const getAllSiteCategories = (params?: { status?: number }) => {
  return http.request<Result<SiteCategoryRow[]>>(
    "get",
    "/api/site-category/all",
    {
      params
    }
  );
};

export const createSiteCategory = (data: {
  name: string;
  slug: string;
  description: string;
  status: number;
  sort: number;
}) => {
  return http.request<Result>("post", "/api/site-category", { data });
};

export const updateSiteCategory = (
  id: number | string,
  data: {
    name: string;
    slug: string;
    description: string;
    status: number;
    sort: number;
  }
) => {
  return http.request<Result>("put", `/api/site-category/${id}`, { data });
};

export const deleteSiteCategory = (id: number | string) => {
  return http.request<Result>("delete", `/api/site-category/${id}`);
};
