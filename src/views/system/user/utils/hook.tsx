import "./reset.css";
// import dayjs from "dayjs";
import roleForm from "../form/role.vue";
import editForm from "../form/index.vue";
import { zxcvbn } from "@zxcvbn-ts/core";
import { message } from "@/utils/message";
import userAvatar from "@/assets/user.jpg";
import { usePublicHooks } from "../../hooks";
import { addDialog } from "@/components/ReDialog";
import type { PaginationProps } from "@pureadmin/table";
import ReCropperPreview from "@/components/ReCropperPreview";
import type { FormItemProps, RoleFormItemProps } from "../utils/types";
import { getKeyList, isAllEmpty, deviceDetection } from "@pureadmin/utils";
import {
  getRoleIds,
  getUserList,
  unlockUser,
  getAllRoleList,
  resetUserPassword,
  getUserSecurityTimeline
} from "@/api/system";
import type { UserSecurityEvent } from "@/api/system";
import { getDeptTree } from "@/api/dept";
import {
  ElForm,
  ElInput,
  ElFormItem,
  ElProgress,
  ElTimeline,
  ElTimelineItem,
  ElPagination,
  ElMessageBox
} from "element-plus";
import {
  type Ref,
  h,
  ref,
  toRaw,
  watch,
  computed,
  reactive,
  onMounted
} from "vue";

