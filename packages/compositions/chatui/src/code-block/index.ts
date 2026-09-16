import { CodeBlockContent } from './content.proto';
import { CodeBlockHeader } from './header.proto';
import { CodeBlockRoot } from './root.proto';

export type {
  CodeBlockContentExposes,
  CodeBlockContentProps,
  CodeBlockHeaderExposes,
  CodeBlockHeaderProps,
  CodeBlockRootExposes,
  CodeBlockRootProps,
} from './types';

export const CodeBlock = {
  Root: CodeBlockRoot,
  Header: CodeBlockHeader,
  Content: CodeBlockContent,
} as const;
