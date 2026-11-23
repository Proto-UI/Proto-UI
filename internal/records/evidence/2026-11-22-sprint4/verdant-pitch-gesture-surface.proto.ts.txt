import { definePrototype, tw } from '@proto.ui/core';

type NoteGestureGuards = {
  hit_background: boolean;
  hit_selected_note: boolean;
  hit_unselected_note: boolean;
  hit_note_body: boolean;
  hit_resize_handle: boolean;
  toggle_modifier: boolean;
  extend_modifier: boolean;
  duplicate_modifier: boolean;
  pointer_threshold_crossed: boolean;
  base_revision_matches: boolean;
  base_revision_matches_and_delta_nonzero: boolean;
};

type NoteGestureDecision = {
  nextPhase: string;
  consumed: boolean;
  effects: string[];
};

// The session binding supplies immutable guard facts and applies the ordered effects.
function planNoteGesture(
  machine: string,
  phase: string,
  event: string,
  guards: NoteGestureGuards,
): NoteGestureDecision {
  if (machine !== 'marquee' && machine !== 'move' && machine !== 'resize' && machine !== 'duplicate') {
    return { nextPhase: phase, consumed: false, effects: [] };
  }

  if (phase === 'idle' && event === 'PointerDown') {
    if (machine === 'marquee' && guards.hit_background) {
      return handled('armed', ['Session.BeginMarqueeGesture', 'Host.CapturePointer']);
    }
    if (machine === 'resize' && guards.hit_resize_handle) {
      return handled('armed', ['Session.SelectIfUnselectedHit', 'Session.BeginResizeGesture', 'Host.CapturePointer']);
    }
    if (machine === 'move' && !guards.duplicate_modifier) {
      if (guards.hit_selected_note && guards.toggle_modifier) {
        return handled('idle', ['Session.ToggleHitNote']);
      }
      if (guards.hit_note_body && guards.toggle_modifier) {
        return handled('armed', ['Session.ToggleHitNote', 'Session.BeginMoveGesture', 'Host.CapturePointer']);
      }
      if (guards.hit_note_body && guards.extend_modifier) {
        return handled('armed', ['Session.ExtendSelectionToHit', 'Session.BeginMoveGesture', 'Host.CapturePointer']);
      }
      if (guards.hit_selected_note) {
        return handled('armed', ['Session.BeginMoveGesture', 'Host.CapturePointer']);
      }
      if (guards.hit_unselected_note) {
        return handled('armed', ['Session.SelectOnlyHitNote', 'Session.BeginMoveGesture', 'Host.CapturePointer']);
      }
    }
    if (machine === 'duplicate' && guards.duplicate_modifier) {
      // Duplicate prioritizes unselected hits. Move prioritizes selected hits.
      if (guards.hit_unselected_note && guards.toggle_modifier) {
        return handled('armed', ['Session.ToggleHitNote', 'Session.BeginDuplicateGesture', 'Host.CapturePointer']);
      }
      if (guards.hit_selected_note && guards.toggle_modifier) {
        return handled('idle', ['Session.ToggleHitNote']);
      }
      if (guards.hit_note_body && guards.extend_modifier) {
        return handled('armed', ['Session.ExtendSelectionToHit', 'Session.BeginDuplicateGesture', 'Host.CapturePointer']);
      }
      if (guards.hit_unselected_note) {
        return handled('armed', ['Session.SelectOnlyHitNote', 'Session.BeginDuplicateGesture', 'Host.CapturePointer']);
      }
      if (guards.hit_selected_note) {
        return handled('armed', ['Session.BeginDuplicateGesture', 'Host.CapturePointer']);
      }
    }
  }

  const active = phase === 'armed' || phase === 'dragging';
  if (event === 'PointerMove' && (phase === 'dragging' || (phase === 'armed' && guards.pointer_threshold_crossed))) {
    if (machine === 'marquee') return handled('dragging', ['Session.UpdateMarqueePreview']);
    if (machine === 'resize') return handled('dragging', ['Session.UpdateResizePreview']);
    return handled('dragging', ['Session.UpdateMovePreview']);
  }
  if (event === 'PointerUp' && phase === 'dragging') {
    if (machine === 'marquee' && guards.base_revision_matches) {
      return finishWith('Session.CommitMarqueeSelection');
    }
    if (machine !== 'marquee' && guards.base_revision_matches_and_delta_nonzero) {
      if (machine === 'move') return finishWith('Domain.CommitMoveNotes');
      if (machine === 'resize') return finishWith('Domain.CommitResizeNotes');
      return finishWith('Domain.CommitDuplicateNotes');
    }
    return finishWith('Session.ReportConflictIfStale');
  }
  if (event === 'PointerUp' && phase === 'armed' && machine !== 'resize') {
    return finishWith('Session.ClickReleaseSelection');
  }
  if ((event === 'Cancel' && active) || (event === 'PointerUp' && phase === 'armed')) {
    return handled('idle', ['Session.ClearGesturePreview', 'Host.ReleasePointer']);
  }
  return { nextPhase: phase, consumed: active, effects: [] };
}

