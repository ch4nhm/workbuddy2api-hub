import { toast } from "sonner";
import { postJSON } from "@/lib/api";

export async function performAction<T = Record<string, unknown>>(
  url: string,
  body: unknown,
  successMessage: string,
): Promise<T> {
  try {
    const response = await postJSON<T>(url, body);
    toast.success(successMessage);
    return response;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
    throw error;
  }
}
