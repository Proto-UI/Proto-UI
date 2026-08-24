export const GITHUB_ACTIONS_BOT_ID = 41898282;

export function ownedMarkerComments(comments, marker, viewerID = GITHUB_ACTIONS_BOT_ID) {
  if (!Number.isSafeInteger(viewerID) || viewerID < 1) return [];
  return comments.filter(
    (comment) => comment?.user?.id === viewerID && comment?.body?.includes(marker),
  );
}
