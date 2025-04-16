import { AppRegistry } from 'react-native';
import App from './App'; // ✅ this is what you want
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);