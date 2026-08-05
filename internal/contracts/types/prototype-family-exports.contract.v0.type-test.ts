import { button } from '@proto.ui/prototypes-base/button';
import { asyncRegionRoot } from '@proto.ui/prototypes-base/async-region';
import { liveRegionRoot } from '@proto.ui/prototypes-base/live-region';
import {
  dialogClose,
  dialogContent,
  dialogDescription,
  dialogMask,
  dialogRoot,
  dialogTitle,
  dialogTrigger,
} from '@proto.ui/prototypes-base/dialog';
import {
  dropdownContent,
  dropdownItem,
  dropdownRoot,
  dropdownTrigger,
} from '@proto.ui/prototypes-base/dropdown';
import {
  hoverCardContent,
  hoverCardRoot,
  hoverCardTrigger,
} from '@proto.ui/prototypes-base/hover-card';
import {
  selectContent,
  selectItem,
  selectRoot,
  selectTrigger,
  selectValue,
} from '@proto.ui/prototypes-base/select';
import { switchRoot, switchThumb } from '@proto.ui/prototypes-base/switch';
import { tabsContent, tabsList, tabsRoot, tabsTrigger } from '@proto.ui/prototypes-base/tabs';
import { toggle } from '@proto.ui/prototypes-base/toggle';
import { transition } from '@proto.ui/prototypes-base/transition';
import { shadcnButton } from '@proto.ui/prototypes-shadcn/button';
import {
  shadcnDialogClose,
  shadcnDialogContent,
  shadcnDialogDescription,
  shadcnDialogMask,
  shadcnDialogRoot,
  shadcnDialogTitle,
  shadcnDialogTrigger,
} from '@proto.ui/prototypes-shadcn/dialog';
import {
  shadcnDropdownContent,
  shadcnDropdownItem,
  shadcnDropdownRoot,
  shadcnDropdownTrigger,
} from '@proto.ui/prototypes-shadcn/dropdown';
import {
  shadcnHoverCardContent,
  shadcnHoverCardRoot,
  shadcnHoverCardTrigger,
} from '@proto.ui/prototypes-shadcn/hover-card';
import {
  shadcnSelectContent,
  shadcnSelectItem,
  shadcnSelectRoot,
  shadcnSelectTrigger,
  shadcnSelectValue,
} from '@proto.ui/prototypes-shadcn/select';
import { shadcnSwitchRoot, shadcnSwitchThumb } from '@proto.ui/prototypes-shadcn/switch';
import {
  shadcnTabsContent,
  shadcnTabsList,
  shadcnTabsRoot,
  shadcnTabsTrigger,
} from '@proto.ui/prototypes-shadcn/tabs';
import { shadcnToggle } from '@proto.ui/prototypes-shadcn/toggle';
import { separatorRoot } from '@proto.ui/prototypes-base/separator';
import { textareaRoot } from '@proto.ui/prototypes-base/textarea';
import { brutalistButton } from '@proto.ui/prototypes-brutalist/button';
import {
  brutalistDialogClose,
  brutalistDialogCloseIcon,
  brutalistDialogContent,
  brutalistDialogDescription,
  brutalistDialogFooter,
  brutalistDialogHeader,
  brutalistDialogMask,
  brutalistDialogRoot,
  brutalistDialogTitle,
  brutalistDialogTrigger,
} from '@proto.ui/prototypes-brutalist/dialog';
import {
  brutalistDropdownContent,
  brutalistDropdownItem,
  brutalistDropdownRoot,
  brutalistDropdownTrigger,
} from '@proto.ui/prototypes-brutalist/dropdown';
import {
  brutalistHoverCardContent,
  brutalistHoverCardRoot,
  brutalistHoverCardTrigger,
} from '@proto.ui/prototypes-brutalist/hover-card';
import {
  brutalistScrollAreaRoot,
  brutalistScrollAreaScrollbar,
  brutalistScrollAreaThumb,
  brutalistScrollAreaViewport,
} from '@proto.ui/prototypes-brutalist/scroll-area';
import {
  brutalistSelectContent,
  brutalistSelectItem,
  brutalistSelectRoot,
  brutalistSelectTrigger,
  brutalistSelectValue,
} from '@proto.ui/prototypes-brutalist/select';
import { brutalistSeparatorRoot } from '@proto.ui/prototypes-brutalist/separator';
import { brutalistSkeletonRoot } from '@proto.ui/prototypes-brutalist/skeleton';
import { brutalistSwitchRoot, brutalistSwitchThumb } from '@proto.ui/prototypes-brutalist/switch';
import {
  brutalistTabsContent,
  brutalistTabsList,
  brutalistTabsRoot,
  brutalistTabsTrigger,
} from '@proto.ui/prototypes-brutalist/tabs';
import { brutalistTextareaRoot } from '@proto.ui/prototypes-brutalist/textarea';
import { brutalistToggle } from '@proto.ui/prototypes-brutalist/toggle';

