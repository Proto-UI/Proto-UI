//! Native root-region leases: ownership metadata, never Prototype semantics.
use crate::messages::AvailableSpaceLease;

const MAX_SAFE_INTEGER: u64 = 9_007_199_254_740_991;

#[derive(Default, Debug)]
pub struct AvailableSpaceLeaseState {
    latest: Option<AvailableSpaceLease>,
}

impl AvailableSpaceLeaseState {
    pub fn accept(&mut self, next: AvailableSpaceLease, current_view: Option<u64>) -> bool {
        if next.view_epoch == 0
            || next.view_epoch > MAX_SAFE_INTEGER
            || next.module_epoch == 0
            || next.module_epoch > MAX_SAFE_INTEGER
            || next.root != "proto-surface"
            || next.boundary != "root-content"
            || next.lease_id.is_empty()
            || next.lease_id.len() > 256
            || current_view.is_some_and(|epoch| next.view_epoch < epoch)
        {
            return false;
        }
        if let Some(previous) = &self.latest {
            if next.view_epoch < previous.view_epoch || next.module_epoch < previous.module_epoch {
                return false;
            }
            let same = next.view_epoch == previous.view_epoch
                && next.module_epoch == previous.module_epoch;
            if same && (next.lease_id != previous.lease_id || (!previous.active && next.active)) {
                return false;
            }
            // A late release is allowed to retire only the exact current lease.
            if !next.active && (!same || next.lease_id != previous.lease_id) {
                return false;
            }
        } else if !next.active {
            return false;
        }
        self.latest = Some(next);
        true
    }

    pub fn current(&self, view_epoch: u64) -> Option<&AvailableSpaceLease> {
        self.latest
            .as_ref()
            .filter(|lease| lease.active && lease.view_epoch == view_epoch)
    }

    pub fn retire(&mut self, view_epoch: u64) {
        if let Some(lease) = &mut self.latest {
            if lease.view_epoch == view_epoch {
                lease.active = false;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn lease(view: u64, module: u64, id: &str) -> AvailableSpaceLease {
        AvailableSpaceLease {
            session_id: "dialog".into(),
            view_epoch: view,
            module_epoch: module,
            lease_id: id.into(),
            root: "proto-surface".into(),
            boundary: "root-content".into(),
            active: true,
        }
    }
    #[test]
    fn stages_a_lease_before_projection_then_matches_exact_epoch() {
        let mut state = AvailableSpaceLeaseState::default();
        assert!(state.accept(lease(1, 3, "a"), None));
        assert!(state.current(2).is_none());
        assert_eq!(state.current(1).unwrap().lease_id, "a");
        assert!(state.accept(lease(1, 3, "a"), Some(1)));
    }
    #[test]
    fn rejects_old_leases_and_cannot_resurrect_a_retired_generation() {
        let mut state = AvailableSpaceLeaseState::default();
        assert!(state.accept(lease(1, 3, "a"), None));
        state.retire(1);
        assert!(!state.accept(lease(1, 3, "a"), None));
        assert!(!state.accept(lease(1, 3, "forged"), None));
        assert!(state.accept(lease(2, 3, "b"), None));
        assert!(!state.accept(lease(1, 4, "c"), Some(2)));
        let mut release = lease(1, 3, "a");
        release.active = false;
        assert!(!state.accept(release, Some(2)));
        assert_eq!(state.current(2).unwrap().lease_id, "b");
    }
    #[test]
    fn new_module_owner_replaces_old_within_same_view() {
        let mut state = AvailableSpaceLeaseState::default();
        assert!(state.accept(lease(1, 3, "a"), None));
        assert!(state.accept(lease(1, 4, "b"), Some(1)));
        assert!(!state.accept(lease(1, 3, "a"), Some(1)));
        let mut release = lease(1, 4, "b");
        release.active = false;
        assert!(state.accept(release, Some(1)));
        assert!(state.current(1).is_none());
    }
    #[test]
    fn rejects_foreign_root_boundary_and_invalid_generations() {
        for candidate in [
            lease(0, 1, "a"),
            lease(1, 0, "a"),
            lease(1, 1, ""),
            AvailableSpaceLease {
                root: "foreign".into(),
                ..lease(1, 1, "a")
            },
            AvailableSpaceLease {
                boundary: "desktop".into(),
                ..lease(1, 1, "a")
            },
            lease(MAX_SAFE_INTEGER + 1, 1, "a"),
        ] {
            assert!(!AvailableSpaceLeaseState::default().accept(candidate, None));
        }
    }
}
