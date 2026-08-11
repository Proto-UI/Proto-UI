function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function validatePreservedReadmeMetadata({ packageName, version, internalDeps, contents }) {
  const issues = [];
  const installPattern = new RegExp(
    `\\bnpm install\\s+${escapeRegExp(packageName)}@([^\\s\u0060]+)`,
    'g'
  );

  for (const match of contents.matchAll(installPattern)) {
    if (match[1] !== version) {
      issues.push(`install command uses ${match[1]} instead of ${version}`);
    }
  }

  const relatedHeading = /^## Related(?: Internal)? Packages\s*$/im.exec(contents);
  if (relatedHeading) {
    const sectionStart = relatedHeading.index + relatedHeading[0].length;
    const remainder = contents.slice(sectionStart);
    const nextHeadingOffset = remainder.search(/^## /m);
    const section = nextHeadingOffset === -1 ? remainder : remainder.slice(0, nextHeadingOffset);
    const documented = new Set(
      [...section.matchAll(/`(@proto\.ui\/[^`]+)`/g)].map((match) => match[1])
    );
    const missing = internalDeps.filter((dependency) => !documented.has(dependency));
    if (missing.length > 0) {
      issues.push(`Related Packages omits production dependencies: ${missing.join(', ')}`);
    }
  }

  if (issues.length > 0) {
    throw new Error(`${packageName} preserved README metadata is stale:\n- ${issues.join('\n- ')}`);
  }
}