function handled(nextPhase: string, effects: string[]): NoteGestureDecision {
  return { nextPhase, consumed: true, effects };
}

function finishWith(effect: string): NoteGestureDecision {
  return handled('idle', [effect, 'Session.ClearGesturePreview', 'Host.ReleasePointer']);
}

// ---------------------------------------------------------------------------
// Built-in effect editors (knobs, curve handles, threshold handles).
//
// The same compiled root also hosts those editors: the pinned GPUI target
// vendors one native SDK crate per compiled unit under a fixed name, so a
// second unit cannot share the Cargo workspace yet. The native slot draws the
// editor; this protocol owns when a press becomes an edit, how a drag maps to
// a value, and when the edit is committed, reset or discarded.

type ControlGuards = {
  hit_control: boolean;
  threshold_crossed: boolean;
  reset_modifier: boolean;
  double_click: boolean;
};

type ControlDecision = {
  nextPhase: string;
  consumed: boolean;
  effects: string[];
};

function planControlGesture(phase: string, event: string, guards: ControlGuards): ControlDecision {
  if (phase === 'idle' && event === 'PointerDown') {
    if (!guards.hit_control) return { nextPhase: 'idle', consumed: false, effects: [] };
    // Double click, or Alt / Option click, restores the default; it never drags.
    if (guards.double_click || guards.reset_modifier) {
      return { nextPhase: 'idle', consumed: true, effects: ['Control.Select', 'Control.Reset'] };
    }
    return { nextPhase: 'armed', consumed: true, effects: ['Control.Select', 'Control.Begin', 'Host.CapturePointer'] };
  }
  if (phase === 'armed' && event === 'PointerMove') {
    // A click selects; only movement past the threshold edits the value.
    if (!guards.threshold_crossed) return { nextPhase: 'armed', consumed: true, effects: [] };
    return { nextPhase: 'dragging', consumed: true, effects: ['Control.Preview'] };
  }
  if (phase === 'dragging' && event === 'PointerMove') {
    return { nextPhase: 'dragging', consumed: true, effects: ['Control.Preview'] };
  }
  if (phase === 'dragging' && event === 'PointerUp') {
    return { nextPhase: 'idle', consumed: true, effects: ['Control.Commit', 'Host.ReleasePointer'] };
  }
  if (phase === 'armed' && event === 'PointerUp') {
    return { nextPhase: 'idle', consumed: true, effects: ['Control.Discard', 'Host.ReleasePointer'] };
  }
  if ((phase === 'armed' || phase === 'dragging') && event === 'Cancel') {
    return { nextPhase: 'idle', consumed: true, effects: ['Control.Discard', 'Host.ReleasePointer'] };
  }
  return { nextPhase: phase, consumed: false, effects: [] };
}

// A drag of `travel` pixels sweeps the whole range; the fine modifier
// (Shift) divides the rate by ten. Values are normalized to 0…1.
function dragNormalized(start: number, delta: number, travel: number, fine: boolean): number {
  const span = travel > 1 ? travel : 1;
  const rate = fine ? 0.1 : 1;
  const next = start + (delta / span) * rate;
  if (next < 0) return 0;
  if (next > 1) return 1;
  return next;
}

export default definePrototype({
  name: 'verdant-pitch-gesture-surface',
  setup(def) {
    // The compiled root sizes and clips the viewport. The native slot draws
    // the roll and translates pointer coordinates into the score's units.
    def.feedback.style.use(tw('w-full h-full overflow-hidden'));
    def.expose.method('planNoteGesture', planNoteGesture);
    def.expose.method('planControlGesture', planControlGesture);
    def.expose.method('dragNormalized', dragNormalized);
    return (renderer) => renderer.slot();
  },
});
