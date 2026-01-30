// 虽然字段很少 但是抽离出来 后续有扩展字段需求就很方便了

interface FormItemProps {
  /** 角色 key（Casbin v0） */
  roleKey: string;
  /** API 路径（Casbin v1） */
  path: string;
  /** 请求方法（Casbin v2） */
  method: string;
  /** 备注/描述（前端使用） */
  description: string;
  /** 分组（前端使用） */
  apiGroup: string;
  /** id（用于修改/删除） */
  id?: number;
}
interface FormProps {
  formInline: FormItemProps;
}

export type { FormItemProps, FormProps };
