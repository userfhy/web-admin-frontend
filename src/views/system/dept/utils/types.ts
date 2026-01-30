interface FormItemProps {
  higherDeptOptions: Record<string, unknown>[];
  parentId: number;
  deptName: string;
  leader: string;
  phone: string | number;
  email: string;
  orderNum: number;
  status: number;
  remark: string;
  id?: number;
}
interface FormProps {
  formInline: FormItemProps;
}

export type { FormItemProps, FormProps };
