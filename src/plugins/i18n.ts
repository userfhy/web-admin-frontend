// 多组件库的国际化和本地项目国际化兼容
import { type I18n, createI18n } from "vue-i18n";
import { unref, type App, type WritableComputedRef } from "vue";
import { responsiveStorageNameSpace } from "@/config";
import { storageLocal, isObject } from "@pureadmin/utils";

// element-plus国际化
import enLocale from "element-plus/es/locale/lang/en";
import zhLocale from "element-plus/es/locale/lang/zh-cn";
import enYaml from "/locales/en.yaml";
import zhCnYaml from "/locales/zh-CN.yaml";

const localeMap = {
  "zh-CN": zhCnYaml,
  en: enYaml
};

const siphonI18n = (prefix = "zh-CN") => {
  return localeMap[prefix];
};

export const localesConfigs = {
  zh: {
    ...siphonI18n("zh-CN"),
    ...zhLocale
  },
  en: {
    ...siphonI18n("en"),
    ...enLocale
  }
};

/** 获取对象中所有嵌套对象的key键，并将它们用点号分割组成字符串 */
function getObjectKeys(obj) {
  const stack = [];
  const keys: Set<string> = new Set();

  stack.push({ obj, key: "" });

  while (stack.length > 0) {
    const { obj, key } = stack.pop();

    for (const k in obj) {
      const newKey = key ? `${key}.${k}` : k;

      if (obj[k] && isObject(obj[k])) {
        stack.push({ obj: obj[k], key: newKey });
      } else {
        keys.add(newKey);
      }
    }
  }

  return keys;
}

/** 将展开的key缓存 */
const keysCache: Map<string, Set<string>> = new Map();
const flatI18n = (prefix = "zh-CN") => {
  let cache = keysCache.get(prefix);
  if (!cache) {
    cache = getObjectKeys(siphonI18n(prefix));
    keysCache.set(prefix, cache);
  }
  return cache;
};

/**
 * 国际化转换工具函数（自动读取根目录locales文件夹下文件进行国际化匹配）
 * @param message message
 * @returns 转化后的message
 */
export function transformI18n(message: any = "") {
  if (!message) {
    return "";
  }

  // 处理存储动态路由的title,格式 {zh:"",en:""}
  if (typeof message === "object") {
    const locale: string | WritableComputedRef<string> | any =
      i18n.global.locale;
    return message[locale?.value];
  }

  if (typeof message !== "string") {
    return message;
  }

  const locale = unref(i18n.global.locale);
  const fallbackLocale = i18n.global.fallbackLocale;
  const fallback =
    typeof fallbackLocale === "string"
      ? fallbackLocale
      : Array.isArray(fallbackLocale)
        ? fallbackLocale[0]
        : "en";

  if (i18n.global.te(message, locale) || i18n.global.te(message, fallback)) {
    return i18n.global.t(message);
  }

  // 兼容开发时直接传入未嵌套的 key
  if (
    flatI18n("zh-CN").has(message) ||
    Object.hasOwn(siphonI18n("zh-CN"), message)
  ) {
    return i18n.global.t(message);
  }

  return message;
}

/** 此函数只是配合i18n Ally插件来进行国际化智能提示，并无实际意义（只对提示起作用），如果不需要国际化可删除 */
export const $t = (key: string) => key;

export const i18n: I18n = createI18n({
  legacy: false,
  locale:
    storageLocal().getItem<StorageConfigs>(
      `${responsiveStorageNameSpace()}locale`
    )?.locale ?? "zh",
  fallbackLocale: "en",
  messages: localesConfigs
});

export function useI18n(app: App) {
  app.use(i18n);
}
