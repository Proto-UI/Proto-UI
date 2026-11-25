import type { ActionStatementIR } from '../ir/types';

/**
 * Native frameworks may defer painting. The current targets therefore admit one terminal
 * explicit update per callback path; earlier/multiple updates need a separate commit protocol.
 * A helper's return exits that invocation, while an ordinary block/branch return exits its caller.
 */
export function getUpdateOrderingIssues(body: readonly ActionStatementIR[]): readonly string[] {
  const issues = new Set<string>();
  interface Completion {
    normal: Set<boolean>;
    returned: Set<boolean>;
  }
  const merge = (into: Set<boolean>, source: Iterable<boolean>): void => {
    for (const value of source) into.add(value);
  };
  const walk = (
    nodes: readonly ActionStatementIR[],
    incoming: ReadonlySet<boolean>
  ): Completion => {
    let normal = new Set(incoming);
    const returned = new Set<boolean>();
    for (const statement of nodes) {
      if (!normal.size) break;
      if (statement.kind === 'return') {
        merge(returned, normal);
        normal.clear();
        break;
      }
      if (statement.kind === 'request-update') {
        if (normal.has(true))
          issues.add(
            'Multiple update requests on one callback path require native commit scheduling.'
          );
        normal = new Set([true]);
        continue;
      }
      if (normal.has(true))
        issues.add(
          'An update before later callback operations requires a render snapshot at the request point.'
        );
      if (statement.kind === 'invoke') {
        const result = walk(statement.body, normal);
        normal = result.normal;
        merge(normal, result.returned);
      } else if (statement.kind === 'if') {
        const then = walk(statement.then, normal);
        const otherwise = walk(statement.otherwise, normal);
        normal = then.normal;
        merge(normal, otherwise.normal);
        merge(returned, then.returned);
        merge(returned, otherwise.returned);
      }
    }
    return { normal, returned };
  };
  walk(body, new Set([false]));
  return [...issues];
}
