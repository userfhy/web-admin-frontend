import { http } from "@/utils/http";

type Result<T = any> = {
  code: number;
  success?: boolean;
  msg?: string;
  message?: string;
  data?: T;
};

export const getRoleMenuIdsByRoleId = (roleId: number | string) => {
  return http.request<Result<number[]>>("get", `/api/role/${roleId}/menu_ids`);
};

export const saveRoleMenuIdsByRoleId = (
  roleId: number | string,
  menuIds: number[]
) => {
  return http.request<Result>("put", `/api/role/${roleId}/menu_ids`, {
    data: { menuIds }
  });
};
