export function decodeHtmlEntities(input?: string | null): string {
  if (!input) return "";
  if (typeof window === "undefined") return input;

  const textarea = document.createElement("textarea");
  textarea.innerHTML = input;
  return textarea.value;
}
