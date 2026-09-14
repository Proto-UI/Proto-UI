# @proto.ui/module-collection

Instance-scoped module for explicit Proto UI collection providers and items.

The bounded draft authority is [M-COLLECTION-0001](../../../spec/modules/M-COLLECTION-0001.yaml), with executable evidence in [T-COLLECTION-0002](../../../spec/tests/T-COLLECTION-0002.yaml).

The Module owns provider/item configuration and projects Anatomy order into current metadata snapshots. Structural `index`, `total`, `first` and `last` override same-named metadata fields without changing the source record. It delegates structural subscriptions to Anatomy and requires no direct Collection host capability.

The privileged `asCollection()` and `asCollectionItem()` hooks compose State, Expose and lifecycle synchronization around the Module port. Repeated no-argument setup calls reuse their handles; `configure()` is setup-only. Internal subscriptions follow mount/unmount and are restored on remount. They are lifecycle resources, not author setup cancellation handles.

Collection does not own selection, focus movement, keyboard policy, or accessibility patterns. Metadata reads are live; metadata-only changes do not establish an additional structural notification channel. Repeated configuration, transactional recovery from setup errors and legacy State-name options remain open questions in the Module entity.
