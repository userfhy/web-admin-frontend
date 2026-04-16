import { h, onMounted, reactive, ref, toRaw } from "vue";
import type { PaginationProps } from "@pureadmin/table";
import { deviceDetection, isAllEmpty } from "@pureadmin/utils";
import { addDialog } from "@/components/ReDialog";
import { message } from "@/utils/message";
import type { DictDataFormItemProps, DictTypeFormItemProps } from "./types";
import type { DictDataRow } from "@/api/dictData";
import type { DictTypeRow } from "@/api/dictType";
import {
  createDictType,
  deleteDictType,
  getAllDictTypes,
  getDictTypeList,
  updateDictType
} from "@/api/dictType";
import {
  createDictData,
  deleteDictData,
  getDictDataList,
  updateDictData
} from "@/api/dictData";
import typeForm from "../form-type.vue";
import dataForm from "../form-data.vue";

function pickText(value: unknown): string | undefined {
  return isAllEmpty(value) ? undefined : String(value);
}

function resolveTagType(value?: string) {
  const supported = ["success", "info", "warning", "danger", "primary"];
  return supported.includes(String(value)) ? (value as any) : "info";
}

export function useDict() {
  const typeSearchForm = reactive({
    name: "",
    type: "",
    status: "" as number | ""
  });

  const dataSearchForm = reactive({
    label: "",
    status: "" as number | ""
  });

  const typeFormRef = ref();
  const dataFormRef = ref();
  const typeLoading = ref(true);
  const dataLoading = ref(false);
  const typeList = ref<DictTypeRow[]>([]);
  const dataList = ref<DictDataRow[]>([]);
  const currentDictType = ref<DictTypeRow>();

  const typePagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 10,
    currentPage: 1,
    background: true
  });

  const dataPagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 10,
    currentPage: 1,
    background: true
  });

  const typeColumns: TableColumnList = [
    { label: "字典名称", prop: "name", minWidth: 180 },
    { label: "字典类型", prop: "type", minWidth: 180 },
    {
      label: "状态",
      prop: "status",
      width: 90,
      cellRenderer: ({ row, props }) => (
        <el-tag size={props.size} type={row.status === 1 ? "success" : "info"}>
          {row.status === 1 ? "启用" : "停用"}
        </el-tag>
      )
    },
    { label: "排序", prop: "sort", width: 80 },
    { label: "备注", prop: "remark", minWidth: 180 },
    { label: "更新时间", prop: "updatedAt", minWidth: 170 },
    { label: "操作", fixed: "right", width: 160, slot: "typeOperation" }
  ];

  const dataColumns: TableColumnList = [
    { label: "字典标签", prop: "label", minWidth: 140 },
    { label: "字典键值", prop: "value", minWidth: 140 },
    {
      label: "回显样式",
      prop: "listClass",
      width: 110,
      cellRenderer: ({ row, props }) => (
        <el-tag size={props.size} type={resolveTagType(row.listClass)}>
          {row.listClass || "default"}
        </el-tag>
      )
    },
    {
      label: "默认",
      prop: "isDefault",
      width: 80,
      cellRenderer: ({ row, props }) => (
        <el-tag
          size={props.size}
          type={row.isDefault === 1 ? "success" : "info"}
        >
          {row.isDefault === 1 ? "是" : "否"}
        </el-tag>
      )
    },
    {
      label: "状态",
      prop: "status",
      width: 90,
      cellRenderer: ({ row, props }) => (
        <el-tag size={props.size} type={row.status === 1 ? "success" : "info"}>
          {row.status === 1 ? "启用" : "停用"}
        </el-tag>
      )
    },
    { label: "排序", prop: "sort", width: 80 },
    { label: "备注", prop: "remark", minWidth: 180 },
    { label: "更新时间", prop: "updatedAt", minWidth: 170 },
    { label: "操作", fixed: "right", width: 160, slot: "dataOperation" }
  ];

  async function loadTypeOptions() {
    const res = await getAllDictTypes({ status: 1 });
    const list = res?.data ?? [];
    return list.map(item => ({
      label: `${item.name}（${item.type}）`,
      value: item.type
    }));
  }

  async function onTypeSearch(preserveSelection = true) {
    typeLoading.value = true;
    try {
      const res = await getDictTypeList({
        pageNum: typePagination.currentPage,
        pageSize: typePagination.pageSize,
        name: pickText(typeSearchForm.name),
        type: pickText(typeSearchForm.type),
        status: typeSearchForm.status
      });
      const page = res?.data ?? {};
      const list = page.list ?? [];
      typeList.value = list;
      typePagination.total = page.total ?? 0;
      typePagination.pageSize = page.pageSize ?? typePagination.pageSize;
      typePagination.currentPage =
        page.currentPage ?? typePagination.currentPage;

      if (list.length === 0) {
        currentDictType.value = undefined;
        dataList.value = [];
        dataPagination.total = 0;
        return;
      }

      if (!preserveSelection) {
        currentDictType.value = list[0];
      } else {
        const matched = list.find(
          item => item.id === currentDictType.value?.id
        );
        currentDictType.value = matched ?? list[0];
      }

      await onDataSearch();
    } catch {
      typeList.value = [];
      currentDictType.value = undefined;
      dataList.value = [];
      typePagination.total = 0;
      message("获取字典类型失败", { type: "error" });
    } finally {
      typeLoading.value = false;
    }
  }

  async function onDataSearch() {
    if (!currentDictType.value?.type) {
      dataList.value = [];
      dataPagination.total = 0;
      return;
    }

    dataLoading.value = true;
    try {
      const res = await getDictDataList({
        pageNum: dataPagination.currentPage,
        pageSize: dataPagination.pageSize,
        dictType: currentDictType.value.type,
        label: pickText(dataSearchForm.label),
        status: dataSearchForm.status
      });
      const page = res?.data ?? {};
      dataList.value = page.list ?? [];
      dataPagination.total = page.total ?? 0;
      dataPagination.pageSize = page.pageSize ?? dataPagination.pageSize;
      dataPagination.currentPage =
        page.currentPage ?? dataPagination.currentPage;
    } catch {
      dataList.value = [];
      dataPagination.total = 0;
      message("获取字典数据失败", { type: "error" });
    } finally {
      dataLoading.value = false;
    }
  }

  function resetTypeSearch(formEl) {
    if (!formEl) return;
    formEl.resetFields();
    typePagination.currentPage = 1;
    onTypeSearch(false);
  }

  function resetDataSearch(formEl) {
    if (!formEl) return;
    formEl.resetFields();
    dataPagination.currentPage = 1;
    onDataSearch();
  }

  function handleTypeSizeChange(val: number) {
    typePagination.pageSize = val;
    typePagination.currentPage = 1;
    onTypeSearch(false);
  }

  function handleTypeCurrentChange(val: number) {
    typePagination.currentPage = val;
    onTypeSearch(false);
  }

  function handleDataSizeChange(val: number) {
    dataPagination.pageSize = val;
    dataPagination.currentPage = 1;
    onDataSearch();
  }

  function handleDataCurrentChange(val: number) {
    dataPagination.currentPage = val;
    onDataSearch();
  }

  function handleTypeRowClick(row: DictTypeRow) {
    if (currentDictType.value?.id === row.id) return;
    currentDictType.value = row;
    dataPagination.currentPage = 1;
    onDataSearch();
  }

  function openTypeDialog(title = "新增", row?: DictTypeRow) {
    addDialog({
      title: `${title}字典类型`,
      props: {
        formInline: {
          id: row?.id,
          name: row?.name ?? "",
          type: row?.type ?? "",
          status: row?.status ?? 1,
          sort: row?.sort ?? 0,
          remark: row?.remark ?? ""
        }
      },
      width: "42%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () =>
        h(typeForm, { ref: typeFormRef, formInline: null }),
      beforeSure: (done, { options }) => {
        const FormRef = typeFormRef.value.getRef();
        const curData = toRaw(
          options.props.formInline
        ) as DictTypeFormItemProps;
        FormRef.validate(async valid => {
          if (!valid) return;
          const payload = {
            name: curData.name,
            type: curData.type,
            status: curData.status,
            sort: curData.sort,
            remark: curData.remark
          };
          try {
            if (title === "新增") {
              await createDictType(payload);
              message("新增成功", { type: "success" });
            } else {
              await updateDictType(curData.id as number, payload);
              message("修改成功", { type: "success" });
            }
            done();
            await onTypeSearch(title !== "新增");
          } catch {
            message(`${title}失败`, { type: "error" });
          }
        });
      }
    });
  }

  function openDataDialog(title = "新增", row?: DictDataRow) {
    loadTypeOptions().then(dictTypeOptions => {
      addDialog({
        title: `${title}字典数据`,
        props: {
          formInline: {
            id: row?.id,
            dictType: row?.dictType ?? currentDictType.value?.type ?? "",
            label: row?.label ?? "",
            value: row?.value ?? "",
            status: row?.status ?? 1,
            sort: row?.sort ?? 0,
            cssClass: row?.cssClass ?? "",
            listClass: row?.listClass ?? "default",
            isDefault: row?.isDefault ?? 0,
            remark: row?.remark ?? ""
          },
          dictTypeOptions
        },
        width: "48%",
        draggable: true,
        fullscreen: deviceDetection(),
        fullscreenIcon: true,
        closeOnClickModal: false,
        contentRenderer: () =>
          h(dataForm, {
            ref: dataFormRef,
            formInline: null,
            dictTypeOptions: dictTypeOptions
          }),
        beforeSure: (done, { options }) => {
          const FormRef = dataFormRef.value.getRef();
          const curData = toRaw(
            options.props.formInline
          ) as DictDataFormItemProps;
          FormRef.validate(async valid => {
            if (!valid) return;
            const payload = {
              dictType: curData.dictType,
              label: curData.label,
              value: curData.value,
              status: curData.status,
              sort: curData.sort,
              cssClass: curData.cssClass,
              listClass: curData.listClass,
              isDefault: curData.isDefault,
              remark: curData.remark
            };
            try {
              if (title === "新增") {
                await createDictData(payload);
                message("新增成功", { type: "success" });
              } else {
                await updateDictData(curData.id as number, payload);
                message("修改成功", { type: "success" });
              }
              done();
              if (currentDictType.value?.type !== curData.dictType) {
                const matched = typeList.value.find(
                  item => item.type === curData.dictType
                );
                currentDictType.value = matched;
              }
              await onDataSearch();
            } catch {
              message(`${title}失败`, { type: "error" });
            }
          });
        }
      });
    });
  }

  function handleTypeDelete(row: DictTypeRow) {
    deleteDictType(row.id)
      .then(res => {
        if (res?.code !== 200) {
          message(res?.msg || res?.message || "删除失败", { type: "error" });
          return;
        }
        if (currentDictType.value?.id === row.id) {
          currentDictType.value = undefined;
        }
        message("删除成功", { type: "success" });
        onTypeSearch(false);
      })
      .catch(() => message("删除失败", { type: "error" }));
  }

  function handleDataDelete(row: DictDataRow) {
    deleteDictData(row.id)
      .then(res => {
        if (res?.code !== 200) {
          message(res?.msg || res?.message || "删除失败", { type: "error" });
          return;
        }
        message("删除成功", { type: "success" });
        onDataSearch();
      })
      .catch(() => message("删除失败", { type: "error" }));
  }

  onMounted(() => {
    onTypeSearch(false);
  });

  return {
    typeSearchForm,
    dataSearchForm,
    typeLoading,
    dataLoading,
    typeList,
    dataList,
    currentDictType,
    typePagination,
    dataPagination,
    typeColumns,
    dataColumns,
    onTypeSearch,
    onDataSearch,
    resetTypeSearch,
    resetDataSearch,
    handleTypeSizeChange,
    handleTypeCurrentChange,
    handleDataSizeChange,
    handleDataCurrentChange,
    handleTypeRowClick,
    openTypeDialog,
    openDataDialog,
    handleTypeDelete,
    handleDataDelete
  };
}
