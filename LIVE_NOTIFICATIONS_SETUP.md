# Live stream notifications setup

The church page and native apps include an opt-in control for live stream alerts. Notifications are sent to the Firebase topic `live-broadcasts` when the Cloudflare Worker detects a new public YouTube live stream. The Worker checks the channel once per minute. Users must enable notifications on their own device; this cannot be enabled remotely.

The notification and inquiry source is ready, but neither service can run until its Firebase, Resend, and Cloudflare settings below are completed. Do not commit Firebase service-account keys, Resend API keys, Android service files, or Apple push keys.

## 1. Configure Firebase

1. Create a Firebase project and register the web app, Android app (`com.hopenations.bibleencyclopedia`), and iOS app (`com.hopenations.bibleencyclopedia`).
2. Enable Firebase Cloud Messaging and create a Web Push certificate key pair. Add `hchurchbible.org` to the authorized domains for the web app.
3. Copy the public web app values and Web Push certificate public key into `assets/push-config.js`. Keep `workerUrl` blank until the Worker is deployed. Firebase web configuration and the VAPID public key are public client values, not server secrets.
4. Download `google-services.json` to `android/app/google-services.json`.
5. Download `GoogleService-Info.plist` and add it to the iOS App target's Copy Bundle Resources in Xcode.
6. In the Apple Developer portal, enable Push Notifications for the app identifier and create an APNs authentication key. Upload the APNs key to Firebase Cloud Messaging for the iOS app. Update the provisioning profile used for App Store releases.
7. Create a Firebase service account with the **Firebase Cloud Messaging API Admin** role. Keep its JSON key outside the repository.

## 2. Configure and deploy the Cloudflare Worker

1. Log in to Cloudflare with `npx wrangler login`.
2. Create a KV namespace: `npx wrangler kv namespace create LIVE_PUSH_STATE`.
3. Put the returned namespace ID in `cloudflare-push/wrangler.toml`, replacing the all-zero placeholder ID.
4. Add the Firebase service-account JSON as a Worker secret from a local file outside the repository:

   ```powershell
   Get-Content 'C:\secure\firebase-service-account.json' -Raw | npx wrangler secret put FIREBASE_SERVICE_ACCOUNT --config cloudflare-push/wrangler.toml
   ```

5. Deploy the Worker with `npm run push:deploy`. Copy its `workers.dev` URL into `workerUrl` in `assets/push-config.js`.
6. Rebuild and deploy the website. Build and sync the native apps with `npm run android:sync` and `npm run ios:sync`.

The Worker returns CORS permission only for the configured website and Capacitor origins. It does not expose the Firebase service-account key. The scheduled job sends one notification per distinct live video ID.

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
2. On the website, enable notifications from the church page and accept the browser permission prompt.
3. On Android and iOS, enable notifications from the church page and accept the system permission prompt. Test on physical devices with the Firebase configuration and APNs capability in place.
4. Submit updated app builds to Google Play and the App Store. Existing installed app versions do not receive the native changes until updated.

On iOS, browser push notifications are supported only in eligible installed web apps; the App Store build uses native Firebase Messaging. A user who denies notification permission must enable it in device or browser settings.
