import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-message-scroller': formatCode(`
<div class="h-80 w-full max-w-md overflow-hidden rounded-xl border border-border">
  <proto-ui-shadcn-message-scroller-root id="chat-scroller" style-profile="rhea">
    <proto-ui-shadcn-message-scroller-viewport style-profile="rhea">
      <div class="flex flex-col gap-3 p-4 pb-14">
        <div>Every time our AI streams a reply, the whole thread jumps around.</div>
        <div>Message Scroller only auto-scrolls while the reader is already at the bottom.</div>
      </div>
    </proto-ui-shadcn-message-scroller-viewport>
    <proto-ui-shadcn-message-scroller-jump style-profile="rhea">
      <span aria-hidden="true">↓</span>
      <span class="sr-only">Jump to latest</span>
    </proto-ui-shadcn-message-scroller-jump>
  </proto-ui-shadcn-message-scroller-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#chat-scroller');
  setElementProps(root, { styleProfile: 'rhea', a11yLabel: 'Assistant conversation' });
</script>
    `),
    'demo-shadcn-message-scroller-live': formatCode(`
<div class="h-64 w-full max-w-md overflow-hidden rounded-xl border border-border">
  <proto-ui-shadcn-message-scroller-root id="live-scroller" style-profile="rhea">
    <proto-ui-shadcn-message-scroller-viewport id="live-viewport" style-profile="rhea">
      <div id="live-messages" class="flex flex-col gap-3 p-4 pb-14"></div>
    </proto-ui-shadcn-message-scroller-viewport>
    <proto-ui-shadcn-message-scroller-jump id="live-jump" style-profile="rhea">
      Jump to latest ↓
    </proto-ui-shadcn-message-scroller-jump>
  </proto-ui-shadcn-message-scroller-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#live-scroller');
  const jump = document.querySelector('#live-jump');
  setElementProps(root, { styleProfile: 'rhea', newContentCount: 0, a11yLabel: 'Live release feed' });
  setElementProps(jump, { styleProfile: 'rhea', size: 'pill' });
</script>
    `),
    'demo-shadcn-message-scroller-group': formatCode(`
<div class="h-72 w-full max-w-md overflow-hidden rounded-xl border border-border">
  <proto-ui-shadcn-message-scroller-root id="group-scroller" style-profile="rhea">
    <proto-ui-shadcn-message-scroller-viewport style-profile="rhea">
      <div class="flex flex-col gap-3 p-4 pb-14">
        <div>Maya: Staging build is green.</div>
        <div>— Marcus joined the channel —</div>
        <div>Marcus: Position holds steady while new rows append.</div>
      </div>
    </proto-ui-shadcn-message-scroller-viewport>
    <proto-ui-shadcn-message-scroller-jump id="group-jump" style-profile="rhea">
      2 new messages ↓
    </proto-ui-shadcn-message-scroller-jump>
  </proto-ui-shadcn-message-scroller-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#group-scroller'), {
    styleProfile: 'rhea',
    a11yLabel: 'Release channel messages',
    newContentCount: 2,
  });
  setElementProps(document.querySelector('#group-jump'), {
    styleProfile: 'rhea',
    size: 'pill',
  });
</script>
    `),
    'demo-shadcn-message-scroller-disabled': formatCode(`
<div class="h-56 w-full max-w-md overflow-hidden rounded-xl border border-border">
  <proto-ui-shadcn-message-scroller-root id="disabled-scroller" style-profile="rhea">
    <proto-ui-shadcn-message-scroller-viewport style-profile="rhea">
      <div class="flex flex-col gap-2.5 p-4 pb-14">
        <div>09:00 · Connected to support session #4821</div>
        <div>09:10 · Session marked resolved.</div>
      </div>
    </proto-ui-shadcn-message-scroller-viewport>
    <proto-ui-shadcn-message-scroller-jump id="disabled-jump" style-profile="rhea">
      Jump to latest ↓
    </proto-ui-shadcn-message-scroller-jump>
  </proto-ui-shadcn-message-scroller-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#disabled-scroller'), {
    styleProfile: 'rhea',
    a11yLabel: 'Support transcript',
    newContentCount: 3,
  });
  setElementProps(document.querySelector('#disabled-jump'), {
    styleProfile: 'rhea',
    size: 'pill',
    disabled: true,
  });
</script>
    `),
    'demo-brutalist-message-scroller': formatCode(`
<div class="h-96 w-full max-w-md">
  <proto-ui-brutalist-message-scroller-root id="brutalist-chat">
    <proto-ui-brutalist-message-scroller-viewport>
      <div class="flex flex-col gap-3 p-4 pb-16">
        <div>BF: Deploying to prod real quick.</div>
        <div>NK: It's 4:55 PM. On a Friday.</div>
      </div>
    </proto-ui-brutalist-message-scroller-viewport>
    <proto-ui-brutalist-message-scroller-jump>Scroll to end ↓</proto-ui-brutalist-message-scroller-jump>
  </proto-ui-brutalist-message-scroller-root>
</div>
    `),
    'demo-brutalist-message-scroller-add-messages': formatCode(`
<div class="h-72 w-full max-w-md">
  <proto-ui-brutalist-message-scroller-root id="brutalist-live">
    <proto-ui-brutalist-message-scroller-viewport>
      <div id="brutalist-list" class="flex flex-col gap-3 p-4 pb-16"></div>
    </proto-ui-brutalist-message-scroller-viewport>
    <proto-ui-brutalist-message-scroller-jump>Scroll to end ↓</proto-ui-brutalist-message-scroller-jump>
  </proto-ui-brutalist-message-scroller-root>
</div>
<proto-ui-brutalist-button id="brutalist-add">Add message</proto-ui-brutalist-button>
    `),
    'demo-brutalist-message-scroller-group': formatCode(`
<div class="h-72 w-full max-w-md">
  <proto-ui-brutalist-message-scroller-root id="brutalist-group">
    <proto-ui-brutalist-message-scroller-viewport>
      <div class="flex flex-col gap-2.5 p-4 pb-16">
        <div>BUILD LOG · #release-v3</div>
        <div>Marcus: Jump button settles +4px into its shadow on press.</div>
      </div>
    </proto-ui-brutalist-message-scroller-viewport>
    <proto-ui-brutalist-message-scroller-jump>2 new entries ↓</proto-ui-brutalist-message-scroller-jump>
  </proto-ui-brutalist-message-scroller-root>
</div>
    `),
    'demo-bootstrap-2-3-2-message-scroller': formatCode(`
