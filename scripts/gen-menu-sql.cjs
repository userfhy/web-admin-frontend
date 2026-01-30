const fs = require("fs");
const path = require("path");

const FRONTEND_ROOT = process.cwd();
const OUT_FILE = "/home/fhy/mygo/gin-web-admin/sql/import_routes_menus.sql";

function stripComments(s) {
  // block comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, "");
  // line comments
  s = s.replace(/(^|\n)\s*\/\/.*(?=\n|$)/g, "$1");
  return s;
}

function parseEnums() {
  const enumsFile = path.join(FRONTEND_ROOT, "src/router/enums.ts");
  const s = fs.readFileSync(enumsFile, "utf8");
  const m = {};

  // 解析类似：const home = 0, chatai = 1, ...; 这种同一行多变量声明
  const reg = /\b([a-zA-Z_][\w]*)\s*=\s*(\d+)\b/g;
  let match;
  while ((match = reg.exec(s)) !== null) {
    m[match[1]] = parseInt(match[2], 10);
  }

  return m;
}

const enums = parseEnums();

function preprocessTsToJsObjectLiteral(s) {
  s = stripComments(s);

  // $t("menus.xxx") -> "menus.xxx"
  s = s.replace(/\$t\(([^)]+)\)/g, "$1");

  // () => import('...') -> null
  s = s.replace(/\(\)\s*=>\s*import\([^)]*\)/g, "null");

  // common identifiers -> replace to avoid ReferenceError during eval
  s = s.replace(/\bLayout\b/g, "null");
  s = s.replace(/\bIFrame\b/g, "null");
  // env vars used in route modules
  s = s.replace(/\bVITE_HIDE_HOME\b/g, '"false"');

  // remove TypeScript `satisfies Xxx` (not valid JS)
  s = s.replace(/\s+satisfies\s+[A-Za-z_][\w\.<>,\s\[\]]*\s*;?/g, "");

  // replace rank constants from enums.ts (incl. home)
  s = s.replace(/\b([a-zA-Z_][\w]*)\b/g, (full, ident) => {
    if (Object.prototype.hasOwnProperty.call(enums, ident)) {
      return String(enums[ident]);
    }
    return full;
  });

  return s;
}

function extractExportDefaultExpr(file) {
  let s = fs.readFileSync(file, "utf8");
  s = preprocessTsToJsObjectLiteral(s);
  const idx = s.indexOf("export default");
  if (idx < 0) throw new Error("No export default in " + file);
  return s.slice(idx + "export default".length).trim();
}

function safeEval(expr) {
  // eslint-disable-next-line no-new-func
  return Function("return (" + expr + ");")();
}

function walkDir(dir, cb) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(p, cb);
    else cb(p);
  }
}

function loadRouteModules() {
  const modDir = path.join(FRONTEND_ROOT, "src/router/modules");
  const moduleFiles = [];
  walkDir(modDir, p => {
    if (p.endsWith(".ts") && !p.endsWith("remaining.ts")) moduleFiles.push(p);
  });

  const roots = [];
  for (const f of moduleFiles) {
    const expr = extractExportDefaultExpr(f);
    const obj = safeEval(expr);
    if (Array.isArray(obj)) roots.push(...obj);
    else roots.push(obj);
  }

  // remaining.ts is an array
  const remainingFile = path.join(modDir, "remaining.ts");
  const remainingExpr = extractExportDefaultExpr(remainingFile);
  const remainingObj = safeEval(remainingExpr);
  if (Array.isArray(remainingObj)) roots.push(...remainingObj);

  // flatten nested arrays that might exist
  return roots.flat(Infinity);
}

function escSql(v) {
  if (v === null || v === undefined) return "NULL";
  return (
    "'" +
    String(v)
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "''") +
    "'"
  );
}

function normShowLink(v) {
  return v === false ? 0 : 1;
}

function normBool(v) {
  return v ? 1 : 0;
}

function menuType(node) {
  // 0 directory if has children else 1 menu
  return node && Array.isArray(node.children) && node.children.length ? 0 : 1;
}

function buildRows(routeRoots) {
  let id = 0;
  const rows = [];

  function addNode(node, parentId) {
    if (!node || typeof node !== "object") return;

    id += 1;
    const curId = id;
    const meta = node.meta || {};

    rows.push({
      id: curId,
      parent_id: parentId,
      menu_type: menuType(node),
      title: meta.title ?? "",
      name: node.name ?? "",
      path: node.path ?? "",
      component: typeof node.component === "string" ? node.component : null,
      rank: Number(meta.rank ?? 0) || 0,
      icon: typeof meta.icon === "string" ? meta.icon : "",
      auths: typeof meta.auths === "string" ? meta.auths : "",
      frame_src: typeof meta.frameSrc === "string" ? meta.frameSrc : "",
      keep_alive: normBool(meta.keepAlive),
      show_link: normShowLink(meta.showLink),
      active_path: typeof meta.activePath === "string" ? meta.activePath : ""
    });

    if (Array.isArray(node.children)) {
      for (const c of node.children) addNode(c, curId);
    }
  }

  for (const r of routeRoots) addNode(r, 0);
  return rows;
}

function generateSql(rows) {
  let sql = "-- Auto-generated from src/router constantMenus (modules + remaining)\n";
  sql += "-- Execute this file in your database to import the menu structure.\n\n";

  sql += "DELETE FROM `gin_menu`;\n";
  sql += "ALTER TABLE `gin_menu` AUTO_INCREMENT = 1;\n\n";

  sql +=
    "INSERT INTO `gin_menu` (`id`,`parent_id`,`menu_type`,`title`,`name`,`path`,`component`,`rank`,`icon`,`auths`,`frame_src`,`keep_alive`,`show_link`,`active_path`) VALUES\n";

  sql +=
    rows
      .map(
        r =>
          `(${r.id}, ${r.parent_id}, ${r.menu_type}, ${escSql(r.title)}, ${escSql(
            r.name
          )}, ${escSql(r.path)}, ${r.component === null ? "NULL" : escSql(r.component)
          }, ${r.rank}, ${escSql(r.icon)}, ${escSql(r.auths)}, ${escSql(
            r.frame_src
          )}, ${r.keep_alive}, ${r.show_link}, ${escSql(r.active_path)})`
      )
      .join(",\n");

  sql += ";\n";
  return sql;
}

function main() {
  const roots = loadRouteModules();
  const rows = buildRows(roots);
  const sql = generateSql(rows);
  fs.writeFileSync(OUT_FILE, sql, "utf8");
  console.log("Generated:", OUT_FILE);
  console.log("Rows:", rows.length);
}

main();
