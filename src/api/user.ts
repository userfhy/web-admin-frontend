import { http } from "@/utils/http";
import { baseUrlApi } from "./utils";

export type UserResult = {
  /** 业务状态码（后端返回 200 表示成功） */
  code: number;
  /** 是否成功 */
  success: boolean;
  msg: string;
  data: {
    /** `token` */
    accessToken: string;
    /** 兼容后端多返回一个 token 字段（可选） */
    token?: string;
    /** 用于调用刷新`accessToken`的接口时所需的`token` */
    refreshToken: string;
    /** `accessToken`的过期时间（格式'xxxx/xx/xx xx:xx:xx'） */
    expires: Date | string;
    /** 用户名 */
    username: string;
    /** 昵称 */
    nickname: string;
    /** 当前登录用户的角色 */
    roles: Array<string>;
  };
};

export type RefreshTokenResult = {
  code: number;
  message: string;
  success: boolean;
  msg: string;
  data: {
    /** `token` */
    accessToken: string;
    /** 用于调用刷新`accessToken`的接口时所需的`token` */
    refreshToken: string;
    /** `accessToken`的过期时间（格式'xxxx/xx/xx xx:xx:xx'） */
    expires: Date;
  };
};

export type UserInfo = {
  /** 头像 */
  avatar: string;
  /** 用户名 */
  username: string;
  /** 昵称 */
  nickname: string;
  /** 邮箱 */
  email: string;
  /** 联系电话 */
  phone: string;
  /** 简介 */
  description: string;
};

export type UserInfoResult = {
  code: number;
  message: string;
  data: UserInfo;
};

type ResultTable = {
  code: number;
  message: string;
  data?: {
    /** 列表数据 */
    list: Array<any>;
    /** 总条目数 */
    total?: number;
    /** 每页显示条目个数 */
    pageSize?: number;
    /** 当前页数 */
    currentPage?: number;
  };
};

/** 登录 */
export const getLogin = (data?: object) => {
  // return http.request<UserResult>("post", "/login", { data });
  return http.request<UserResult>("post", baseUrlApi("login"), { data });
};

/** 刷新`token` */
export const refreshTokenApi = (data?: object) => {
  // return http.request<RefreshTokenResult>("post", "/refresh-token", { data });
  return http.request<RefreshTokenResult>("post", baseUrlApi("refresh_token"), {
    data
  });
};

/** 账户设置-个人信息 */
export const getMine = (data?: object) => {
  return http.request<UserInfoResult>("get", "/mine", { data });
};

/** 账户设置-个人安全日志 */
export const getMineLogs = (data?: object) => {
  return http.request<ResultTable>("get", "/mine-logs", { data });
};

/** 退出登录 */
export const logOutApi = (data?: object) => {
  return http.request("put", baseUrlApi("user/logout"), { data });
};
