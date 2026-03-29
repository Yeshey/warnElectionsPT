# warnElections

Created with `npx create-expo-app@latest temp-app --template blank-typescript`

App to warn with notifications about upcoming elections for Portuguese citizens

To run your project, navigate to the directory and run one of the following npm commands.

- npm run android
- npm run ios # you need to use macOS to build the iOS project - use the Expo app if you need to do iOS development without a Mac
- npm run web

If it doesn't work:
- adb devices
- adb reverse tcp:8081 tcp:8081
- npx expo start --localhost
- Go to Expo Go on phone > "Enter URL manually" > exp://localhost:8081

To run npm tests:
- npm test