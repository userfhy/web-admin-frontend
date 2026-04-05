import "vxe-table/lib/style.css";
// import "xe-utils";
// import XEUtils from "xe-utils";
import type { App } from "vue";
// import { i18n } from "@/plugins/i18n";
// import zh from "vxe-table/lib/locale/lang/zh-CN";
// import en from "vxe-table/lib/locale/lang/en-US";

import VxeUITable, { VXETable } from "vxe-table";

// 全局默认参数
VXETable.setConfig({
  // i18n: (key, args) => {
  //   return unref(i18n.global.locale) === "zh"
  //     ? XEUtils.toFormatString(XEUtils.get(zh, key), args)
  //     : XEUtils.toFormatString(XEUtils.get(en, key), args);
  // },
  // translate(key) {
  //   const NAMESPACED = ["el.", "buttons."];
  //   if (key && NAMESPACED.findIndex(v => key.includes(v)) !== -1) {
  //     return i18n.global.t.call(i18n.global.locale, key);
  //   }
  //   return key;
  // }
});

export function useVxeTable(app: App) {
  app.use(VxeUITable);
}
