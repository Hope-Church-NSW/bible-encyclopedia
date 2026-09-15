# Google Play release

The Android application ID is `com.hopenations.bibleencyclopedia`. Google Play
treats this ID as permanent after the first release.

## Prerequisites

Install Android Studio with Android SDK 36 and a Java 21 JDK. Open the `android`
directory once in Android Studio so Gradle can install any missing SDK packages.

## Create the upload key once

Keep the keystore outside this repository and back it up securely:

```powershell
keytool -genkeypair -v -keystore "$HOME\bible-encyclopedia-upload.jks" -alias bible-upload -keyalg RSA -keysize 2048 -validity 10000
```

Set the signing values in the terminal used for the release build:

```powershell
$env:BIBLE_RELEASE_STORE_FILE = "$HOME\bible-encyclopedia-upload.jks"
$env:BIBLE_RELEASE_STORE_PASSWORD = "your-store-password"
$env:BIBLE_RELEASE_KEY_ALIAS = "bible-upload"
$env:BIBLE_RELEASE_KEY_PASSWORD = "your-key-password"
npm.cmd run android:bundle
```

The signed bundle is created at
`android/app/build/outputs/bundle/release/app-release.aab`.

## Play Console

1. Create the app in Google Play Console using the package ID above.
2. Complete App access, Ads, Content rating, Target audience, Data safety, and the privacy-policy URL.
3. Upload the AAB to Internal testing first and enable Play App Signing.
4. Add the Arabic and English store listings, the 512 px store icon, feature graphic, phone screenshots, and support contact details.
5. Test installation and offline reading from the internal-testing link before promoting the release to production.

This app requests only the Internet permission. Its Bible and encyclopedia data
are bundled for offline use; document any remote links or future analytics in
the Data safety form if those behaviors change.