<div class="h-72 w-full max-w-lg">
  <proto-ui-bootstrap-2-3-2-message-scroller-root id="bs-chat">
    <proto-ui-bootstrap-2-3-2-message-scroller-viewport>
      <div class="flex flex-col pb-12">
        <div><strong>Alice</strong>: Database migration finished on staging.</div>
        <div><strong>Bob</strong>: Verified the read replicas caught up cleanly.</div>
      </div>
    </proto-ui-bootstrap-2-3-2-message-scroller-viewport>
    <proto-ui-bootstrap-2-3-2-message-scroller-jump>Jump to latest ↓</proto-ui-bootstrap-2-3-2-message-scroller-jump>
  </proto-ui-bootstrap-2-3-2-message-scroller-root>
</div>
    `),
    'demo-bootstrap-2-3-2-message-scroller-live': formatCode(`
<div class="h-64 w-full max-w-lg">
  <proto-ui-bootstrap-2-3-2-message-scroller-root id="bs-live">
    <proto-ui-bootstrap-2-3-2-message-scroller-viewport>
      <div id="bs-log" class="flex flex-col pb-12"></div>
    </proto-ui-bootstrap-2-3-2-message-scroller-viewport>
    <proto-ui-bootstrap-2-3-2-message-scroller-jump>Jump to latest ↓</proto-ui-bootstrap-2-3-2-message-scroller-jump>
  </proto-ui-bootstrap-2-3-2-message-scroller-root>
</div>
<proto-ui-bootstrap-2-3-2-button id="bs-append">Append message</proto-ui-bootstrap-2-3-2-button>
    `),
    'demo-bootstrap-2-3-2-message-scroller-disabled': formatCode(`
<div class="h-56 w-full max-w-lg">
  <proto-ui-bootstrap-2-3-2-message-scroller-root id="bs-audit">
    <proto-ui-bootstrap-2-3-2-message-scroller-viewport>
      <div class="flex flex-col pb-12">
        <div>14:01 · Worker pool scaled to 6 instances</div>
        <div>14:11 · Metrics export resumed normally</div>
      </div>
    </proto-ui-bootstrap-2-3-2-message-scroller-viewport>
    <proto-ui-bootstrap-2-3-2-message-scroller-jump id="bs-jump">3 new entries ↓</proto-ui-bootstrap-2-3-2-message-scroller-jump>
  </proto-ui-bootstrap-2-3-2-message-scroller-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#bs-jump'), { disabled: true });
</script>
    `),
    'demo-liquid-glass-message-scroller': formatCode(`
<div class="h-80 w-full max-w-lg">
  <proto-ui-liquid-glass-message-scroller-root id="lg-chat">
    <proto-ui-liquid-glass-message-scroller-viewport>
      <div class="flex flex-col gap-3 p-4 pb-16">
        <div>Concentric neutral transcript layer beneath a floating Jump capsule.</div>
      </div>
    </proto-ui-liquid-glass-message-scroller-viewport>
    <proto-ui-liquid-glass-message-scroller-jump>Jump to latest ↓</proto-ui-liquid-glass-message-scroller-jump>
  </proto-ui-liquid-glass-message-scroller-root>
</div>
    `),
    'demo-liquid-glass-message-scroller-live': formatCode(`
<div class="h-72 w-full max-w-lg">
  <proto-ui-liquid-glass-message-scroller-root id="lg-live">
    <proto-ui-liquid-glass-message-scroller-viewport>
      <div id="lg-messages" class="flex flex-col gap-3 p-4 pb-16"></div>
    </proto-ui-liquid-glass-message-scroller-viewport>
    <proto-ui-liquid-glass-message-scroller-jump id="lg-jump">Jump to latest ↓</proto-ui-liquid-glass-message-scroller-jump>
  </proto-ui-liquid-glass-message-scroller-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#lg-jump'), { variant: 'prominent' });
</script>
    `),
    'demo-liquid-glass-message-scroller-prominence': formatCode(`
<div class="h-60 w-full max-w-lg">
  <proto-ui-liquid-glass-message-scroller-root id="lg-prom">
    <proto-ui-liquid-glass-message-scroller-viewport>
      <div class="flex flex-col gap-2.5 p-4 pb-16">
        <div>Toggle variant="regular" vs "prominent" and disabled contrast.</div>
      </div>
    </proto-ui-liquid-glass-message-scroller-viewport>
    <proto-ui-liquid-glass-message-scroller-jump id="lg-prom-jump">2 new notes ↓</proto-ui-liquid-glass-message-scroller-jump>
  </proto-ui-liquid-glass-message-scroller-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#lg-prom-jump'), { variant: 'prominent', disabled: false });
</script>
    `),
  },
  react: {
    'demo-shadcn-message-scroller': formatCode(`
import {
  ShadcnMessageScrollerRoot,
  ShadcnMessageScrollerViewport,
  ShadcnMessageScrollerJump,
} from '../proto-ui/components/react';

export function MessageScrollerDemo() {
  return (
    <div className="h-80 w-full max-w-md overflow-hidden rounded-xl border border-border">
      <ShadcnMessageScrollerRoot styleProfile="rhea" a11yLabel="Assistant conversation">
        <ShadcnMessageScrollerViewport styleProfile="rhea">
          <div className="flex flex-col gap-3 p-4 pb-14">
            <p>Every time our AI streams a reply, the whole thread jumps around.</p>
            <p>Message Scroller only auto-scrolls while the reader is already at the bottom.</p>
          </div>
        </ShadcnMessageScrollerViewport>
        <ShadcnMessageScrollerJump styleProfile="rhea">
          <span aria-hidden="true">↓</span>
          <span className="sr-only">Jump to latest</span>
        </ShadcnMessageScrollerJump>
      </ShadcnMessageScrollerRoot>
    </div>
  );
}
    `),
    'demo-shadcn-message-scroller-live': formatCode(`
import { useState } from 'react';
import {
  ShadcnButton,
  ShadcnMessageScrollerRoot,
  ShadcnMessageScrollerViewport,
  ShadcnMessageScrollerJump,
} from '../proto-ui/components/react';

