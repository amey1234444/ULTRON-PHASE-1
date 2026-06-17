import { UltronHmiApp } from '@ultron/hmi-ui';
import { browserPlatform } from './platform/browserPlatform';

export default function App() {
  return <UltronHmiApp platform={browserPlatform} />;
}
