import { http } from "@/utils/http";

export type DeptRow = {
  id: number;
  parentId: number;
  deptName: string;
  orderNum: number;
  leader: string;
  phone: string;
  email: string;
  status: number;
  remark: string;
  children?: DeptRow[];
};

type Result<T = any> = {
  code: number;
  success?: boolean;
  msg?: string;
  message?: string;
  data?: T;
};

export const getDeptTree = () => {
  return http.request<Result<DeptRow[]>>("get", "/api/dept", {
    params: { tree: 1 }
  });
};

export const getDeptList = () => {
  return http.request<Result<DeptRow[]>>("get", "/api/dept");
};

export const createDept = (data: {
  parentId: number;
  deptName: string;
  orderNum: number;
  leader: string;
  phone: string;
  email: string;
  status: number;
  remark: string;
}) => {
  return http.request<Result>("post", "/api/dept", { data });
};

export const updateDept = (
  id: number | string,
  data: {
    parentId: number;
    deptName: string;
    orderNum: number;
    leader: string;
    phone: string;
    email: string;
    status: number;
    remark: string;
  }
) => {
  return http.request<Result>("put", `/api/dept/${id}`, { data });
};

export const deleteDept = (id: number | string) => {
  return http.request<Result>("delete", `/api/dept/${id}`);
};
