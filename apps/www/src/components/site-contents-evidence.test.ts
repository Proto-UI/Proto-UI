import { describe, expect, it } from 'vitest';
import { assessViewport } from '../../scripts/capture-issue-1191-evidence.mjs';

function mobileObservation() {
  return {
    mobile: true,
    width: 390,
    fontSize: 16,
    document: {
      viewport: { width: 390, height: 844 },
      rootFont: 16,
      documentWidth: 390,
      treeCount: 1,
      sameTree: true,
      sameLinks: true,
      sameDetails: true,
      sameCurrent: true,
      header: { rect: { bottom: 56 } },
      article: { visible: true, rect: { left: 16, right: 374, width: 358 } },
      toc: {
        visible: false,
        expectedVisible: false,
        rect: { left: 0, top: 0, width: 0, height: 0 },
        anchors: [] as Array<{ inLayout: boolean; width: number; height: number }>,
      },
    },
    panel: {
      controlsMatch: true,
      treeInContent: true,
      positioned: true,
      rect: { left: 8, top: 60, right: 382, bottom: 836, width: 374, height: 776 },
      visible: true,
      availableWidth: 374,
      availableHeight: 776,
      entryFocus: true,
      ariaModal: 'false',
      maskPresent: false,
      bodyScrollLocked: false,
      scrollOwners: [{ clientHeight: 776, scrollHeight: 3282 }],
      clientHeight: 776,
      scrollHeight: 3282,
    },
    scroll: { progress: true, documentStable: true },
    escape: { closed: true, focusReturned: true, homeRestored: true },
    outsideFocus: { closed: true, destinationPreserved: true, homeRestored: true },
    outsidePress: { closed: true, settingsReachable: true, homeRestored: true },
  };
}

describe('Issue1191 capture distinguishes observed failures from acceptance', () => {
  it('accepts measured visible nonmodal geometry, real scrolling and reason-sensitive close', () => {
    expect(assessViewport(mobileObservation())).toEqual([]);
  });

  it('rejects the original static, offscreen, unbounded panel despite one CSS scroll owner', () => {
    const row = mobileObservation();
    Object.assign(row.panel, {
      positioned: false,
      visible: false,
      availableWidth: null,
      availableHeight: null,
      entryFocus: false,
      clientHeight: 3282,
      scrollHeight: 3282,
      rect: { left: 0, top: 2200, right: 390, bottom: 5482, width: 390, height: 3282 },
    });
    row.scroll.progress = false;
    const failures = assessViewport(row);
    expect(failures).toContain('public Content remains in normal flow');
    expect(failures).toContain('available-space facts missing');
    expect(failures).toContain('Popover has no visible viewport intersection');
    expect(failures).toContain('Popover is outside the viewport or overlaps the Header');
    expect(failures).toContain('opening focus never entered Content');
    expect(failures).toContain('navigation lacks one bounded scroll owner');
    expect(failures).toContain('native wheel did not scroll only the navigation');
  });

  it('cannot turn CSS overflow or a body-scroll change into an actual panel-scroll pass', () => {
    const row = mobileObservation();
    row.scroll.progress = false;
    expect(assessViewport(row)).toContain('native wheel did not scroll only the navigation');
    row.scroll.progress = true;
    row.scroll.documentStable = false;
    expect(assessViewport(row)).toContain('native wheel did not scroll only the navigation');
  });

  it.each(['escape', 'outsideFocus', 'outsidePress'] as const)(
    'requires same-node home handback after %s',
    (reason) => {
      const row = mobileObservation();
      row[reason].homeRestored = false;
      expect(assessViewport(row).length).toBeGreaterThan(0);
    }
  );

  it('rejects outside-focus close that returns focus to the opener', () => {
    const row = mobileObservation();
    row.outsideFocus.destinationPreserved = false;
    expect(assessViewport(row)).toContain('outside focus close stole focus or lost the tree');
  });

  it('rejects a body scroll lock even when the role and mask look nonmodal', () => {
    const row = mobileObservation();
    row.panel.bodyScrollLocked = true;
    expect(assessViewport(row)).toContain('navigation became modal');
  });

  it('keeps hidden mobile TOC zero rectangles separate from visible desktop evidence', () => {
    const row = mobileObservation();
    expect(assessViewport(row)).toEqual([]);
    row.document.toc.expectedVisible = true;
    expect(assessViewport(row)).toContain('expected desktop TOC is hidden');
  });

  it('requires a measured desktop rail, positive TOC anchors and side-by-side article geometry', () => {
    const row = {
      ...mobileObservation(),
      mobile: false,
      desktop: { sidebarVisible: true, independentScroll: true },
    };
    row.document.viewport.width = 1440;
    row.document.documentWidth = 1440;
    Object.assign(row.document.toc, {
      visible: true,
      expectedVisible: true,
      rect: { left: 1100, top: 73, width: 288, height: 771 },
      anchors: [{ inLayout: true, width: 280, height: 24 }],
    });
    expect(assessViewport(row)).toEqual([]);
    row.document.toc.rect.left = 16;
    expect(assessViewport(row)).toContain('TOC is above/overlapping the article');
    row.document.toc.rect.left = 1100;
    row.document.toc.anchors[0]!.width = 0;
    expect(assessViewport(row)).toContain('desktop TOC contains a zero-area anchor');
    row.document.toc.anchors[0]!.width = 280;
    row.desktop.independentScroll = false;
    expect(assessViewport(row)).toContain('desktop rail scroll was not independently observed');
  });

  it('does not count absent measurements as successful observations', () => {
    expect(assessViewport({ mobile: true })).toContain('document geometry unmeasured');
    const row = mobileObservation();
    expect(assessViewport({ ...row, panel: undefined })).toContain(
      'public Popover geometry unmeasured'
    );
    expect(assessViewport({ ...row, scroll: undefined })).toContain(
      'native wheel did not scroll only the navigation'
    );
  });
});
