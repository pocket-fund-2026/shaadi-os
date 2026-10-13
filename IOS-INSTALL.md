# Install Shaadi OS on your iPhone

The Expo app is in `app/`. Open `app/ios/ShaadiOS.xcworkspace`, not the starter Swift project in Downloads.

If the phone shows red `Unimplemented component: <RNSVGSvgView>` blocks, the installed native binary does not contain the SVG library. A JavaScript reload cannot add that library. Run the Desktop `Install-ShaadiOS.command`, which now installs and verifies the native SVG pod before rebuilding for your phone. Alternatively, run the commands below in Terminal, then reopen the workspace and use Run in Xcode:

```sh
cd ~/shaadi-os/app/ios
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer pod install --no-repo-update
open ShaadiOS.xcworkspace
```

Do not rebuild until pod installation completes successfully. The expected lockfile and installed Pods manifest must both list `RNSVG`.

This session verified Xcode 26.6 is installed, but cannot communicate with macOS CoreDevice or open Xcode through LaunchServices. No phone installation has completed. The command-line signing check also returned zero valid identities; check the signing account in Xcode.

1. Connect and unlock your iPhone, accept **Trust This Computer**, and enable **Developer Mode** if prompted.
2. In Xcode, open **Settings → Accounts** and sign in with your Apple ID.
3. Open `app/ios/ShaadiOS.xcworkspace`. Select the **ShaadiOS** target → **Signing & Capabilities** → **Automatically manage signing** and choose your team. The existing project uses team `36Z62U2XMG` and bundle identifier `com.shaadios.app`; use your own team if needed.
4. Choose your iPhone as the run destination and press **Run** (⌘R). A Debug build requires Metro: run `npm start` in `app/`.
5. For an app that runs without Metro, choose **Product → Scheme → Edit Scheme → Run → Build Configuration → Release**, then Run again.

## Xcode cannot compute its dependency graph

If the full error reads `unable to initiate PIF transfer session (operation in progress?)`, the build service is stuck before compilation. Double-click `Repair-ShaadiOS-Xcode.command` on the Desktop. It gracefully closes Xcode, restarts the build service, backs up only ShaadiOS's generated build graph cache, verifies the SVG dependency installation and reopens the correct workspace. If Xcode asks to save edits, save them. The shortcut does not delete source, account settings, certificates or Pods. Select your iPhone and Run after it reopens.

The `ShadowViewMutation` deprecation documentation warnings belong to React Native headers and do not cause this build-service failure.

## Use the new backend features

The new planner endpoints are local changes. The remote demo API has not been deployed with them. Start the local API in Terminal:

```sh
cd ~/shaadi-os/api
npm start
```

Put your Mac and iPhone on the same Wi-Fi. Find your Mac's local IP in **System Settings → Wi-Fi → Details → TCP/IP**, then enter `http://YOUR_MAC_IP:4600` under the login screen's server settings. `localhost` on an iPhone refers to the iPhone itself. If already logged in, log out to change the server before logging in again.

OTP remains `123456`, and payments remain simulated. A Release build still requires the API to be running and reachable.

## Checks

```sh
cd ~/shaadi-os/api
npm test
cd ../app
npm run typecheck
npm run build:web
```

The API tests require Node 22.18+ with native TypeScript support; this Mac currently has Node 26.3.
