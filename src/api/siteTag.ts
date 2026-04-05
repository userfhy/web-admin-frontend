import { http } from "@/utils/http";

export type SiteTagRow = {
  id: number;
  name: string;
  slug: string;
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

export const getSiteTagList = (params: {
  pageNum: number;
  pageSize: number;
  keyword?: string;
  status?: number | "";
}) => {
  return http.request<
    Result<{
      list: SiteTagRow[];
      total: number;
      currentPage: number;
      pageSize: number;
    }>
  >("get", "/api/site-tag", { params });
};

export const getAllSiteTags = (params?: { status?: number }) => {
  return http.request<Result<SiteTagRow[]>>("get", "/api/site-tag/all", {
    params
  });
};

export const createSiteTag = (data: {
  name: string;
  slug: string;
  status: number;
  sort: number;
}) => {
  return http.request<Result>("post", "/api/site-tag", { data });
};

export const updateSiteTag = (
  id: number | string,
  data: {
    name: string;
    slug: string;
    status: number;
    sort: number;
  }
) => {
  return http.request<Result>("put", `/api/site-tag/${id}`, { data });
};

export const deleteSiteTag = (id: number | string) => {
  return http.request<Result>("delete", `/api/site-tag/${id}`);
};
