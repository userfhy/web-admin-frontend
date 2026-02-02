import { defineStore } from "pinia";
import {
  type userType,
  store,
  router,
  resetRouter,
  routerArrays,
  storageLocal
} from "../utils";
import {
  type UserResult,
  type RefreshTokenResult,
  getLogin,
  refreshTokenApi,
  logOutApi
} from "@/api/user";
import { useMultiTagsStoreHook } from "./multiTags";
import {
  type DataInfo,
  setToken,
  removeToken,
  userKey,
  getToken
} from "@/utils/auth";

export const useUserStore = defineStore("pure-user", {
  state: (): userType => ({
    // 头像
    avatar: storageLocal().getItem<DataInfo<number>>(userKey)?.avatar ?? "",
    // 用户名
    username: storageLocal().getItem<DataInfo<number>>(userKey)?.username ?? "",
    // 昵称
    nickname: storageLocal().getItem<DataInfo<number>>(userKey)?.nickname ?? "",
    // 页面级别权限
    roles: storageLocal().getItem<DataInfo<number>>(userKey)?.roles ?? [],
    // 按钮级别权限
    permissions:
      storageLocal().getItem<DataInfo<number>>(userKey)?.permissions ?? [],
    // 前端生成的验证码（按实际需求替换）
    verifyCode: "",
    // 判断登录页面显示哪个组件（0：登录（默认）、1：手机登录、2：二维码登录、3：注册、4：忘记密码）
    currentPage: 0,
    // 是否勾选了登录页的免登录
    isRemembered: false,
    // 登录页的免登录存储几天，默认7天
    loginDay: 7
  }),
  actions: {
    /** 存储头像 */
    SET_AVATAR(avatar: string) {
      this.avatar = avatar;
    },
    /** 存储用户名 */
    SET_USERNAME(username: string) {
      this.username = username;
    },
    /** 存储昵称 */
    SET_NICKNAME(nickname: string) {
      this.nickname = nickname;
    },
    /** 存储角色 */
    SET_ROLES(roles: Array<string>) {
      this.roles = roles;
    },
    /** 存储按钮级别权限 */
    SET_PERMS(permissions: Array<string>) {
      this.permissions = permissions;
    },
    /** 存储前端生成的验证码 */
    SET_VERIFYCODE(verifyCode: string) {
      this.verifyCode = verifyCode;
    },
    /** 存储登录页面显示哪个组件 */
    SET_CURRENTPAGE(value: number) {
      this.currentPage = value;
    },
    /** 存储是否勾选了登录页的免登录 */
    SET_ISREMEMBERED(bool: boolean) {
      this.isRemembered = bool;
    },
    /** 设置登录页的免登录存储几天 */
    SET_LOGINDAY(value: number) {
      this.loginDay = Number(value);
    },
    /** 登入 */
    async loginByUsername(data) {
      return new Promise<UserResult>((resolve, reject) => {
        getLogin(data)
          .then(data => {
            // 后端返回：{ success: true, code: 200, msg: '用户登录成功', data: {...} }
            if ((data as any).success && data.code === 200) {
              setToken(data.data as any);
              resolve(data as UserResult);
            } else {
              reject((data as any).msg || (data as any).message || "登录失败");
            }
          })
          .catch(error => {
            reject(error);
          });
      });
    },
    /** 前端登出（不调用接口） */
    logOut() {
      this.username = "";
      this.roles = [];
      this.permissions = [];
      removeToken();
      useMultiTagsStoreHook().handleTags("equal", [...routerArrays]);
      resetRouter();
      router.push("/login");
    },
    logOutWithAPi() {
      new Promise((resolve, reject) => {
        logOutApi()
          .then(data => {
            if (data) {
              this.logOut();
              resolve(data);
            }
          })
          .catch(error => {
            reject(error);
          });
      });
    },
    /** 刷新`token` */
    async handRefreshToken(data) {
      return new Promise<RefreshTokenResult>((resolve, reject) => {
        refreshTokenApi(data)
          .then((response: any) => {
            // 处理标准格式：{ code: 0, data: { accessToken, refreshToken, expires } }
            if (response && response.code === 0 && response.data) {
              setToken(response.data);
              resolve(response);
            }
            // 处理简单格式：{ refreshToken: "..." } 或 { accessToken: "...", refreshToken: "..." }
            else if (response && (response as any).refreshToken) {
              const currentToken = getToken();
              if (currentToken) {
                // 如果接口返回了新的 accessToken，使用新的；否则使用现有的
                const accessTokenValue =
                  (response as any).accessToken || currentToken.accessToken;
                const refreshTokenValue = (response as any).refreshToken;
                const tokenData: DataInfo<Date> = {
                  accessToken: accessTokenValue,
                  refreshToken: refreshTokenValue,
                  expires: new Date(currentToken.expires)
                };
                setToken(tokenData);
                // 构造符合 RefreshTokenResult 格式的响应
                resolve({
                  code: 0,
                  message: "刷新成功",
                  success: true,
                  msg: "刷新成功",
                  data: {
                    accessToken: accessTokenValue,
                    refreshToken: refreshTokenValue,
                    expires: new Date(currentToken.expires)
                  }
                } as RefreshTokenResult);
              } else {
                reject("无法获取当前 token 信息");
              }
            }
            // 处理其他可能的格式
            else if (response && response.data && response.data.accessToken) {
              setToken(response.data);
              resolve(response as RefreshTokenResult);
            } else {
              reject(response?.message || response?.msg || "刷新 token 失败");
            }
          })
          .catch(error => {
            reject(error);
          });
      });
    }
  }
});

export function useUserStoreHook() {
  return useUserStore(store);
}