export function useUser(tableRef: Ref, treeRef: Ref) {
  const form = reactive({
    // 左侧部门树的id
    deptId: "",
    username: "",
    phone: "",
    status: "",
    p: 1,
    n: 10
  });
  const formRef = ref();
  const ruleFormRef = ref();
  const dataList = ref([]);
  const loading = ref(true);
  // 上传头像信息
  const avatarInfo = ref();
  const switchLoadMap = ref({});
  const { switchStyle } = usePublicHooks();
  const higherDeptOptions = ref();
  const treeData = ref([]);
  const treeLoading = ref(true);
  const selectedNum = ref(0);
  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 10,
    currentPage: 1,
    background: true
  });
  const columns: TableColumnList = [
    {
      label: "勾选列", // 如果需要表格多选，此处label必须设置
      type: "selection",
      fixed: "left",
      reserveSelection: true // 数据刷新后保留选项
    },
    {
      label: "用户编号",
      prop: "id",
      width: 90
    },
    // {
    //   label: "用户头像",
    //   prop: "avatar",
    //   cellRenderer: ({ row }) => (
    //     <el-image
    //       fit="cover"
    //       preview-teleported={true}
    //       src={row.avatar || userAvatar}
    //       preview-src-list={Array.of(row.avatar || userAvatar)}
    //       class="w-[24px] h-[24px] rounded-full align-middle"
    //     />
    //   ),
    //   width: 90
    // },
    {
      label: "用户名称",
      prop: "user_name",
      minWidth: 130
    },
    // {
    //   label: "用户昵称",
    //   prop: "nickname",
    //   minWidth: 130
    // },
    // {
    //   label: "性别",
    //   prop: "sex",
    //   minWidth: 90,
    //   cellRenderer: ({ row, props }) => (
    //     <el-tag
    //       size={props.size}
    //       type={row.sex === 1 ? "danger" : null}
    //       effect="plain"
    //     >
    //       {row.sex === 1 ? "女" : "男"}
    //     </el-tag>
    //   )
    // },
    // {
    //   label: "部门",
    //   prop: "dept.name",
    //   minWidth: 90
    // },
    // {
    //   label: "手机号码",
    //   prop: "phone",
    //   minWidth: 90,
    //   formatter: ({ phone }) => hideTextAtIndex(phone, { start: 3, end: 6 })
    // },
    {
      label: "状态",
      prop: "status",
      minWidth: 90,
      cellRenderer: scope => (
        <el-switch
          size={scope.props.size === "small" ? "small" : "default"}
          loading={switchLoadMap.value[scope.index]?.loading}
          v-model={scope.row.status}
          active-value={1}
          inactive-value={0}
          active-text="已启用"
          inactive-text="已停用"
          inline-prompt
          style={switchStyle.value}
          onChange={() => onChange(scope as any)}
        />
      )
    },
    {
      label: "创建时间",
      minWidth: 90,
      prop: "created_at"
    },
    {
      label: "登录时间",
      minWidth: 90,
      prop: "logged_in_at"
      // formatter: ({ createTime }) =>
      //   dayjs(createTime).format("YYYY-MM-DD HH:mm:ss")
    },
    {
      label: "登录安全",
      minWidth: 180,
      cellRenderer: ({ row }) => (
        <div class="flex flex-col items-center gap-1">
          <el-tag type={isLocked(row) ? "danger" : "success"} effect="plain">
            {isLocked(row) ? "已锁定" : "正常"}
          </el-tag>
          {row.locked_until ? (
            <span class="text-xs text-[var(--el-text-color-secondary)]">
              解锁：{row.locked_until}
            </span>
          ) : null}
          {row.failed_login_count ? (
            <span class="text-xs text-[var(--el-text-color-secondary)]">
              失败：{row.failed_login_count} 次
            </span>
          ) : null}
        </div>
      )
    },
    {
      label: "操作",
      fixed: "right",
      width: 180,
      slot: "operation"
    }
  ];
  const buttonClass = computed(() => {
    return [
      "h-[20px]!",
      "reset-margin",
      "text-gray-500!",
      "dark:text-white!",
      "dark:hover:text-primary!"
    ];
  });
  // 重置的新密码
  const pwdForm = reactive({
    newPwd: "",
    confirmPwd: ""
  });
  const pwdProgress = [
    { color: "#e74242", text: "非常弱" },
    { color: "#EFBD47", text: "弱" },
    { color: "#ffa500", text: "一般" },
    { color: "#1bbf1b", text: "强" },
    { color: "#008000", text: "非常强" }
  ];
  // 当前密码强度（0-4）
  const curScore = ref();
  const roleOptions = ref([]);
  const securityTimeline = reactive({
    loading: false,
    list: [] as UserSecurityEvent[],
    total: 0,
    pageNum: 1,
    pageSize: 5
  });

  function userDisplayName(row) {
    return row?.username || row?.user_name || row?.nickname || row?.id;
  }

  function isLocked(row) {
    if (!row?.locked_until) return false;
    return new Date(row.locked_until).getTime() > Date.now();
  }

  function resetPwdForm() {
    pwdForm.newPwd = "";
    pwdForm.confirmPwd = "";
  }

  function onChange({ row, index }) {
    ElMessageBox.confirm(
      `确认要<strong>${
        row.status === 0 ? "停用" : "启用"
      }</strong><strong style='color:var(--el-color-primary)'>${
        row.user_name
      }</strong>用户吗?`,
      "系统提示",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
        dangerouslyUseHTMLString: true,
        draggable: true
      }
    )
      .then(() => {
        switchLoadMap.value[index] = Object.assign(
          {},
          switchLoadMap.value[index],
          {
            loading: true
          }
        );
        setTimeout(() => {
          switchLoadMap.value[index] = Object.assign(
            {},
            switchLoadMap.value[index],
            {
              loading: false
            }
          );
          message("已成功修改用户状态", {
            type: "success"
          });
        }, 300);
      })
      .catch(() => {
        row.status === 0 ? (row.status = 1) : (row.status = 0);
      });
  }

  function handleUpdate(row) {
    console.log(row);
  }

  function handleDelete(row) {
    message(`您删除了用户编号为${row.id}的这条数据`, { type: "success" });
    onSearch();
  }

  function handleSizeChange(val: number) {
    pagination.pageSize = val;
    pagination.currentPage = 1;
    form.n = val;
    form.p = 1;
    onSearch();
  }

  function handleCurrentChange(val: number) {
    pagination.currentPage = val;
    form.p = val;
    onSearch();
  }

  /** 当CheckBox选择项发生变化时会触发该事件 */
  function handleSelectionChange(val) {
    selectedNum.value = val.length;
    // 重置表格高度
    tableRef.value.setAdaptive();
  }

  /** 取消选择 */
  function onSelectionCancel() {
    selectedNum.value = 0;
    // 用于多选表格，清空用户的选择
    tableRef.value.getTableRef().clearSelection();
  }

  /** 批量删除 */
  function onbatchDel() {
    // 返回当前选中的行
    const curSelected = tableRef.value.getTableRef().getSelectionRows();
    // 接下来根据实际业务，通过选中行的某项数据，比如下面的id，调用接口进行批量删除
    message(`已删除用户编号为 ${getKeyList(curSelected, "id")} 的数据`, {
      type: "success"
    });
    tableRef.value.getTableRef().clearSelection();
    onSearch();
  }

  async function onSearch() {
    loading.value = true;
    const res: any = await getUserList(toRaw(form));
    const ok = (res?.success && res?.code === 200) || res?.code === 0;
    const data = res?.data;
    if (ok && data) {
      dataList.value = data.list ?? [];
      pagination.total = data.total ?? 0;
      pagination.pageSize = data.pageSize ?? pagination.pageSize;
      // 后端 currentPage 可能返回 0，这里以前端为准
      // pagination.currentPage = data.currentPage ?? pagination.currentPage;
      form.n = pagination.pageSize;
      form.p = pagination.currentPage;
    } else {
      dataList.value = [];
      pagination.total = 0;
    }

    setTimeout(() => {
      loading.value = false;
    }, 500);
  }

  const resetForm = formEl => {
    if (!formEl) return;
    formEl.resetFields();
    form.deptId = "";
    treeRef.value.onTreeReset();
    onSearch();
  };

  function onTreeSelect({ id, selected }) {
    form.deptId = selected ? id : "";
    onSearch();
  }

  function formatHigherDeptOptions(treeList) {
    // 根据返回数据的status字段值判断追加是否禁用disabled字段，返回处理后的树结构，用于上级部门级联选择器的展示（实际开发中也是如此，不可能前端需要的每个字段后端都会返回，这时需要前端自行根据后端返回的某些字段做逻辑处理）
    if (!treeList || !treeList.length) return;
    const newTreeList = [];
    for (let i = 0; i < treeList.length; i++) {
      treeList[i].disabled = treeList[i].status === 0 ? true : false;
      formatHigherDeptOptions(treeList[i].children);
      newTreeList.push(treeList[i]);
    }
    return newTreeList;
  }

  function openDialog(title = "新增", row?: FormItemProps) {
    addDialog({
      title: `${title}用户`,
      props: {
        formInline: {
          title,
          higherDeptOptions: formatHigherDeptOptions(higherDeptOptions.value),
          // parentId: row?.dept.id ?? 0,
          nickname: row?.nickname ?? "",
          username: row?.username ?? "",
          password: row?.password ?? "",
          phone: row?.phone ?? "",
          email: row?.email ?? "",
          sex: row?.sex ?? "",
          status: row?.status ?? 1,
          remark: row?.remark ?? ""
        }
      },
      width: "46%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(editForm, { ref: formRef, formInline: null }),
      beforeSure: (done, { options }) => {
        const FormRef = formRef.value.getRef();
        const curData = options.props.formInline as FormItemProps;
        function chores() {
          message(`您${title}了用户名称为${curData.username}的这条数据`, {
            type: "success"
          });
          done(); // 关闭弹框
          onSearch(); // 刷新表格数据
        }
        FormRef.validate(valid => {
          if (valid) {
            console.log("curData", curData);
            // 表单规则校验通过
            if (title === "新增") {
              // 实际开发先调用新增接口，再进行下面操作
              chores();
            } else {
              // 实际开发先调用修改接口，再进行下面操作
              chores();
            }
          }
        });
      }
    });
  }

  const cropRef = ref();
  /** 上传头像 */
  function handleUpload(row) {
    addDialog({
      title: "裁剪、上传头像",
      width: "40%",
      closeOnClickModal: false,
      fullscreen: deviceDetection(),
      contentRenderer: () =>
        h(ReCropperPreview, {
          ref: cropRef,
          imgSrc: row.avatar || userAvatar,
          onCropper: info => (avatarInfo.value = info)
        }),
      beforeSure: done => {
        console.log("裁剪后的图片信息：", avatarInfo.value);
        // 根据实际业务使用avatarInfo.value和row里的某些字段去调用上传头像接口即可
        done(); // 关闭弹框
        onSearch(); // 刷新表格数据
      },
      closeCallBack: () => cropRef.value.hidePopover()
    });
  }

  watch(
    pwdForm,
    ({ newPwd }) =>
      (curScore.value = isAllEmpty(newPwd) ? -1 : zxcvbn(newPwd).score)
  );

  /** 重置密码 */
  function handleReset(row) {
    addDialog({
      title: `重置 ${userDisplayName(row)} 用户的密码`,
      width: "30%",
      draggable: true,
      closeOnClickModal: false,
      fullscreen: deviceDetection(),
      contentRenderer: () => (
        <>
          <ElForm ref={ruleFormRef} model={pwdForm}>
            <ElFormItem
              prop="newPwd"
              rules={[
                {
                  required: true,
                  message: "请输入新密码",
                  trigger: "blur"
                }
              ]}
            >
              <ElInput
                clearable
                show-password
                type="password"
                v-model={pwdForm.newPwd}
                placeholder="请输入新密码"
              />
            </ElFormItem>
            <ElFormItem
              prop="confirmPwd"
              rules={[
                {
                  required: true,
                  message: "请再次输入新密码",
                  trigger: "blur"
                },
                {
                  validator: (_rule, value, callback) => {
                    if (value !== pwdForm.newPwd) {
                      callback(new Error("两次输入的密码不一致"));
                      return;
                    }
                    callback();
                  },
                  trigger: "blur"
                }
              ]}
            >
              <ElInput
                clearable
                show-password
                type="password"
                v-model={pwdForm.confirmPwd}
                placeholder="请再次输入新密码"
              />
            </ElFormItem>
          </ElForm>
          <div class="my-4 flex">
            {pwdProgress.map(({ color, text }, idx) => (
              <div
                class="w-[19vw]"
                style={{ marginLeft: idx !== 0 ? "4px" : 0 }}
              >
                <ElProgress
                  striped
                  striped-flow
                  duration={curScore.value === idx ? 6 : 0}
                  percentage={curScore.value >= idx ? 100 : 0}
                  color={color}
                  stroke-width={10}
                  show-text={false}
                />
                <p
                  class="text-center"
                  style={{ color: curScore.value === idx ? color : "" }}
                >
                  {text}
                </p>
              </div>
            ))}
          </div>
        </>
      ),
      closeCallBack: resetPwdForm,
      beforeSure: done => {
        ruleFormRef.value.validate(async valid => {
          if (valid) {
            const res: any = await resetUserPassword(row.id, pwdForm.newPwd);
            if (res?.code === 200 || res?.code === 0) {
              message(
                `已成功重置 ${userDisplayName(row)} 用户的密码，并强制下线全部会话`,
                { type: "success" }
              );
              done();
              resetPwdForm();
              onSearch();
            } else {
              message(res?.msg || res?.message || "重置密码失败", {
                type: "error"
              });
            }
          }
        });
      }
    });
  }

  async function handleUnlock(row) {
    const res: any = await unlockUser(row.id);
    if (res?.code === 200 || res?.code === 0) {
      message(`已解锁 ${userDisplayName(row)} 用户`, { type: "success" });
      onSearch();
    } else {
      message(res?.msg || res?.message || "解锁失败", { type: "error" });
    }
  }

  async function handleSecurityTimeline(row) {
    securityTimeline.pageNum = 1;
    await loadSecurityTimeline(row.id);
    addDialog({
      title: `${userDisplayName(row)} 最近安全事件`,
      width: "520px",
      draggable: true,
      fullscreen: deviceDetection(),
      closeOnClickModal: true,
      hideFooter: true,
      contentRenderer: () => (
        <div v-loading={securityTimeline.loading}>
          {securityTimeline.list.length ? (
            <ElTimeline>
              {securityTimeline.list.map(item => (
                <ElTimelineItem
                  key={item.id}
                  timestamp={item.createdAt}
                  type={securityEventType(item)}
                >
                  <div class="text-sm font-medium">
                    {securityEventTitle(item)}
                  </div>
                  <div class="mt-1 text-xs text-[var(--el-text-color-secondary)]">
                    {item.message || "-"}
                  </div>
                  <div class="mt-1 text-xs text-[var(--el-text-color-secondary)]">
                    IP：{item.ip || "-"}
                  </div>
                </ElTimelineItem>
              ))}
            </ElTimeline>
          ) : (
            <el-empty description="暂无安全事件" />
          )}
          <div class="mt-3 flex justify-end">
            <ElPagination
              small
              background
              layout="prev, pager, next"
              total={securityTimeline.total}
              page-size={securityTimeline.pageSize}
              current-page={securityTimeline.pageNum}
              onCurrentChange={page => {
                securityTimeline.pageNum = page;
                loadSecurityTimeline(row.id);
              }}
            />
          </div>
        </div>
      )
    });
  }

  async function loadSecurityTimeline(userId: number | string) {
    securityTimeline.loading = true;
    try {
      const res = await getUserSecurityTimeline(userId, {
        pageNum: securityTimeline.pageNum,
        pageSize: securityTimeline.pageSize
      });
      securityTimeline.list = res?.data?.list ?? [];
      securityTimeline.total = res?.data?.total ?? 0;
      securityTimeline.pageSize =
        res?.data?.pageSize ?? securityTimeline.pageSize;
      securityTimeline.pageNum =
        res?.data?.currentPage ?? securityTimeline.pageNum;
    } finally {
      securityTimeline.loading = false;
    }
  }

  function securityEventTitle(item: UserSecurityEvent) {
    const actionMap = {
      login: "登录",
      account_locked: "登录失败锁定",
      account_unlocked: "账号解锁",
      password_changed: "修改密码",
      password_reset: "重置密码",
      force_offline: "强制下线"
    };
    return actionMap[item.action] || item.action || item.category;
  }

  function securityEventType(item: UserSecurityEvent) {
    return item.status >= 200 && item.status < 400 ? "success" : "danger";
  }

  /** 分配角色 */
  async function handleRole(row) {
    // 选中的角色列表
    const ids = (await getRoleIds({ userId: row.id })).data ?? [];
    addDialog({
      title: `分配 ${row.username} 用户的角色`,
      props: {
        formInline: {
          username: row?.username ?? "",
          nickname: row?.nickname ?? "",
          roleOptions: roleOptions.value ?? [],
          ids
        }
      },
      width: "400px",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(roleForm),
      beforeSure: (done, { options }) => {
        const curData = options.props.formInline as RoleFormItemProps;
        console.log("curIds", curData.ids);
        // 根据实际业务使用curData.ids和row里的某些字段去调用修改角色接口即可
        done(); // 关闭弹框
      }
    });
  }

  onMounted(async () => {
    treeLoading.value = true;
    onSearch();

    // 归属部门（真实数据：/api/dept?tree=1）
    const deptRes: any = await getDeptTree();
    const deptOk =
      (deptRes?.success && deptRes?.code === 200) || deptRes?.code === 0;
    if (deptOk) {
      // 直接使用后端树结构
      higherDeptOptions.value = deptRes?.data ?? [];
      treeData.value = deptRes?.data ?? [];
    }
    treeLoading.value = false;

    // 角色列表
    roleOptions.value = (await getAllRoleList()).data ?? [];
  });

  return {
    form,
    loading,
    columns,
    dataList,
    treeData,
    treeLoading,
    selectedNum,
    pagination,
    buttonClass,
    deviceDetection,
    onSearch,
    resetForm,
    onbatchDel,
    openDialog,
    onTreeSelect,
    handleUpdate,
    handleDelete,
    handleUpload,
    handleReset,
    handleUnlock,
    handleRole,
    handleSecurityTimeline,
    handleSizeChange,
    onSelectionCancel,
    handleCurrentChange,
    handleSelectionChange
  };
}
