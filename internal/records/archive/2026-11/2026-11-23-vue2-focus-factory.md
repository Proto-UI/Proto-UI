# Vue2 teardown fixtures use one logical adapter domain

Date: 2026-11-23. Non-normative fixture correction.

The two failing teardown/focus fixtures created Outer and Inner with two separate `createVue2Adapter` calls. Each factory owns a distinct `logicalOwnerKey` Symbol and provides/injects only that domain's logical parent, in `packages/adapters/vue2/src/adapt.ts`. The public README constructs one `adapt` function from the injected Vue runtime. These fixtures therefore never established the shared Trigger group they intended to exercise: the outer focus request resolved to Outer instead of the replacement Inner, and a supposedly pending Inner focus request never reached the configured throwing target. The original nineteen-file baseline archive retains these 18 passed and 2 failed tests.

The correction uses one adapter factory for each composed Outer/Inner pair and adds an explicit assertion that Inner's logical parent is Outer before the failure scenario begins. The adapter implementation, host focus behavior, original error identity, view cleanup assertions, remount readiness and final successful focus target are unchanged. No wait, retry count, threshold or exception expectation is relaxed. Both corrected fixtures retain their original assertions; the complete file now passes 20 tests with no skips.

[Receipt and complete candidate log](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-vue2-focus-factory/receipt.json) bind the baseline and candidate observations. This is installed-framework lifecycle evidence in Happy DOM; native browser and assistive-technology acceptance remain separate.
