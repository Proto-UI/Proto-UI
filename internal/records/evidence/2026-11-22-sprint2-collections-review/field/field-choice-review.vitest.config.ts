import original from '/workspace/scratch/44c416809288/s2-input/vitest.config.ts';
export default {
  ...original,
  test: {
    ...original.test,
    include: ['/workspace/scratch/44c416809288/evidence/field-choice-focus-review.test.ts'],
    maxWorkers: 1,
    minWorkers: 1,
  },
};
