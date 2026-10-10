import type {
  HoverCardInteractionPart,
  HoverCardReleaseInteraction,
  HoverCardRootExposes,
} from '@proto.ui/prototypes-base/hover-card';
import type { ShadcnHoverCardRootExposes } from '@proto.ui/prototypes-shadcn/hover-card';
import type { BrutalistHoverCardRootExposes } from '@proto.ui/prototypes-brutalist/hover-card';

const part: HoverCardInteractionPart = 'content';
const release: HoverCardReleaseInteraction = (_part, _id) => false;
const base: HoverCardRootExposes['releaseInteraction']['fn'] = release;
const shadcn: ShadcnHoverCardRootExposes['releaseInteraction']['fn'] = release;
const brutalist: BrutalistHoverCardRootExposes['releaseInteraction']['fn'] = release;
const result: boolean = base(part, 1);
// @ts-expect-error The collaboration part is closed, not an arbitrary role.
release('root', 1);
// @ts-expect-error Contribution identity is numeric, not a host/callback object.
release('content', () => 1);
void [shadcn, brutalist, result];
