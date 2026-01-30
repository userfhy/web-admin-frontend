import { http } from "@/utils/http";

type Result<T = any> = {
  code: number;
  success?: boolean;
  msg?: string;
  message?: string;
  data?: T;
};

export type BackendRouteRow = {
  path: string;
  method: string;
};

export const getBackendRouterList = () => {
  return http.request<Result<BackendRouteRow[]>>("get", "/api/sys/router");
};
