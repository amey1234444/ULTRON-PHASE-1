import { UltronHmiApp } from '@ultron/hmi-ui';
import { tauriPlatform } from './platform/tauriPlatform';

export default function App() {
  return <UltronHmiApp platform={tauriPlatform} />;
}
