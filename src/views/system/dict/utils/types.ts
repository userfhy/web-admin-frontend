export interface DictTypeFormItemProps {
  id?: number;
  name: string;
  type: string;
  status: number;
  sort: number;
  remark?: string;
}

export interface DictTypeFormProps {
  formInline: DictTypeFormItemProps;
}

export interface DictDataFormItemProps {
  id?: number;
  dictType: string;
  label: string;
  value: string;
  status: number;
  sort: number;
  cssClass?: string;
  listClass?: string;
  isDefault: number;
  remark?: string;
}

export interface DictDataFormProps {
  formInline: DictDataFormItemProps;
  dictTypeOptions?: Array<{ label: string; value: string }>;
}
