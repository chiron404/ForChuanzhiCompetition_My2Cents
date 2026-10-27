import { get, set, del } from "idb-keyval";
import { analysisSchema, type AnalysisResult } from "@/types";

export const CACHE_VERSION = "blueprint-v2.1";
/** IndexedDB 失败时降级为当前会话，不能阻断分析。 */
export async function readCache(key: string): Promise<AnalysisResult | null> {
  try {
    const value: unknown = await get(`${CACHE_VERSION}:${key}`);
    const result = analysisSchema.safeParse(value);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
export async function writeCache(
  key: string,
  result: AnalysisResult,
): Promise<boolean> {
  try {
    await set(`${CACHE_VERSION}:${key}`, result);
    return true;
  } catch {
    return false;
  }
}
export async function clearLast(): Promise<void> {
  try {
    await del(`${CACHE_VERSION}:last`);
  } catch {
    /* 本地存储不可用 */
  }
}
