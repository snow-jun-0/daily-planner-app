import { registerWebModule, NativeModule } from 'expo';

class ExpoScreenPinModule extends NativeModule<{}> {}

export default registerWebModule(ExpoScreenPinModule, 'ExpoScreenPinModule');
