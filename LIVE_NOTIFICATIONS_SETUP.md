# Live stream notifications setup

The church page and native apps include an opt-in control for live stream alerts. Notifications are sent to the Firebase topic `live-broadcasts` when the Cloudflare Worker detects a new public YouTube live stream. The Worker checks the channel once per minute. Users must enable notifications on their own device; this cannot be enabled remotely.

The church page also has a separate opt-in for one daily verse notification at 9:00 AM Australia/Sydney time. It follows Sydney daylight-saving changes (AEDT/AEST) and uses the same canonical verse and language as the app. A user's language is recorded when they opt in and refreshed when they revisit the church page. Turning on live stream notifications never enables daily verse notifications, and existing live-only subscriptions are not migrated. The daily-verse button can be used to opt out independently.

The notification and inquiry source is ready, but neither service can run until its Firebase, Resend, and Cloudflare settings below are completed. Do not commit Firebase service-account keys, Resend API keys, Android service files, or Apple push keys.

## 1. Configure Firebase

1. Create a Firebase project and register the web app, Android app (`com.hopenations.bibleencyclopedia`), and iOS app (`com.hopenations.bibleencyclopedia`).
2. Enable Firebase Cloud Messaging and create a Web Push certificate key pair. Add `hchurchbible.org` to the authorized domains for the web app.
3. Configure the public web app values and Web Push certificate public key in `assets/push-config.js`. Firebase web configuration and the VAPID public key are public client values, not server secrets. The web values and deployed Worker URL are configured in this project; native Firebase configuration and Apple push setup are still required for native notifications.
4. Download the Android app's `google-services.json` and the iOS app's `GoogleService-Info.plist` from Firebase project settings. Store their base64-encoded contents as the GitHub Actions repository secrets `ANDROID_FIREBASE_CONFIG_BASE64` and `IOS_FIREBASE_CONFIG_BASE64`; the release workflows materialize them only for the build. For local builds, place them at the ignored paths `android/app/google-services.json` and `ios/App/App/GoogleService-Info.plist`.
5. The iOS Xcode project includes `GoogleService-Info.plist` in Copy Bundle Resources. In the Apple Developer portal, enable Push Notifications for the app identifier and upload an APNs authentication key to Firebase Cloud Messaging for the iOS app, using both development and production environments. The App Store workflow generates the matching App Store distribution profile with Fastlane Sigh; its App Store Connect API key must be a team key with provisioning access.
6. Create a Firebase service account with the **Firebase Cloud Messaging API Admin** role. Keep its JSON key outside the repository.

## 2. Configure and deploy the Cloudflare Worker

1. Log in to Cloudflare with `npx wrangler login`.
2. Create a KV namespace: `npx wrangler kv namespace create LIVE_PUSH_STATE`.
3. Put the returned namespace ID in `cloudflare-push/wrangler.toml`, replacing the all-zero placeholder ID. The namespace is required for live-video deduplication and daily-verse subscriptions/deduplication; do not deploy with the placeholder.
4. Add the Firebase service-account JSON as a Worker secret from a local file outside the repository:

   ```powershell
   Get-Content 'C:\secure\firebase-service-account.json' -Raw | npx wrangler secret put FIREBASE_SERVICE_ACCOUNT --config cloudflare-push/wrangler.toml
   ```

5. Deploy the Worker with `npm run push:deploy` and set its `workers.dev` URL in `workerUrl` in `assets/push-config.js`. The current Worker is deployed at `https://hope-church-live-push.terizaamin777.workers.dev`.
6. Rebuild and deploy the website. Build and sync the native apps with `npm run android:sync` and `npm run ios:sync`.

The Worker returns CORS permission only for the configured website and Capacitor origins. It does not expose the Firebase service-account key. Its minutely cron continues checking for live videos and checks the Sydney-local 9:00 AM schedule using the Australia/Sydney time zone (not a fixed UTC hour). Each subscriber's delivery marker is saved only after Firebase accepts the message. Cron retries during the Sydney 9:00–9:59 AM hour send only to registrations without a success marker, avoiding repeats for registrations already served. The verse content and translations are shared with the app's daily-verse module.

Daily subscriptions use dedicated `/daily-subscribe` and `/daily-unsubscribe` Worker endpoints. Web and native users are registered only after using the separate daily opt-in control and granting notification permission. The Worker stores the FCM token, app language, and client type in the configured KV namespace to route the localized notification to each opted-in registration; unsubscribe removes that daily registration without changing the existing live topic subscription. No current live-only user is auto-enrolled.

## 3. Configure direct church inquiry email

The church page sends inquiry form submissions to `info@hchurchbible.org` through this Worker. It does not use the visitor's email application. The form remains disabled until `workerUrl` is configured.

1. Verify a sender domain in Resend and choose a sender address on that verified domain.
2. Add the Resend API key as a Cloudflare Worker secret:

   ```powershell
   npx wrangler secret put RESEND_API_KEY --config cloudflare-push/wrangler.toml
   ```

3. Add `INQUIRY_FROM_EMAIL` as a Cloudflare Worker variable, using the verified sender address (for example, `Hope Church <website@your-verified-domain>`). Do not use the recipient address as the sender unless that domain is verified in Resend.
4. Deploy the Worker and set `workerUrl` in `assets/push-config.js` to its HTTPS URL. Rebuild and deploy the website after reviewing the local preview.
5. Submit a test inquiry from the live site and confirm it arrives in the church inbox, including its spam folder. A successful response means Resend accepted the message; final inbox delivery still depends on sender-domain verification and mail-provider filtering.

## 4. Test and release

1. Run `npm run test:push` and `npm run build:web`.
2. On the website, test the live-stream and daily-verse opt-ins separately, accept the browser permission prompt, and confirm daily opt-out leaves live-stream preferences unchanged. The daily send uses the selected app language.
3. On Android and iOS, test both controls independently and accept the system permission prompt. Test on physical devices with the Firebase configuration and APNs capability in place.
4. Submit updated app builds to Google Play and the App Store. Existing installed app versions do not receive the native changes until updated.

On iOS, browser push notifications are supported only in eligible installed web apps; the App Store build uses native Firebase Messaging. A user who denies notification permission must enable it in device or browser settings.
