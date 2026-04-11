import { registerRootComponent } from 'expo';

import App from './App';

// Background task definition must be imported in the global scope
// so it is evaluated when the app runs headlessly in the background.
import './src/background';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
