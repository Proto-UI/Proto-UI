import { createInstanceTreeMarkers, releaseWebTriggerSurface } from '@proto.ui/adapter-base';

export { releaseWebTriggerSurface as releaseTriggerSurface } from '@proto.ui/adapter-base';

export const {
  PROTO_INSTANCE: __WC_PROTO_INSTANCE,
  createLogicalInstance,
  bindLogicalParent,
  markProtoInstance,
  isProtoInstance,
  unbindProtoInstance,
  setProtoParent,
  getProtoParent,
  getPrototypeByInstance,
  getLogicalParent,
  getLogicalRoot,
  getLogicalPrototype,
  mergeLogicalTriggerGroup,
  getLogicalTriggerGroupAnchor,
  setLogicalEventRouteOwner,
  getLogicalEventRouteOwner,
  getLogicalEventRouteSurfaceForTarget,
  resolveLogicalTriggerEventRouteForTarget,
  isLogicalEventRouteCandidate,
  getLogicalTriggerSurfaceOwner,
  getLogicalTriggerSurfaceRoot,
  subscribeLogicalTriggerSurface,
  getLogicalEventTarget,
  bindLogicalEventTarget,
  unbindLogicalEventTarget,
} = createInstanceTreeMarkers('@proto.ui/adapter-web-component/__proto_instance', {
  releaseTriggerSurface: releaseWebTriggerSurface,
});
