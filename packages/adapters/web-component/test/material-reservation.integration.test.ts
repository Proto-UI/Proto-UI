import { AdaptToWebComponent } from '../src';
import { materialReservationConformance } from '../../base/test/fixtures/material-reservation-conformance';

materialReservationConformance('wc', async (owner, target, duplicate) => {
  if (!customElements.get(owner.name)) AdaptToWebComponent(owner);
  if (!customElements.get(target.name)) AdaptToWebComponent(target);
  const host = document.createElement('div');
  const root = document.createElement(owner.name) as HTMLElement & { update(): void };
  const child = document.createElement(target.name);
  const borrowed = document.createElement('b');
  borrowed.textContent = 'borrowed target';
  child.append(borrowed);
  root.append(child);
  if (duplicate) {
    const second = document.createElement(target.name);
    second.textContent = 'second target';
    root.append(second);
  }
  host.append(root);
  document.body.append(host);
  const settle = async (action: () => void) => {
    action();
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };
  await settle(() => {});
  return {
    host,
    update: () => settle(() => root.update()),
    unmount: () => settle(() => host.remove()),
  };
});
