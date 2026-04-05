interface FormItemProps {
  id?: number;
  name: string;
  slug: string;
  status: number;
  sort: number;
}

interface FormProps {
  formInline: FormItemProps;
}

export type { FormItemProps, FormProps };
