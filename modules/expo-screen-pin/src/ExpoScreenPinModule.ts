import { requireNativeModule } from 'expo-modules-core';

type ExpoScreenPinModule = {
  startPinning(): void;
  stopPinning(): void;
};

export default requireNativeModule<ExpoScreenPinModule>('ExpoScreenPin');
