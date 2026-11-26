// @ts-expect-error The fixture Vite plugin provides the actual CLI artifact.
import artifact from 'virtual:percentage-artifact';
import 'virtual:percentage-style.css';
import { createPercentageLab, createSwitchLab } from './consumer';

if (new URLSearchParams(location.search).get('suite') === 'switch')
  (window as any).switchLab = createSwitchLab(artifact);
else (window as any).percentageLab = createPercentageLab(artifact);
document.body.dataset.ready = 'true';
