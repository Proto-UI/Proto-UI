// Static external harness example; not executed or copied into a subject.
import base from '/work/repo/vitest.config';
export default {
  ...base,
  root: '/work/repo',
  test: {
    ...base.test,
    include: ['apps/www/src/content/docs/zh-cn/header-select-elevation.browser.test.ts'],
    exclude: [],
    fileParallelism: false,
    minWorkers: 1,
    maxWorkers: 1,
    isolate: true,
    retry: 0,
  },
};
