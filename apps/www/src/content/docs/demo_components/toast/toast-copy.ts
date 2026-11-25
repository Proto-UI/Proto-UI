import type { DemoRuntimeApi } from '@/components/PrototypePreviewer/demo-types';

export async function setToastCopy(api: DemoRuntimeApi, title: string, description: string) {
  const commits = await Promise.all([
    api.setChildren?.('title-copy', [{ key: 'text', node: title }]),
    api.setChildren?.('description-copy', [{ key: 'text', node: description }]),
  ]);
  return commits.every((result) => result === 'committed');
}