// The CLI registry consumes these exact named exports from family subpaths.
void [
  button,
  liveRegionRoot,
  asyncRegionRoot,
  toggle,
  transition,
  switchRoot,
  switchThumb,
  tabsRoot,
  tabsList,
  tabsTrigger,
  tabsContent,
  dropdownRoot,
  dropdownTrigger,
  dropdownContent,
  dropdownItem,
  selectRoot,
  selectTrigger,
  selectValue,
  selectContent,
  selectItem,
  hoverCardRoot,
  hoverCardTrigger,
  hoverCardContent,
  dialogRoot,
  dialogTrigger,
  dialogMask,
  dialogContent,
  dialogTitle,
  dialogDescription,
  dialogClose,
  separatorRoot,
  textareaRoot,
  shadcnButton,
  shadcnToggle,
  shadcnSwitchRoot,
  shadcnSwitchThumb,
  shadcnTabsRoot,
  shadcnTabsList,
  shadcnTabsTrigger,
  shadcnTabsContent,
  shadcnDropdownRoot,
  shadcnDropdownTrigger,
  shadcnDropdownContent,
  shadcnDropdownItem,
  shadcnSelectRoot,
  shadcnSelectTrigger,
  shadcnSelectValue,
  shadcnSelectContent,
  shadcnSelectItem,
  shadcnHoverCardRoot,
  shadcnHoverCardTrigger,
  shadcnHoverCardContent,
  shadcnDialogRoot,
  shadcnDialogTrigger,
  shadcnDialogMask,
  shadcnDialogContent,
  shadcnDialogTitle,
  shadcnDialogDescription,
  shadcnDialogClose,
  brutalistButton,
  brutalistToggle,
  brutalistSeparatorRoot,
  brutalistSkeletonRoot,
  brutalistTextareaRoot,
  brutalistSwitchRoot,
  brutalistSwitchThumb,
  brutalistTabsRoot,
  brutalistTabsList,
  brutalistTabsTrigger,
  brutalistTabsContent,
  brutalistHoverCardRoot,
  brutalistHoverCardTrigger,
  brutalistHoverCardContent,
  brutalistDropdownRoot,
  brutalistDropdownTrigger,
  brutalistDropdownContent,
  brutalistDropdownItem,
  brutalistSelectRoot,
  brutalistSelectTrigger,
  brutalistSelectValue,
  brutalistSelectContent,
  brutalistSelectItem,
  brutalistDialogRoot,
  brutalistDialogTrigger,
  brutalistDialogMask,
  brutalistDialogContent,
  brutalistDialogTitle,
  brutalistDialogDescription,
  brutalistDialogClose,
  brutalistDialogCloseIcon,
  brutalistDialogHeader,
  brutalistDialogFooter,
  brutalistScrollAreaRoot,
  brutalistScrollAreaViewport,
  brutalistScrollAreaScrollbar,
  brutalistScrollAreaThumb,
];
