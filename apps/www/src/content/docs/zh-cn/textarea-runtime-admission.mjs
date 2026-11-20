// Private read-only observation helper; derived from candidate 3992ae27691ae65d52138e00681d27177623fcb4.
// Evaluate before timeout teardown using the same Page, previewer ID and runtime.
// This does not run a test, change the DOM or extend the runtime-admission deadline.
export async function observeTextareaRuntimeAdmission(page, { previewerId, runtime }) {
    return page.evaluate(({ previewerId, expectedCount: count, readySelector: selector, runtime: selectedRuntime, label, }) => {
        const diagnose = (passed, sourceLine) => {
            const previewers = [...document.querySelectorAll(`[data-previewer-id=${JSON.stringify(previewerId)}]`)];
            const preview = previewers[0];
            const attrs = (element) => element ? Object.fromEntries([...element.attributes].map(a => [a.name, a.value])) : null;
            const elements = (selector) => [...(preview?.querySelectorAll(selector) ?? [])].map(element => ({
                tag: element.tagName,
                attributes: attrs(element),
                connected: element.isConnected,
                display: getComputedStyle(element).display,
                visibility: getComputedStyle(element).visibility,
            }));
            return {
                passed, sourceLine, requestedRuntime: selectedRuntime, expectedCount: count, readySelector: selector,
                observedAt: new Date().toISOString(), previewerCount: previewers.length, previewerAttributes: attrs(preview),
                committedRuntime: preview?.__previewer__?.getCurrentRuntime?.() ?? null,
                hosts: elements('.host'),
                scopes: elements('[data-projection-scope]'),
                generations: elements('[data-projection-generation-state]'),
                runtimeControls: elements('[data-projection-control="runtime"], [data-runtime-tabs-root], [data-adapter-select-root]'),
                selectedTabs: elements('[role="tab"][aria-selected="true"]'),
                legacyTriggers: elements('[data-projection-control="runtime"] [role="combobox"], [data-adapter-select-root] [role="combobox"]'),
                startupMarkers: elements('[data-previewer-startup-pending], [data-previewer-startup-shell], .proto-previewer__skeleton'),
                roots: elements('[data-pui-root]'),
                surfaces: [...(preview?.querySelectorAll('.pui-runtime-preview-surface[data-demo-ref="__website_runtime_preview_surface__"]') ?? [])].map(surface => ({
                    attributes: attrs(surface), selectorMatchCount: surface.querySelectorAll(selector).length,
                    firstRootTag: surface.querySelector('[data-pui-root]')?.tagName ?? null,
                    reactFiberMarker: Object.keys(surface).some(key => key.startsWith('__reactFiber$')),
                })),
                ancestorStates: [...(preview?.querySelectorAll('.host, .pui-runtime-preview-surface') ?? [])].map(element => {
                    const ancestors = [];
                    for (let node = element; node; node = node.parentElement) {
                        const style = getComputedStyle(node);
                        ancestors.push({ tag: node.tagName, attributes: attrs(node), inert: node.inert, display: style.display, visibility: style.visibility });
                    }
                    return ancestors;
                }),
            };
        };
        const roots = document.querySelectorAll(`[data-previewer-id=${JSON.stringify(previewerId)}]`);
        if (roots.length !== 1)
            return diagnose(false, 691);
        const root = roots[0];
        const hosts = root.querySelectorAll('.host');
        const host = hosts.length === 1 ? hosts[0] : null;
        const scopes = host?.querySelectorAll('[data-projection-scope]') ?? [];
        const scope = scopes.length === 1 ? scopes[0] : null;
        const fixed = root.dataset.projectionMode === 'fixed-family';
        const content = fixed ? scope?.querySelector('[data-projection-content]') : host;
        if (!host || !content)
            return diagnose(false, 699);
        if (fixed && (!scope || scope.dataset.projectionState !== 'ready'))
            return diagnose(false, 700);
        const generation = scope?.closest('[data-projection-generation-state]');
        if (fixed && generation && generation.dataset.projectionGenerationState !== 'active')
            return diagnose(false, 703);
        if (!fixed && scopes.length)
            return diagnose(false, 704);
        const tabsDeclared = root.querySelector('[data-runtime-tabs-mount], [data-runtime-tabs-root], [data-runtime-tabs], [data-runtime-tab]');
        const controls = root.querySelectorAll(fixed
            ? '[data-projection-scope][data-projection-state="ready"] [data-projection-control="runtime"][data-runtime-tabs]'
            : '[data-runtime-tabs-mount] [data-runtime-tabs-root]');
        let control = null;
        let trigger = null;
        if (tabsDeclared) {
            if (controls.length !== 1)
                return diagnose(false, 717);
            control = controls[0];
            const selected = control.querySelectorAll(fixed
                ? '[role="tab"][aria-selected="true"]'
                : '[data-runtime-tab][role="tab"][aria-selected="true"]');
            if (selected.length !== 1)
                return diagnose(false, 724);
            trigger = selected[0];
            if (trigger.textContent?.trim() !== label ||
                (!fixed && trigger.dataset.runtimeTab !== selectedRuntime))
                return diagnose(false, 730);
        }
        else if (fixed && root.dataset.projectionToolbar === 'false') {
            // An explicitly toolbarless projection is driven by the real Header Select.
        }
        else {
            const legacy = root.querySelectorAll('[data-projection-control="runtime"] [role="combobox"], [data-adapter-select-root] [role="combobox"]');
            if (legacy.length !== 1)
                return diagnose(false, 737);
            trigger = legacy[0];
            control = trigger.closest('[data-projection-control="runtime"], [data-adapter-select-root]');
            if (!fixed && control?.dataset.value !== selectedRuntime)
                return diagnose(false, 742);
        }
        // Ready projected attributes describe the materialized scope; the public
        // controller independently proves that this runtime was actually committed.
        if (fixed && scope?.dataset.projectionRuntime !== selectedRuntime)
            return diagnose(false, 746);
        const committed = root.__previewer__?.getCurrentRuntime?.();
        if (committed !== selectedRuntime)
            return diagnose(false, 750);
        const unavailable = (element) => {
            if (!element.isConnected)
                return true;
            for (let node = element; node; node = node.parentElement) {
                if (node.inert ||
                    node.matches('[inert], [hidden], [aria-hidden="true"], [aria-busy="true"], [aria-disabled="true"], [disabled], [data-previewer-startup-pending], [data-previewer-startup-shell]'))
                    return true;
                const style = getComputedStyle(node);
                if (style.display === 'none' || style.visibility === 'hidden')
                    return true;
            }
            return false;
        };
        if (unavailable(host) ||
            (control && unavailable(control)) ||
            (trigger && unavailable(trigger)))
            return diagnose(false, 771);
        if (root.querySelector('[data-previewer-startup-pending], [data-previewer-startup-shell], .proto-previewer__skeleton'))
            return diagnose(false, 777);
        const surfaces = content.querySelectorAll('.pui-runtime-preview-surface[data-demo-ref="__website_runtime_preview_surface__"]');
        if (surfaces.length !== 1)
            return diagnose(false, 781);
        const surface = surfaces[0];
        if (unavailable(surface) ||
            !surface.hasAttribute('data-pui-root') ||
            Array.from(content.querySelectorAll('[data-pui-root]')).some((element) => element !== surface && !surface.contains(element)))
            return diagnose(false, 790);
        // RuntimeBox adds one reserved passive boundary; original demo counts stay exact.
        const firstRoot = surface.querySelector('[data-pui-root]');
        if (surface.querySelectorAll(selector).length !== count || !firstRoot)
            return diagnose(false, 793);
        const framework = firstRoot.tagName.startsWith('WC-')
            ? 'wc'
            : firstRoot.__vue__
                ? 'vue2'
                : host.hasAttribute('data-v-app') || firstRoot.closest('[data-v-app]')
                    ? 'vue'
                    : Object.keys(surface).some((key) => key.startsWith('__reactFiber$'))
                        ? 'react'
                        : null;
        return diagnose(framework === selectedRuntime, 803);
    }, { previewerId, expectedCount: 3, readySelector: '[data-pui-root]', runtime,
        label: { wc: 'Web Components', react: 'React', vue: 'Vue', vue2: 'Vue 2' }[runtime] });
}
