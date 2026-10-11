import { beforeAll, afterAll } from 'vitest';
const navigation = (window as any).happyDOM.settings.navigation;
const original = { ...navigation };
beforeAll(() =>
  Object.assign(navigation, {
    disableMainFrameNavigation: true,
    disableChildFrameNavigation: true,
    disableChildPageNavigation: true,
  })
);
afterAll(() => Object.assign(navigation, original));
export const activationTurn = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
