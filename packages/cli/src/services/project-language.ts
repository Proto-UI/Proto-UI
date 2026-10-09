import fs from 'node:fs/promises';

export type GeneratedSourceLanguage = 'js' | 'ts';

export type LanguageDetectionSource =
  | 'explicit-option'
  | 'typescript-config'
  | 'typescript-dependency'
  | 'javascript-fallback';

export interface ProjectLanguageDetection {
  language: GeneratedSourceLanguage;
  source: LanguageDetectionSource;
}

function hasProjectTypeScriptDependency(projectPkg: Record<string, unknown>): boolean {
  const dependencies = projectPkg.dependencies as Record<string, unknown> | undefined;
  const devDependencies = projectPkg.devDependencies as Record<string, unknown> | undefined;
  return Boolean(dependencies?.typescript || devDependencies?.typescript);
}

export async function resolveGeneratedSourceLanguage({
  cwd,
  projectPkg,
  requestedLanguage,
}: {
  cwd: string;
  projectPkg: Record<string, unknown>;
  requestedLanguage: unknown;
}): Promise<ProjectLanguageDetection> {
  if (typeof requestedLanguage === 'string') {
    if (requestedLanguage === 'js' || requestedLanguage === 'ts') {
      return { language: requestedLanguage, source: 'explicit-option' };
    }
    throw new Error(`invalid --language "${requestedLanguage}". Use "js" or "ts".`);
  }
  if (requestedLanguage !== undefined) {
    throw new Error('invalid --language value. Use "js" or "ts".');
  }

  const projectFiles = await fs.readdir(cwd);
  if (projectFiles.some((fileName) => /^tsconfig(?:\..+)?\.json$/.test(fileName))) {
    return { language: 'ts', source: 'typescript-config' };
  }
  if (hasProjectTypeScriptDependency(projectPkg)) {
    return { language: 'ts', source: 'typescript-dependency' };
  }

  return { language: 'js', source: 'javascript-fallback' };
}

export function describeGeneratedSourceLanguage(detection: ProjectLanguageDetection): string {
  if (detection.source === 'javascript-fallback') {
    return 'generated JavaScript facades because no tsconfig.json or project TypeScript dependency was found; use --language ts to override';
  }
  return `generated ${detection.language === 'ts' ? 'TypeScript' : 'JavaScript'} facades`;
}
