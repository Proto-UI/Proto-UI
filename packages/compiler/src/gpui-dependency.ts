/**
 * The admitted default dependency of gpui-source-v1. Keep the source separate
 * from native API capabilities: moving a repository or publishing a crate does
 * not establish that its Element, input, focus or platform APIs are compatible.
 *
 * The future standalone GPUI repository is not an admitted source yet. An
 * embedding application can already select its own source through workspace
 * inheritance, with separate locked-graph and native consumer verification.
 * Keep this module free of Node APIs so browser target discovery can share it.
 */
export const GPUI_PROFILE_SOURCE = Object.freeze({
  kind: 'git' as const,
  git: 'https://github.com/zed-industries/zed',
  revision: '62e5991dd0f0c8a3af8d5e7e9c4652490d468db8',
});

export const GPUI_PROFILE_VERSION = `git:${GPUI_PROFILE_SOURCE.revision}`;
export const GPUI_PROFILE_CARGO_DEPENDENCY = `git = ${JSON.stringify(GPUI_PROFILE_SOURCE.git)}, rev = ${JSON.stringify(GPUI_PROFILE_SOURCE.revision)}`;