export function LiveFeedDemo() {
  const [unread, setUnread] = useState(0);
  const [messages, setMessages] = useState([
    'Can you summarize what changed in the release branch?',
    'Scroll up, then append a reply to observe newContentCount.',
  ]);

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <div className="h-64 overflow-hidden rounded-xl border border-border">
        <ShadcnMessageScrollerRoot
          styleProfile="rhea"
          a11yLabel="Live release feed"
          newContentCount={unread}
        >
          <ShadcnMessageScrollerViewport styleProfile="rhea">
            <div className="flex flex-col gap-3 p-4 pb-14">
              {messages.map((text, index) => (
                <div key={index}>{text}</div>
              ))}
            </div>
          </ShadcnMessageScrollerViewport>
          <ShadcnMessageScrollerJump
            styleProfile="rhea"
            size="pill"
            onClick={() => setUnread(0)}
          >
            {unread > 0 ? \`\${unread} new messages ↓\` : 'Jump to latest ↓'}
          </ShadcnMessageScrollerJump>
        </ShadcnMessageScrollerRoot>
      </div>
      <ShadcnButton
        styleProfile="rhea"
        size="sm"
        onClick={() => {
          setMessages((prev) => [...prev, \`Reply #\${prev.length + 1}\`]);
          setUnread((count) => count + 1);
        }}
      >
        Append reply
      </ShadcnButton>
    </div>
  );
}
    `),
    'demo-shadcn-message-scroller-group': formatCode(`
import {
  ShadcnMessageScrollerRoot,
  ShadcnMessageScrollerViewport,
  ShadcnMessageScrollerJump,
} from '../proto-ui/components/react';

export function GroupChatDemo() {
  return (
    <div className="h-72 w-full max-w-md overflow-hidden rounded-xl border border-border">
      <ShadcnMessageScrollerRoot
        styleProfile="rhea"
        a11yLabel="Release channel messages"
        newContentCount={2}
      >
        <ShadcnMessageScrollerViewport styleProfile="rhea">
          <div className="flex flex-col gap-3 p-4 pb-14">
            <div>Maya: Staging build is green.</div>
            <div className="text-center text-xs text-muted-foreground">Marcus joined the channel</div>
            <div>Marcus: Position holds steady while new rows append.</div>
          </div>
        </ShadcnMessageScrollerViewport>
        <ShadcnMessageScrollerJump styleProfile="rhea" size="pill">
          2 new messages ↓
        </ShadcnMessageScrollerJump>
      </ShadcnMessageScrollerRoot>
    </div>
  );
}
    `),
    'demo-shadcn-message-scroller-disabled': formatCode(`
import { useState } from 'react';
import {
  ShadcnButton,
  ShadcnMessageScrollerRoot,
  ShadcnMessageScrollerViewport,
  ShadcnMessageScrollerJump,
} from '../proto-ui/components/react';

export function DisabledJumpDemo() {
  const [disabled, setDisabled] = useState(true);
  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <div className="h-56 overflow-hidden rounded-xl border border-border">
        <ShadcnMessageScrollerRoot
          styleProfile="rhea"
          a11yLabel="Support transcript"
          newContentCount={3}
        >
          <ShadcnMessageScrollerViewport styleProfile="rhea">
            <div className="flex flex-col gap-2.5 p-4 pb-14">
              <div>09:00 · Connected to support session #4821</div>
              <div>09:10 · Session marked resolved.</div>
            </div>
          </ShadcnMessageScrollerViewport>
          <ShadcnMessageScrollerJump styleProfile="rhea" size="pill" disabled={disabled}>
            Jump to latest ↓
          </ShadcnMessageScrollerJump>
        </ShadcnMessageScrollerRoot>
      </div>
      <ShadcnButton styleProfile="rhea" variant="outline" size="sm" onClick={() => setDisabled((v) => !v)}>
        {disabled ? 'Enable Jump' : 'Disable Jump'}
      </ShadcnButton>
    </div>
  );
}
    `),
    'demo-brutalist-message-scroller': formatCode(`
import {
  BrutalistMessageScrollerRoot,
  BrutalistMessageScrollerViewport,
  BrutalistMessageScrollerJump,
} from '../proto-ui/components/react';

export function BrutalistMessageScrollerDemo() {
  return (
    <div className="h-96 w-full max-w-md">
      <BrutalistMessageScrollerRoot a11yLabel="Team chat messages">
        <BrutalistMessageScrollerViewport>
          <div className="flex flex-col gap-3 p-4 pb-16">
            <div>BF: Deploying to prod real quick.</div>
            <div>NK: It's 4:55 PM. On a Friday.</div>
          </div>
        </BrutalistMessageScrollerViewport>
        <BrutalistMessageScrollerJump>Scroll to end ↓</BrutalistMessageScrollerJump>
      </BrutalistMessageScrollerRoot>
    </div>
  );
}
    `),
    'demo-brutalist-message-scroller-add-messages': formatCode(`
import { useState } from 'react';
import {
  BrutalistButton,
  BrutalistMessageScrollerRoot,
  BrutalistMessageScrollerViewport,
  BrutalistMessageScrollerJump,
} from '../proto-ui/components/react';

export function BrutalistAddMessagesDemo() {
  const [messages, setMessages] = useState(['Hey, are you around?', 'Yes, what is up?']);
  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <div className="h-72">
        <BrutalistMessageScrollerRoot a11yLabel="Add messages demo">
          <BrutalistMessageScrollerViewport>
            <div className="flex flex-col gap-3 p-4 pb-16">
              {messages.map((text, index) => (
                <div key={index}>{text}</div>
              ))}
            </div>
          </BrutalistMessageScrollerViewport>
          <BrutalistMessageScrollerJump>Scroll to end ↓</BrutalistMessageScrollerJump>
        </BrutalistMessageScrollerRoot>
      </div>
      <BrutalistButton onClick={() => setMessages((prev) => [...prev, \`Message #\${prev.length + 1}\`])}>
        Add message
      </BrutalistButton>
    </div>
  );
}
    `),
    'demo-brutalist-message-scroller-group': formatCode(`
import {
  BrutalistMessageScrollerRoot,
  BrutalistMessageScrollerViewport,
  BrutalistMessageScrollerJump,
} from '../proto-ui/components/react';

export function BrutalistGroupDemo() {
  return (
    <div className="h-72 w-full max-w-md">
      <BrutalistMessageScrollerRoot a11yLabel="Release log" newContentCount={2}>
        <BrutalistMessageScrollerViewport>
          <div className="flex flex-col gap-2.5 p-4 pb-16">
            <div>BUILD LOG · #release-v3</div>
            <div>Marcus: Jump button settles +4px into its shadow on press.</div>
          </div>
        </BrutalistMessageScrollerViewport>
        <BrutalistMessageScrollerJump>2 new entries ↓</BrutalistMessageScrollerJump>
      </BrutalistMessageScrollerRoot>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-message-scroller': formatCode(`
import {
  Bootstrap232MessageScrollerRoot,
  Bootstrap232MessageScrollerViewport,
  Bootstrap232MessageScrollerJump,
} from '../proto-ui/components/react';

export function BootstrapMessageScrollerDemo() {
  return (
    <div className="h-72 w-full max-w-lg">
      <Bootstrap232MessageScrollerRoot a11yLabel="Release room messages">
        <Bootstrap232MessageScrollerViewport>
          <div className="flex flex-col pb-12">
            <div><strong>Alice</strong>: Database migration finished on staging.</div>
            <div><strong>Bob</strong>: Verified the read replicas caught up cleanly.</div>
          </div>
        </Bootstrap232MessageScrollerViewport>
        <Bootstrap232MessageScrollerJump>Jump to latest ↓</Bootstrap232MessageScrollerJump>
      </Bootstrap232MessageScrollerRoot>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-message-scroller-live': formatCode(`
import { useState } from 'react';
import {
  Bootstrap232Button,
  Bootstrap232MessageScrollerRoot,
  Bootstrap232MessageScrollerViewport,
  Bootstrap232MessageScrollerJump,
} from '../proto-ui/components/react';

export function BootstrapLiveLogDemo() {
  const [logs, setLogs] = useState(['[Ops] Deployment window opened at 14:00 UTC.']);
  return (
    <div className="flex w-full max-w-lg flex-col gap-3">
      <div className="h-64">
        <Bootstrap232MessageScrollerRoot a11yLabel="Live operations log">
          <Bootstrap232MessageScrollerViewport>
            <div className="flex flex-col pb-12">
              {logs.map((line, index) => (
                <div key={index}>{line}</div>
              ))}
            </div>
          </Bootstrap232MessageScrollerViewport>
          <Bootstrap232MessageScrollerJump>Jump to latest ↓</Bootstrap232MessageScrollerJump>
        </Bootstrap232MessageScrollerRoot>
      </div>
      <Bootstrap232Button variant="primary" onClick={() => setLogs((prev) => [...prev, \`[CI] Check #\${prev.length + 1} passed.\`])}>
        Append message
      </Bootstrap232Button>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-message-scroller-disabled': formatCode(`
import {
  Bootstrap232MessageScrollerRoot,
  Bootstrap232MessageScrollerViewport,
  Bootstrap232MessageScrollerJump,
} from '../proto-ui/components/react';

export function BootstrapDisabledJumpDemo() {
  return (
    <div className="h-56 w-full max-w-lg">
      <Bootstrap232MessageScrollerRoot a11yLabel="Audit log" newContentCount={3}>
        <Bootstrap232MessageScrollerViewport>
          <div className="flex flex-col pb-12">
            <div>14:01 · Worker pool scaled to 6 instances</div>
            <div>14:11 · Metrics export resumed normally</div>
          </div>
        </Bootstrap232MessageScrollerViewport>
        <Bootstrap232MessageScrollerJump disabled>3 new entries ↓</Bootstrap232MessageScrollerJump>
      </Bootstrap232MessageScrollerRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-message-scroller': formatCode(`
import {
  LiquidGlassMessageScrollerRoot,
  LiquidGlassMessageScrollerViewport,
  LiquidGlassMessageScrollerJump,
} from '../proto-ui/components/react';

export function LiquidGlassMessageScrollerDemo() {
  return (
    <div className="h-80 w-full max-w-lg">
      <LiquidGlassMessageScrollerRoot a11yLabel="Design conversation">
        <LiquidGlassMessageScrollerViewport>
          <div className="flex flex-col gap-3 p-4 pb-16">
            <p>Concentric neutral transcript layer beneath a floating Jump capsule.</p>
          </div>
        </LiquidGlassMessageScrollerViewport>
        <LiquidGlassMessageScrollerJump>Jump to latest ↓</LiquidGlassMessageScrollerJump>
      </LiquidGlassMessageScrollerRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-message-scroller-live': formatCode(`
import { useState } from 'react';
import {
  LiquidGlassButton,
  LiquidGlassMessageScrollerRoot,
  LiquidGlassMessageScrollerViewport,
  LiquidGlassMessageScrollerJump,
} from '../proto-ui/components/react';

export function LiquidGlassLiveDemo() {
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState(['Scroll up, then tap Send reply to promote Jump.']);
  return (
    <div className="flex w-full max-w-lg flex-col gap-4">
      <div className="h-72">
        <LiquidGlassMessageScrollerRoot a11yLabel="Live messages" newContentCount={unread}>
          <LiquidGlassMessageScrollerViewport>
            <div className="flex flex-col gap-3 p-4 pb-16">
              {items.map((text, index) => (
                <div key={index}>{text}</div>
              ))}
            </div>
          </LiquidGlassMessageScrollerViewport>
          <LiquidGlassMessageScrollerJump
            variant={unread > 0 ? 'prominent' : 'regular'}
            onClick={() => setUnread(0)}
          >
            {unread > 0 ? \`\${unread} new messages ↓\` : 'Jump to latest ↓'}
          </LiquidGlassMessageScrollerJump>
        </LiquidGlassMessageScrollerRoot>
      </div>
      <LiquidGlassButton
        variant="prominent"
        onClick={() => {
          setItems((prev) => [...prev, \`Reply #\${prev.length + 1}\`]);
          setUnread((count) => count + 1);
        }}
      >
        Send reply
      </LiquidGlassButton>
    </div>
  );
}
    `),
    'demo-liquid-glass-message-scroller-prominence': formatCode(`
import {
  LiquidGlassMessageScrollerRoot,
  LiquidGlassMessageScrollerViewport,
  LiquidGlassMessageScrollerJump,
} from '../proto-ui/components/react';

export function LiquidGlassProminenceDemo() {
  return (
    <div className="h-60 w-full max-w-lg">
      <LiquidGlassMessageScrollerRoot a11yLabel="Prominence notes" newContentCount={2}>
        <LiquidGlassMessageScrollerViewport>
          <div className="flex flex-col gap-2.5 p-4 pb-16">
            <div>Toggle variant="regular" vs "prominent" and disabled contrast.</div>
          </div>
        </LiquidGlassMessageScrollerViewport>
        <LiquidGlassMessageScrollerJump variant="prominent">
          2 new notes ↓
        </LiquidGlassMessageScrollerJump>
      </LiquidGlassMessageScrollerRoot>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-message-scroller': formatCode(`
<script setup lang="ts">
import {
  ShadcnMessageScrollerRoot,
  ShadcnMessageScrollerViewport,
  ShadcnMessageScrollerJump,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="h-80 w-full max-w-md overflow-hidden rounded-xl border border-border">
    <ShadcnMessageScrollerRoot styleProfile="rhea" a11yLabel="Assistant conversation">
      <ShadcnMessageScrollerViewport styleProfile="rhea">
        <div class="flex flex-col gap-3 p-4 pb-14">
          <p>Every time our AI streams a reply, the whole thread jumps around.</p>
          <p>Message Scroller only auto-scrolls while the reader is already at the bottom.</p>
        </div>
      </ShadcnMessageScrollerViewport>
      <ShadcnMessageScrollerJump styleProfile="rhea">
        <span aria-hidden="true">↓</span>
        <span class="sr-only">Jump to latest</span>
      </ShadcnMessageScrollerJump>
    </ShadcnMessageScrollerRoot>
  </div>
</template>
    `),
    'demo-shadcn-message-scroller-live': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  ShadcnButton,
  ShadcnMessageScrollerRoot,
  ShadcnMessageScrollerViewport,
  ShadcnMessageScrollerJump,
} from '../proto-ui/components/vue';

const unread = ref(0);
const messages = ref(['Can you summarize what changed in the release branch?']);
const append = () => {
  messages.value.push(\`Reply #\${messages.value.length + 1}\`);
  unread.value += 1;
};
</script>

<template>
  <div class="flex w-full max-w-md flex-col gap-3">
    <div class="h-64 overflow-hidden rounded-xl border border-border">
      <ShadcnMessageScrollerRoot styleProfile="rhea" a11yLabel="Live release feed" :newContentCount="unread">
        <ShadcnMessageScrollerViewport styleProfile="rhea">
          <div class="flex flex-col gap-3 p-4 pb-14">
            <div v-for="(text, index) in messages" :key="index">{{ text }}</div>
          </div>
        </ShadcnMessageScrollerViewport>
        <ShadcnMessageScrollerJump styleProfile="rhea" size="pill" @click="unread = 0">
          {{ unread > 0 ? \`\${unread} new messages ↓\` : 'Jump to latest ↓' }}
        </ShadcnMessageScrollerJump>
      </ShadcnMessageScrollerRoot>
    </div>
    <ShadcnButton styleProfile="rhea" size="sm" @click="append">Append reply</ShadcnButton>
  </div>
</template>
    `),
    'demo-shadcn-message-scroller-group': formatCode(`
<script setup lang="ts">
import {
  ShadcnMessageScrollerRoot,
  ShadcnMessageScrollerViewport,
  ShadcnMessageScrollerJump,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="h-72 w-full max-w-md overflow-hidden rounded-xl border border-border">
    <ShadcnMessageScrollerRoot styleProfile="rhea" a11yLabel="Release channel messages" :newContentCount="2">
      <ShadcnMessageScrollerViewport styleProfile="rhea">
        <div class="flex flex-col gap-3 p-4 pb-14">
          <div>Maya: Staging build is green.</div>
          <div>Marcus joined the channel</div>
        </div>
      </ShadcnMessageScrollerViewport>
      <ShadcnMessageScrollerJump styleProfile="rhea" size="pill">2 new messages ↓</ShadcnMessageScrollerJump>
    </ShadcnMessageScrollerRoot>
  </div>
</template>
    `),
    'demo-shadcn-message-scroller-disabled': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  ShadcnButton,
  ShadcnMessageScrollerRoot,
  ShadcnMessageScrollerViewport,
  ShadcnMessageScrollerJump,
} from '../proto-ui/components/vue';

const disabled = ref(true);
</script>

<template>
  <div class="flex w-full max-w-md flex-col gap-3">
    <div class="h-56 overflow-hidden rounded-xl border border-border">
      <ShadcnMessageScrollerRoot styleProfile="rhea" a11yLabel="Support transcript" :newContentCount="3">
        <ShadcnMessageScrollerViewport styleProfile="rhea">
          <div class="flex flex-col gap-2.5 p-4 pb-14">
            <div>09:00 · Connected to support session #4821</div>
            <div>09:10 · Session marked resolved.</div>
          </div>
        </ShadcnMessageScrollerViewport>
        <ShadcnMessageScrollerJump styleProfile="rhea" size="pill" :disabled="disabled">
          Jump to latest ↓
        </ShadcnMessageScrollerJump>
      </ShadcnMessageScrollerRoot>
    </div>
    <ShadcnButton styleProfile="rhea" variant="outline" size="sm" @click="disabled = !disabled">
      {{ disabled ? 'Enable Jump' : 'Disable Jump' }}
    </ShadcnButton>
  </div>
</template>
    `),
    'demo-brutalist-message-scroller': formatCode(`
<script setup lang="ts">
import {
  BrutalistMessageScrollerRoot,
  BrutalistMessageScrollerViewport,
  BrutalistMessageScrollerJump,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="h-96 w-full max-w-md">
    <BrutalistMessageScrollerRoot a11yLabel="Team chat messages">
      <BrutalistMessageScrollerViewport>
        <div class="flex flex-col gap-3 p-4 pb-16">
          <div>BF: Deploying to prod real quick.</div>
          <div>NK: It's 4:55 PM. On a Friday.</div>
        </div>
      </BrutalistMessageScrollerViewport>
      <BrutalistMessageScrollerJump>Scroll to end ↓</BrutalistMessageScrollerJump>
    </BrutalistMessageScrollerRoot>
  </div>
</template>
    `),
    'demo-brutalist-message-scroller-add-messages': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  BrutalistButton,
  BrutalistMessageScrollerRoot,
  BrutalistMessageScrollerViewport,
  BrutalistMessageScrollerJump,
} from '../proto-ui/components/vue';

const messages = ref(['Hey, are you around?', 'Yes, what is up?']);
</script>

<template>
  <div class="flex w-full max-w-md flex-col gap-3">
    <div class="h-72">
      <BrutalistMessageScrollerRoot a11yLabel="Add messages demo">
        <BrutalistMessageScrollerViewport>
          <div class="flex flex-col gap-3 p-4 pb-16">
            <div v-for="(text, index) in messages" :key="index">{{ text }}</div>
          </div>
        </BrutalistMessageScrollerViewport>
        <BrutalistMessageScrollerJump>Scroll to end ↓</BrutalistMessageScrollerJump>
      </BrutalistMessageScrollerRoot>
    </div>
    <BrutalistButton @click="messages.push(\`Message #\${messages.length + 1}\`)">Add message</BrutalistButton>
  </div>
</template>
    `),
    'demo-brutalist-message-scroller-group': formatCode(`
<script setup lang="ts">
import {
  BrutalistMessageScrollerRoot,
  BrutalistMessageScrollerViewport,
  BrutalistMessageScrollerJump,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="h-72 w-full max-w-md">
    <BrutalistMessageScrollerRoot a11yLabel="Release log" :newContentCount="2">
      <BrutalistMessageScrollerViewport>
        <div class="flex flex-col gap-2.5 p-4 pb-16">
          <div>BUILD LOG · #release-v3</div>
          <div>Marcus: Jump button settles +4px into its shadow on press.</div>
        </div>
      </BrutalistMessageScrollerViewport>
      <BrutalistMessageScrollerJump>2 new entries ↓</BrutalistMessageScrollerJump>
    </BrutalistMessageScrollerRoot>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-message-scroller': formatCode(`
<script setup lang="ts">
import {
  Bootstrap232MessageScrollerRoot,
  Bootstrap232MessageScrollerViewport,
  Bootstrap232MessageScrollerJump,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="h-72 w-full max-w-lg">
    <Bootstrap232MessageScrollerRoot a11yLabel="Release room messages">
      <Bootstrap232MessageScrollerViewport>
        <div class="flex flex-col pb-12">
          <div><strong>Alice</strong>: Database migration finished on staging.</div>
          <div><strong>Bob</strong>: Verified the read replicas caught up cleanly.</div>
        </div>
      </Bootstrap232MessageScrollerViewport>
      <Bootstrap232MessageScrollerJump>Jump to latest ↓</Bootstrap232MessageScrollerJump>
    </Bootstrap232MessageScrollerRoot>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-message-scroller-live': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  Bootstrap232Button,
  Bootstrap232MessageScrollerRoot,
  Bootstrap232MessageScrollerViewport,
  Bootstrap232MessageScrollerJump,
} from '../proto-ui/components/vue';

const logs = ref(['[Ops] Deployment window opened at 14:00 UTC.']);
</script>

<template>
  <div class="flex w-full max-w-lg flex-col gap-3">
    <div class="h-64">
      <Bootstrap232MessageScrollerRoot a11yLabel="Live operations log">
        <Bootstrap232MessageScrollerViewport>
          <div class="flex flex-col pb-12">
            <div v-for="(line, index) in logs" :key="index">{{ line }}</div>
          </div>
        </Bootstrap232MessageScrollerViewport>
        <Bootstrap232MessageScrollerJump>Jump to latest ↓</Bootstrap232MessageScrollerJump>
      </Bootstrap232MessageScrollerRoot>
    </div>
    <Bootstrap232Button variant="primary" @click="logs.push(\`[CI] Check #\${logs.length + 1} passed.\`)">
      Append message
    </Bootstrap232Button>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-message-scroller-disabled': formatCode(`
<script setup lang="ts">
import {
  Bootstrap232MessageScrollerRoot,
  Bootstrap232MessageScrollerViewport,
  Bootstrap232MessageScrollerJump,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="h-56 w-full max-w-lg">
    <Bootstrap232MessageScrollerRoot a11yLabel="Audit log" :newContentCount="3">
      <Bootstrap232MessageScrollerViewport>
        <div class="flex flex-col pb-12">
          <div>14:01 · Worker pool scaled to 6 instances</div>
          <div>14:11 · Metrics export resumed normally</div>
        </div>
      </Bootstrap232MessageScrollerViewport>
      <Bootstrap232MessageScrollerJump :disabled="true">3 new entries ↓</Bootstrap232MessageScrollerJump>
    </Bootstrap232MessageScrollerRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-message-scroller': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassMessageScrollerRoot,
  LiquidGlassMessageScrollerViewport,
  LiquidGlassMessageScrollerJump,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="h-80 w-full max-w-lg">
    <LiquidGlassMessageScrollerRoot a11yLabel="Design conversation">
      <LiquidGlassMessageScrollerViewport>
        <div class="flex flex-col gap-3 p-4 pb-16">
          <p>Concentric neutral transcript layer beneath a floating Jump capsule.</p>
        </div>
      </LiquidGlassMessageScrollerViewport>
      <LiquidGlassMessageScrollerJump>Jump to latest ↓</LiquidGlassMessageScrollerJump>
    </LiquidGlassMessageScrollerRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-message-scroller-live': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  LiquidGlassButton,
  LiquidGlassMessageScrollerRoot,
  LiquidGlassMessageScrollerViewport,
  LiquidGlassMessageScrollerJump,
} from '../proto-ui/components/vue';

const unread = ref(0);
const items = ref(['Scroll up, then tap Send reply to promote Jump.']);
</script>

<template>
  <div class="flex w-full max-w-lg flex-col gap-4">
    <div class="h-72">
      <LiquidGlassMessageScrollerRoot a11yLabel="Live messages" :newContentCount="unread">
        <LiquidGlassMessageScrollerViewport>
          <div class="flex flex-col gap-3 p-4 pb-16">
            <div v-for="(text, index) in items" :key="index">{{ text }}</div>
          </div>
        </LiquidGlassMessageScrollerViewport>
        <LiquidGlassMessageScrollerJump :variant="unread > 0 ? 'prominent' : 'regular'" @click="unread = 0">
          {{ unread > 0 ? \`\${unread} new messages ↓\` : 'Jump to latest ↓' }}
        </LiquidGlassMessageScrollerJump>
      </LiquidGlassMessageScrollerRoot>
    </div>
    <LiquidGlassButton variant="prominent" @click="items.push(\`Reply #\${items.length + 1}\`); unread++">
      Send reply
    </LiquidGlassButton>
  </div>
</template>
    `),
    'demo-liquid-glass-message-scroller-prominence': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassMessageScrollerRoot,
  LiquidGlassMessageScrollerViewport,
  LiquidGlassMessageScrollerJump,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="h-60 w-full max-w-lg">
    <LiquidGlassMessageScrollerRoot a11yLabel="Prominence notes" :newContentCount="2">
      <LiquidGlassMessageScrollerViewport>
        <div class="flex flex-col gap-2.5 p-4 pb-16">
          <div>Toggle variant="regular" vs "prominent" and disabled contrast.</div>
        </div>
      </LiquidGlassMessageScrollerViewport>
      <LiquidGlassMessageScrollerJump variant="prominent">
        2 new notes ↓
      </LiquidGlassMessageScrollerJump>
    </LiquidGlassMessageScrollerRoot>
  </div>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-message-scroller': formatCode(`
<template>
  <div class="h-80 w-full max-w-md overflow-hidden rounded-xl border border-border">
    <ShadcnMessageScrollerRoot styleProfile="rhea" a11yLabel="Assistant conversation">
      <ShadcnMessageScrollerViewport styleProfile="rhea">
        <div class="flex flex-col gap-3 p-4 pb-14">
          <p>Every time our AI streams a reply, the whole thread jumps around.</p>
          <p>Message Scroller only auto-scrolls while the reader is already at the bottom.</p>
        </div>
      </ShadcnMessageScrollerViewport>
      <ShadcnMessageScrollerJump styleProfile="rhea">
        <span aria-hidden="true">↓</span>
        <span class="sr-only">Jump to latest</span>
      </ShadcnMessageScrollerJump>
    </ShadcnMessageScrollerRoot>
  </div>
</template>

<script>
import {
  ShadcnMessageScrollerRoot,
  ShadcnMessageScrollerViewport,
  ShadcnMessageScrollerJump,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnMessageScrollerRoot,
    ShadcnMessageScrollerViewport,
    ShadcnMessageScrollerJump,
  },
};
</script>
    `),
    'demo-shadcn-message-scroller-live': formatCode(`
<template>
  <div class="flex w-full max-w-md flex-col gap-3">
    <div class="h-64 overflow-hidden rounded-xl border border-border">
      <ShadcnMessageScrollerRoot styleProfile="rhea" a11yLabel="Live release feed" :newContentCount="unread">
        <ShadcnMessageScrollerViewport styleProfile="rhea">
          <div class="flex flex-col gap-3 p-4 pb-14">
            <div v-for="(text, index) in messages" :key="index">{{ text }}</div>
          </div>
        </ShadcnMessageScrollerViewport>
        <ShadcnMessageScrollerJump styleProfile="rhea" size="pill" @click="unread = 0">
          {{ unread > 0 ? unread + ' new messages ↓' : 'Jump to latest ↓' }}
        </ShadcnMessageScrollerJump>
      </ShadcnMessageScrollerRoot>
    </div>
    <ShadcnButton styleProfile="rhea" size="sm" @click="append">Append reply</ShadcnButton>
  </div>
</template>

<script>
import {
  ShadcnButton,
  ShadcnMessageScrollerRoot,
  ShadcnMessageScrollerViewport,
  ShadcnMessageScrollerJump,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
    ShadcnMessageScrollerRoot,
    ShadcnMessageScrollerViewport,
    ShadcnMessageScrollerJump,
  },
  data() {
    return {
      unread: 0,
      messages: ['Can you summarize what changed in the release branch?'],
    };
  },
  methods: {
    append() {
      this.messages.push('Reply #' + (this.messages.length + 1));
      this.unread += 1;
    },
  },
};
</script>
    `),
    'demo-shadcn-message-scroller-group': formatCode(`
<template>
  <div class="h-72 w-full max-w-md overflow-hidden rounded-xl border border-border">
    <ShadcnMessageScrollerRoot styleProfile="rhea" a11yLabel="Release channel messages" :newContentCount="2">
      <ShadcnMessageScrollerViewport styleProfile="rhea">
        <div class="flex flex-col gap-3 p-4 pb-14">
          <div>Maya: Staging build is green.</div>
          <div>Marcus joined the channel</div>
        </div>
      </ShadcnMessageScrollerViewport>
      <ShadcnMessageScrollerJump styleProfile="rhea" size="pill">2 new messages ↓</ShadcnMessageScrollerJump>
    </ShadcnMessageScrollerRoot>
  </div>
</template>

<script>
import {
  ShadcnMessageScrollerRoot,
  ShadcnMessageScrollerViewport,
  ShadcnMessageScrollerJump,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnMessageScrollerRoot,
    ShadcnMessageScrollerViewport,
    ShadcnMessageScrollerJump,
  },
};
</script>
    `),
    'demo-shadcn-message-scroller-disabled': formatCode(`
<template>
  <div class="flex w-full max-w-md flex-col gap-3">
    <div class="h-56 overflow-hidden rounded-xl border border-border">
      <ShadcnMessageScrollerRoot styleProfile="rhea" a11yLabel="Support transcript" :newContentCount="3">
        <ShadcnMessageScrollerViewport styleProfile="rhea">
          <div class="flex flex-col gap-2.5 p-4 pb-14">
            <div>09:00 · Connected to support session #4821</div>
            <div>09:10 · Session marked resolved.</div>
          </div>
        </ShadcnMessageScrollerViewport>
        <ShadcnMessageScrollerJump styleProfile="rhea" size="pill" :disabled="disabled">
          Jump to latest ↓
        </ShadcnMessageScrollerJump>
      </ShadcnMessageScrollerRoot>
    </div>
    <ShadcnButton styleProfile="rhea" variant="outline" size="sm" @click="disabled = !disabled">
      {{ disabled ? 'Enable Jump' : 'Disable Jump' }}
    </ShadcnButton>
  </div>
</template>

<script>
import {
  ShadcnButton,
  ShadcnMessageScrollerRoot,
  ShadcnMessageScrollerViewport,
  ShadcnMessageScrollerJump,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
    ShadcnMessageScrollerRoot,
    ShadcnMessageScrollerViewport,
    ShadcnMessageScrollerJump,
  },
  data() {
    return { disabled: true };
  },
};
</script>
    `),
    'demo-brutalist-message-scroller': formatCode(`
<template>
  <div class="h-96 w-full max-w-md">
    <BrutalistMessageScrollerRoot a11yLabel="Team chat messages">
      <BrutalistMessageScrollerViewport>
        <div class="flex flex-col gap-3 p-4 pb-16">
          <div>BF: Deploying to prod real quick.</div>
          <div>NK: It's 4:55 PM. On a Friday.</div>
        </div>
      </BrutalistMessageScrollerViewport>
      <BrutalistMessageScrollerJump>Scroll to end ↓</BrutalistMessageScrollerJump>
    </BrutalistMessageScrollerRoot>
  </div>
</template>

<script>
import {
  BrutalistMessageScrollerRoot,
  BrutalistMessageScrollerViewport,
  BrutalistMessageScrollerJump,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistMessageScrollerRoot,
    BrutalistMessageScrollerViewport,
    BrutalistMessageScrollerJump,
  },
};
</script>
    `),
    'demo-brutalist-message-scroller-add-messages': formatCode(`
<template>
  <div class="flex w-full max-w-md flex-col gap-3">
    <div class="h-72">
      <BrutalistMessageScrollerRoot a11yLabel="Add messages demo">
        <BrutalistMessageScrollerViewport>
          <div class="flex flex-col gap-3 p-4 pb-16">
            <div v-for="(text, index) in messages" :key="index">{{ text }}</div>
          </div>
        </BrutalistMessageScrollerViewport>
        <BrutalistMessageScrollerJump>Scroll to end ↓</BrutalistMessageScrollerJump>
      </BrutalistMessageScrollerRoot>
    </div>
    <BrutalistButton @click="add">Add message</BrutalistButton>
  </div>
</template>

<script>
import {
  BrutalistButton,
  BrutalistMessageScrollerRoot,
  BrutalistMessageScrollerViewport,
  BrutalistMessageScrollerJump,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistButton,
    BrutalistMessageScrollerRoot,
    BrutalistMessageScrollerViewport,
    BrutalistMessageScrollerJump,
  },
  data() {
    return { messages: ['Hey, are you around?', 'Yes, what is up?'] };
  },
  methods: {
    add() {
      this.messages.push('Message #' + (this.messages.length + 1));
    },
  },
};
</script>
    `),
    'demo-brutalist-message-scroller-group': formatCode(`
<template>
  <div class="h-72 w-full max-w-md">
    <BrutalistMessageScrollerRoot a11yLabel="Release log" :newContentCount="2">
      <BrutalistMessageScrollerViewport>
        <div class="flex flex-col gap-2.5 p-4 pb-16">
          <div>BUILD LOG · #release-v3</div>
          <div>Marcus: Jump button settles +4px into its shadow on press.</div>
        </div>
      </BrutalistMessageScrollerViewport>
      <BrutalistMessageScrollerJump>2 new entries ↓</BrutalistMessageScrollerJump>
    </BrutalistMessageScrollerRoot>
  </div>
</template>

<script>
import {
  BrutalistMessageScrollerRoot,
  BrutalistMessageScrollerViewport,
  BrutalistMessageScrollerJump,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistMessageScrollerRoot,
    BrutalistMessageScrollerViewport,
    BrutalistMessageScrollerJump,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-message-scroller': formatCode(`
<template>
  <div class="h-72 w-full max-w-lg">
    <Bootstrap232MessageScrollerRoot a11yLabel="Release room messages">
      <Bootstrap232MessageScrollerViewport>
        <div class="flex flex-col pb-12">
          <div><strong>Alice</strong>: Database migration finished on staging.</div>
          <div><strong>Bob</strong>: Verified the read replicas caught up cleanly.</div>
        </div>
      </Bootstrap232MessageScrollerViewport>
      <Bootstrap232MessageScrollerJump>Jump to latest ↓</Bootstrap232MessageScrollerJump>
    </Bootstrap232MessageScrollerRoot>
  </div>
</template>

<script>
import {
  Bootstrap232MessageScrollerRoot,
  Bootstrap232MessageScrollerViewport,
  Bootstrap232MessageScrollerJump,
} from '../proto-ui/components/vue2';

export default {
  components: {
    Bootstrap232MessageScrollerRoot,
    Bootstrap232MessageScrollerViewport,
    Bootstrap232MessageScrollerJump,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-message-scroller-live': formatCode(`
<template>
  <div class="flex w-full max-w-lg flex-col gap-3">
    <div class="h-64">
      <Bootstrap232MessageScrollerRoot a11yLabel="Live operations log">
        <Bootstrap232MessageScrollerViewport>
          <div class="flex flex-col pb-12">
            <div v-for="(line, index) in logs" :key="index">{{ line }}</div>
          </div>
        </Bootstrap232MessageScrollerViewport>
        <Bootstrap232MessageScrollerJump>Jump to latest ↓</Bootstrap232MessageScrollerJump>
      </Bootstrap232MessageScrollerRoot>
    </div>
    <Bootstrap232Button variant="primary" @click="append">Append message</Bootstrap232Button>
  </div>
</template>

<script>
import {
  Bootstrap232Button,
  Bootstrap232MessageScrollerRoot,
  Bootstrap232MessageScrollerViewport,
  Bootstrap232MessageScrollerJump,
} from '../proto-ui/components/vue2';

export default {
  components: {
    Bootstrap232Button,
    Bootstrap232MessageScrollerRoot,
    Bootstrap232MessageScrollerViewport,
    Bootstrap232MessageScrollerJump,
  },
  data() {
    return { logs: ['[Ops] Deployment window opened at 14:00 UTC.'] };
  },
  methods: {
    append() {
      this.logs.push('[CI] Check #' + (this.logs.length + 1) + ' passed.');
    },
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-message-scroller-disabled': formatCode(`
<template>
  <div class="h-56 w-full max-w-lg">
    <Bootstrap232MessageScrollerRoot a11yLabel="Audit log" :newContentCount="3">
      <Bootstrap232MessageScrollerViewport>
        <div class="flex flex-col pb-12">
          <div>14:01 · Worker pool scaled to 6 instances</div>
          <div>14:11 · Metrics export resumed normally</div>
        </div>
      </Bootstrap232MessageScrollerViewport>
      <Bootstrap232MessageScrollerJump :disabled="true">3 new entries ↓</Bootstrap232MessageScrollerJump>
    </Bootstrap232MessageScrollerRoot>
  </div>
</template>

<script>
import {
  Bootstrap232MessageScrollerRoot,
  Bootstrap232MessageScrollerViewport,
  Bootstrap232MessageScrollerJump,
} from '../proto-ui/components/vue2';

export default {
  components: {
    Bootstrap232MessageScrollerRoot,
    Bootstrap232MessageScrollerViewport,
    Bootstrap232MessageScrollerJump,
  },
};
</script>
    `),
    'demo-liquid-glass-message-scroller': formatCode(`
<template>
  <div class="h-80 w-full max-w-lg">
    <LiquidGlassMessageScrollerRoot a11yLabel="Design conversation">
      <LiquidGlassMessageScrollerViewport>
        <div class="flex flex-col gap-3 p-4 pb-16">
          <p>Concentric neutral transcript layer beneath a floating Jump capsule.</p>
        </div>
      </LiquidGlassMessageScrollerViewport>
      <LiquidGlassMessageScrollerJump>Jump to latest ↓</LiquidGlassMessageScrollerJump>
    </LiquidGlassMessageScrollerRoot>
  </div>
</template>

<script>
import {
  LiquidGlassMessageScrollerRoot,
  LiquidGlassMessageScrollerViewport,
  LiquidGlassMessageScrollerJump,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassMessageScrollerRoot,
    LiquidGlassMessageScrollerViewport,
    LiquidGlassMessageScrollerJump,
  },
};
</script>
    `),
    'demo-liquid-glass-message-scroller-live': formatCode(`
<template>
  <div class="flex w-full max-w-lg flex-col gap-4">
    <div class="h-72">
      <LiquidGlassMessageScrollerRoot a11yLabel="Live messages" :newContentCount="unread">
        <LiquidGlassMessageScrollerViewport>
          <div class="flex flex-col gap-3 p-4 pb-16">
            <div v-for="(text, index) in items" :key="index">{{ text }}</div>
          </div>
        </LiquidGlassMessageScrollerViewport>
        <LiquidGlassMessageScrollerJump :variant="unread > 0 ? 'prominent' : 'regular'" @click="unread = 0">
          {{ unread > 0 ? unread + ' new messages ↓' : 'Jump to latest ↓' }}
        </LiquidGlassMessageScrollerJump>
      </LiquidGlassMessageScrollerRoot>
    </div>
    <LiquidGlassButton variant="prominent" @click="send">Send reply</LiquidGlassButton>
  </div>
</template>

<script>
import {
  LiquidGlassButton,
  LiquidGlassMessageScrollerRoot,
  LiquidGlassMessageScrollerViewport,
  LiquidGlassMessageScrollerJump,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassButton,
    LiquidGlassMessageScrollerRoot,
    LiquidGlassMessageScrollerViewport,
    LiquidGlassMessageScrollerJump,
  },
  data() {
    return {
      unread: 0,
      items: ['Scroll up, then tap Send reply to promote Jump.'],
    };
  },
  methods: {
    send() {
      this.items.push('Reply #' + (this.items.length + 1));
      this.unread += 1;
    },
  },
};
</script>
    `),
    'demo-liquid-glass-message-scroller-prominence': formatCode(`
<template>
  <div class="h-60 w-full max-w-lg">
    <LiquidGlassMessageScrollerRoot a11yLabel="Prominence notes" :newContentCount="2">
      <LiquidGlassMessageScrollerViewport>
        <div class="flex flex-col gap-2.5 p-4 pb-16">
          <div>Toggle variant="regular" vs "prominent" and disabled contrast.</div>
        </div>
      </LiquidGlassMessageScrollerViewport>
      <LiquidGlassMessageScrollerJump variant="prominent">
        2 new notes ↓
      </LiquidGlassMessageScrollerJump>
    </LiquidGlassMessageScrollerRoot>
  </div>
</template>

<script>
import {
  LiquidGlassMessageScrollerRoot,
  LiquidGlassMessageScrollerViewport,
  LiquidGlassMessageScrollerJump,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassMessageScrollerRoot,
    LiquidGlassMessageScrollerViewport,
    LiquidGlassMessageScrollerJump,
  },
};
</script>
    `),
  },
};
