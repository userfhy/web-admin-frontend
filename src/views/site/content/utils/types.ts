interface FormItemProps {
  id?: number;
  categoryOptions: Array<{ id: number; name: string; status: number }>;
  categoryIds: number[];
  title: string;
  slug: string;
  summary: string;
  cover: string;
  content: string;
  seoKeywords: string;
  seoDescription: string;
  status: number;
  sort: number;
}

interface FormProps {
  formInline: FormItemProps;
}

export type { FormItemProps, FormProps };
