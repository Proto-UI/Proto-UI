import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/registry';

// 用于 PrototypePreviewer 的代码格式化，去除代码中的空格和换行符
export function formatCode(code: string) {
  return code.trim();
}

/**
 * 获取代码
 * @param runtime 对应框架的 runtime
 * @param demoId demo ID
 * @param codeMap 存放代码的映射
 * @returns 代码
 */
export const getCode = (
  runtime: RuntimeId,
  demoId: string,
  codeMap: Partial<Record<RuntimeId, Record<string, string>>>
): string => {
  const runtimeMap = codeMap[runtime] ?? {};
  const code = runtimeMap[demoId];
  if (!code) {
    throw new Error(
      `[ButtonDemo] 未找到 demo: runtime="${runtime}", demoId="${demoId}"。` +
        `codeMap 中该 runtime 仅支持: ${Object.keys(runtimeMap).join(', ') || '(无)'}`
    );
  }
  return code;
};
