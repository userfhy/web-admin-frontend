import { http } from "@/utils/http";

export type SiteContentRow = {
  id: number;
  categoryIds: number[];
  categoryNames: string[];
  tagIds: number[];
  tagNames: string[];
  title: string;
  slug: string;
  summary: string;
  cover: string;
  content: string;
  seoKeywords: string;
  seoDescription: string;
  status: number;
  publishedAt: string;
  sort: number;
  createdAt: string;
  updatedAt: string;
};

type Result<T = any> = {
  code: number;
  success?: boolean;
  msg?: string;
  data?: T;
};

export const getSiteContentList = (params: {
  pageNum: number;
  pageSize: number;
  keyword?: string;
  status?: number | "";
  categoryId?: number | "";
  tagId?: number | "";
}) => {
  return http.request<
    Result<{
      list: SiteContentRow[];
      total: number;
      currentPage: number;
      pageSize: number;
    }>
  >("get", "/api/site-content", { params });
};

export const getSiteContentDetail = (id: number | string) => {
  return http.request<Result<SiteContentRow>>("get", `/api/site-content/${id}`);
};

export const createSiteContent = (data: {
  categoryIds: number[];
  tagIds: number[];
  title: string;
  slug: string;
  summary: string;
  cover: string;
  content: string;
  seoKeywords: string;
  seoDescription: string;
  status: number;
  sort: number;
}) => {
  return http.request<Result>("post", "/api/site-content", { data });
};

export const updateSiteContent = (
  id: number | string,
  data: {
    categoryIds: number[];
    tagIds: number[];
    title: string;
    slug: string;
    summary: string;
    cover: string;
    content: string;
    seoKeywords: string;
    seoDescription: string;
    status: number;
    sort: number;
  }
) => {
  return http.request<Result>("put", `/api/site-content/${id}`, { data });
};

export const deleteSiteContent = (id: number | string) => {
  return http.request<Result>("delete", `/api/site-content/${id}`);
};

export const updateSiteContentStatus = (
  id: number | string,
  data: { status: number }
) => {
  return http.request<Result>("patch", `/api/site-content/${id}/status`, {
    data
  });
};
