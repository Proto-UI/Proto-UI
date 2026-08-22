import fs from 'node:fs';
import process from 'node:process';
import { loadSkillRegistry, resolveSkill, validateSkillHandoff } from './skill-registry.mjs';

function usage() {
  return 'Usage: pnpm agent:skill -- <leaf-id> | --handoff <handoff.json>\n';
}

function parse(argv) {
  if (argv[0] === '--') argv = argv.slice(1);
  if (argv.length === 1 && !argv[0].startsWith('-')) return { id: argv[0] };
  if (argv.length === 2 && argv[0] === '--handoff') return { handoffPath: argv[1] };
  throw new Error(usage().trim());
}

try {
  const args = parse(process.argv.slice(2));
  const registry = loadSkillRegistry();
  let skill;
  let terminal = false;
  if (args.handoffPath) {
    const handoff = JSON.parse(fs.readFileSync(args.handoffPath, 'utf8'));
    const result = validateSkillHandoff(handoff, registry);
    skill = result.nextSkill;
    terminal = skill === null;
  } else {
    skill = resolveSkill(args.id, registry);
  }
  const output = terminal
    ? { schemaVersion: 1, terminal: true, skill: null }
    : {
        schemaVersion: 1,
        terminal: false,
        skill: {
          id: skill.id,
          entrypoints: skill.entrypoints,
          loadPath: skill.loadPath,
          transition: skill.transition,
          minimumBand: skill.minimumBand,
          taskClass: skill.taskClass,
          mutation: skill.mutation,
          requires: skill.requires,
          produces: skill.produces,
        },
      };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`[agent:skill] ${error.message}\n`);
  process.exitCode = 1;
}
