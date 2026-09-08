# Install RELAY: iPhone and Android pilot checks

8 September 2026. Installation guidance added locally; physical-device results pending.
Use dummy reports. Do not clear browser data or uninstall while unsent work exists.

## Install

Open https://app.relaybyleodis.com in Safari on iPhone or Chrome on Android.
Expand “Install RELAY on your phone” below the header. On supported Android
browsers the native install button appears when the browser offers installation;
otherwise use the manual instructions. On iPhone use Share > Add to Home Screen,
keeping Open as Web App enabled where shown. Open the new RELAY icon.

## Test on each phone

1. Record phone model, OS version and browser version.
2. Confirm the icon/name and that launch opens a standalone app window.
3. Sign in with an assigned Microsoft account. Confirm the correct role/trade
   screen; close/reopen and verify access is still correct. Note if Microsoft
   opens in the external browser rather than returning to the installed app.
4. Create a dummy report. Test camera capture and choosing an existing JPEG/PNG
   photo if the current phone picker offers it. Record HEIC/unsupported-format
   errors honestly; installation does not add camera formats or new controls.
5. Save text and photos, submit, then open the PDF and inspect both images/text.
6. Start another dummy draft online and edit it. Turn on airplane mode and edit
   text. Reload into offline recovery, verify the retained text, reconnect and
   reopen while signed in. Check the final server copy. The current recovery is
   tab/identity-dependent; opening a new installed app window may not retain that
   tab identity. Do not treat this as full offline capture or submission support.
7. Save all work, close/reopen and confirm reports/images persist. On a subsequent
   deployment, verify the new version appears without reinstalling. No forced
   service-worker activation or automatic reload is introduced during edits.

Report the failing step and screenshot if anything differs. Never include a
password, client secret or Microsoft callback URL/code.

## PDF return-navigation fix

The preview now opens /reports/[id]/pdf inside RELAY instead of opening the raw
PDF in a separate window. PDF.js renders one page at a time with paging, zoom,
page text and an explicit return link. Download is a separate attachment action.
The PDF bytes still come from the existing authenticated/authorized endpoint;
no third-party viewer receives the report and no private PDF cache is added.

Local production build and an isolated Chromium test at 390px passed: two-page
rendering, page changes, zoom, no second window, browser Back to preview and
explicit Back to report. Physical installed-app verification remains required.
After deployment, repeat the same journey using Android's system Back gesture
and the on-screen return link. Confirm downloads remain a deliberate separate
action. iPhone standalone behaviour still needs the corresponding phone check.

References: [Apple installation instructions](https://support.apple.com/guide/iphone/iphea86e5236/ios)
and [browser install prompts](https://web.dev/articles/customize-install).
