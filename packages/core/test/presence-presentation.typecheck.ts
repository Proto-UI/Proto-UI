import type {
  PresentationOwnerRef,
  PresentationOwnerWriter,
  PresentationViewBinding,
  FiniteSelection,
  Translation,
} from '../src/presence-presentation';

// @ts-expect-error A structural record is not a registry-minted owner.
const forgedOwner: PresentationOwnerRef = {};
// @ts-expect-error The public owner reference does not carry writer authority.
const forgedWriter: PresentationOwnerWriter = forgedOwner;
// @ts-expect-error A numeric prototype epoch is not a host-minted binding.
const forgedView: PresentationViewBinding = { epoch: 1 };
declare const source: FiniteSelection<Translation>['source'];
// @ts-expect-error Selection references do not expose state mutation authority.
source.set('bottom');
void forgedWriter;
void forgedView;

import type { IntentBuilder } from '../src/handles';
declare const intent: IntentBuilder;
// @ts-expect-error Owner allocation is setup-only, never available in Rule intents.
intent.feedback.presence.owner();
