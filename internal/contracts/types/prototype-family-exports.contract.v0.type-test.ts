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
import * as ShadcnPackage from '@proto.ui/prototypes-shadcn';
import * as ShadcnScrollAreaFamily from '@proto.ui/prototypes-shadcn/scroll-area';
import { separatorRoot } from '@proto.ui/prototypes-base/separator';
import { textareaRoot } from '@proto.ui/prototypes-base/textarea';
import { brutalistBadgeRoot } from '@proto.ui/prototypes-brutalist/badge';
import {
  brutalistCardContent,
  brutalistCardFooter,
  brutalistCardHeader,
  brutalistCardRoot,
} from '@proto.ui/prototypes-brutalist/card';
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

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

type ShadcnScrollAreaFamilyTypeSurface = {
  root: [
    ShadcnScrollAreaFamily.ShadcnScrollAreaRootProps,
    ShadcnScrollAreaFamily.ShadcnScrollAreaRootExposes,
    ShadcnScrollAreaFamily.ShadcnScrollAreaRootStateHandles,
    ShadcnScrollAreaFamily.ShadcnScrollAreaRootAsHookContract,
  ];
  viewport: [
    ShadcnScrollAreaFamily.ShadcnScrollAreaViewportProps,
    ShadcnScrollAreaFamily.ShadcnScrollAreaViewportExposes,
    ShadcnScrollAreaFamily.ShadcnScrollAreaViewportStateHandles,
    ShadcnScrollAreaFamily.ShadcnScrollAreaViewportAsHookContract,
  ];
  scrollbar: [
    ShadcnScrollAreaFamily.ShadcnScrollAreaScrollbarProps,
    ShadcnScrollAreaFamily.ShadcnScrollAreaScrollbarExposes,
    ShadcnScrollAreaFamily.ShadcnScrollAreaScrollbarStateHandles,
    ShadcnScrollAreaFamily.ShadcnScrollAreaScrollbarAsHookContract,
  ];
  thumb: [
    ShadcnScrollAreaFamily.ShadcnScrollAreaThumbProps,
    ShadcnScrollAreaFamily.ShadcnScrollAreaThumbExposes,
    ShadcnScrollAreaFamily.ShadcnScrollAreaThumbStateHandles,
    ShadcnScrollAreaFamily.ShadcnScrollAreaThumbAsHookContract,
  ];
};

type ShadcnScrollAreaRootTypeSurface = {
  root: [
    ShadcnPackage.ShadcnScrollAreaRootProps,
    ShadcnPackage.ShadcnScrollAreaRootExposes,
    ShadcnPackage.ShadcnScrollAreaRootStateHandles,
    ShadcnPackage.ShadcnScrollAreaRootAsHookContract,
  ];
  viewport: [
    ShadcnPackage.ShadcnScrollAreaViewportProps,
    ShadcnPackage.ShadcnScrollAreaViewportExposes,
    ShadcnPackage.ShadcnScrollAreaViewportStateHandles,
    ShadcnPackage.ShadcnScrollAreaViewportAsHookContract,
  ];
  scrollbar: [
    ShadcnPackage.ShadcnScrollAreaScrollbarProps,
    ShadcnPackage.ShadcnScrollAreaScrollbarExposes,
    ShadcnPackage.ShadcnScrollAreaScrollbarStateHandles,
    ShadcnPackage.ShadcnScrollAreaScrollbarAsHookContract,
  ];
  thumb: [
    ShadcnPackage.ShadcnScrollAreaThumbProps,
    ShadcnPackage.ShadcnScrollAreaThumbExposes,
    ShadcnPackage.ShadcnScrollAreaThumbStateHandles,
    ShadcnPackage.ShadcnScrollAreaThumbAsHookContract,
  ];
};

type _ShadcnScrollAreaRootBarrelParity = Assert<
  Equal<ShadcnScrollAreaFamilyTypeSurface, ShadcnScrollAreaRootTypeSurface>
>;

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
  brutalistBadgeRoot,
  brutalistCardRoot,
  brutalistCardHeader,
  brutalistCardContent,
  brutalistCardFooter,
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
  ShadcnScrollAreaFamily.ShadcnScrollAreaRoot,
  ShadcnScrollAreaFamily.ShadcnScrollAreaViewport,
  ShadcnScrollAreaFamily.ShadcnScrollAreaScrollbar,
  ShadcnScrollAreaFamily.ShadcnScrollAreaThumb,
  ShadcnScrollAreaFamily.shadcnScrollAreaRoot,
  ShadcnScrollAreaFamily.shadcnScrollAreaViewport,
  ShadcnScrollAreaFamily.shadcnScrollAreaScrollbar,
  ShadcnScrollAreaFamily.shadcnScrollAreaThumb,
  ShadcnPackage.ShadcnScrollAreaRoot,
  ShadcnPackage.ShadcnScrollAreaViewport,
  ShadcnPackage.ShadcnScrollAreaScrollbar,
  ShadcnPackage.ShadcnScrollAreaThumb,
];
