import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { getApps, initializeApp } from '@firebase/app';

const config = globalThis.HOPE_PUSH_CONFIG;
const topic = 'live-broadcasts';
const storageKey = 'hopeChurchLiveNotificationsEnabled';
const webTokenStorageKey = 'hopeChurchLiveNotificationsToken';
const dailyStorageKey = 'hopeChurchDailyVerseNotificationsEnabled';
const dailyTokenStorageKey = 'hopeChurchDailyVerseNotificationsToken';
const button = document.getElementById('liveNotificationButton');
const status = document.getElementById('liveNotificationStatus');
const dailyButton = document.getElementById('dailyVerseNotificationButton');
const dailyStatus = document.getElementById('dailyVerseNotificationStatus');
const heading = document.getElementById('liveBroadcastHeading');
const description = document.getElementById('liveBroadcastDescription');
const watchLink = document.getElementById('liveWatchLink');
const pageLanguage = document.documentElement.lang;
const language = ['ar', 'en', 'es', 'fr'].includes(pageLanguage) ? pageLanguage : 'ar';
const text = {
  ar: {
    heading: '🔴 البث المباشر',
    description: 'شاهدوا البث المباشر لاجتماعات كنيسة رجاء الأمم سيدني: الأحد الساعة 10:00 صباحًا، والأربعاء والجمعة الساعة 7:00 مساءً (بتوقيت سيدني). إذا لم يظهر البث هنا، يمكنكم مشاهدته مباشرةً على قناة الكنيسة في YouTube.',
    watch: 'مشاهدة قناة الكنيسة على YouTube',
    enable: 'فعّل إشعارات البث المباشر',
    disable: 'إيقاف إشعارات البث المباشر',
    ready: 'ستصلك إشعارات عند بدء البث المباشر.',
    disabled: 'إشعارات البث غير مهيأة بعد.',
    working: 'جارٍ تحديث إعداد الإشعارات…',
    denied: 'لم تُمنح صلاحية الإشعارات. يمكنك تفعيلها من إعدادات الجهاز أو المتصفح.',
    failed: 'تعذر تحديث الاشتراك. تحقق من اتصال الإنترنت وحاول مجددًا.',
    live: 'بدأ البث المباشر الآن.',
    dailyEnable: 'فعّل إشعار آية اليوم اليومي (9 صباحًا بتوقيت سيدني)',
    dailyDisable: 'إيقاف إشعار آية اليوم اليومي',
    dailyReady: 'ستصلك آية اليوم يوميًا الساعة 9 صباحًا بتوقيت سيدني بلغة التطبيق.',
    dailyDisabled: 'إشعارات آية اليوم غير مهيأة بعد.',
    dailyWorking: 'جارٍ تحديث اشتراك آية اليوم…',
    dailyDenied: 'لم تُمنح صلاحية الإشعارات. يمكنك تفعيلها من إعدادات الجهاز أو المتصفح.',
    dailyFailed: 'تعذر تحديث اشتراك آية اليوم. تحقق من اتصال الإنترنت وحاول مجددًا.'
  },
  en: {
    heading: '🔴 Live Stream',
    description: 'Watch Hope Church NSW services live: Sundays at 10:00 AM, and Wednesdays and Fridays at 7:00 PM Sydney time. If the stream does not appear here, watch it directly on the church’s YouTube channel.',
    watch: 'Watch the church on YouTube',
    enable: 'Enable live stream notifications',
    disable: 'Turn off live stream notifications',
    ready: 'You will be notified when a live stream starts.',
    disabled: 'Live notifications are not configured yet.',
    working: 'Updating notification settings…',
    denied: 'Notification permission was not granted. Enable it in your device or browser settings.',
    failed: 'Could not update your subscription. Check your connection and try again.',
    live: 'The church is live now.',
    dailyEnable: 'Enable daily verse notifications (9:00 AM Sydney time)',
    dailyDisable: 'Turn off daily verse notifications',
    dailyReady: 'You will receive the Verse of the Day daily at 9:00 AM Sydney time in your app language.',
    dailyDisabled: 'Daily verse notifications are not configured yet.',
    dailyWorking: 'Updating daily verse subscription…',
    dailyDenied: 'Notification permission was not granted. Enable it in your device or browser settings.',
    dailyFailed: 'Could not update your daily verse subscription. Check your connection and try again.'
  },
  es: {
    heading: '🔴 Transmisión en vivo',
    description: 'Mira en vivo los servicios de Hope Church NSW: domingos a las 10:00 a. m., y miércoles y viernes a las 7:00 p. m., hora de Sídney. Si la transmisión no aparece aquí, mírala directamente en el canal de YouTube de la iglesia.',
    watch: 'Ver la iglesia en YouTube',
    enable: 'Activar avisos de transmisiones en vivo',
    disable: 'Desactivar avisos de transmisiones en vivo',
    ready: 'Recibirás un aviso cuando comience una transmisión en vivo.',
    disabled: 'Los avisos de transmisiones aún no están configurados.',
    working: 'Actualizando la configuración de avisos…',
    denied: 'No se concedió permiso para los avisos. Actívalo en la configuración del dispositivo o navegador.',
    failed: 'No se pudo actualizar la suscripción. Comprueba la conexión e inténtalo de nuevo.',
    live: 'La iglesia está transmitiendo en vivo.',
    dailyEnable: 'Activar avisos diarios del versículo (9:00 a. m., hora de Sídney)',
    dailyDisable: 'Desactivar avisos diarios del versículo',
    dailyReady: 'Recibirás el versículo del día diariamente a las 9:00 a. m., hora de Sídney, en el idioma de la aplicación.',
    dailyDisabled: 'Los avisos diarios del versículo aún no están configurados.',
    dailyWorking: 'Actualizando la suscripción al versículo diario…',
    dailyDenied: 'No se concedió permiso para los avisos. Actívalo en la configuración del dispositivo o navegador.',
    dailyFailed: 'No se pudo actualizar la suscripción al versículo diario. Comprueba la conexión e inténtalo de nuevo.'
  },
  fr: {
    heading: '🔴 Diffusion en direct',
    description: 'Regardez en direct les cultes de Hope Church NSW : le dimanche à 10 h, et les mercredi et vendredi à 19 h, heure de Sydney. Si le direct ne s’affiche pas ici, regardez-le sur la chaîne YouTube de l’église.',
    watch: 'Voir l’église sur YouTube',
    enable: 'Activer les notifications de direct',
    disable: 'Désactiver les notifications de direct',
    ready: 'Vous serez averti au début d’un direct.',
    disabled: 'Les notifications de direct ne sont pas encore configurées.',
    working: 'Mise à jour des paramètres de notification…',
    denied: 'L’autorisation de notification n’a pas été accordée. Activez-la dans les paramètres de l’appareil ou du navigateur.',
    failed: 'Impossible de mettre à jour l’abonnement. Vérifiez la connexion et réessayez.',
    live: 'L’église est en direct.',
    dailyEnable: 'Activer les notifications du verset quotidien (9 h, heure de Sydney)',
    dailyDisable: 'Désactiver les notifications du verset quotidien',
    dailyReady: 'Vous recevrez chaque jour le verset du jour à 9 h, heure de Sydney, dans la langue de l’application.',
    dailyDisabled: 'Les notifications quotidiennes du verset ne sont pas encore configurées.',
    dailyWorking: 'Mise à jour de l’abonnement au verset quotidien…',
    dailyDenied: 'L’autorisation de notification n’a pas été accordée. Activez-la dans les paramètres de l’appareil ou du navigateur.',
    dailyFailed: 'Impossible de mettre à jour l’abonnement au verset quotidien. Vérifiez la connexion et réessayez.'
  }
}[language];

if (heading) heading.textContent = text.heading;
if (description) description.textContent = text.description;
if (watchLink) watchLink.textContent = text.watch;

function isConfigured() {
  return Boolean(config
    && config.firebase
    && Object.values(config.firebase).every(Boolean)
    && config.vapidKey
    && config.workerUrl);
}

function setStatus(message) {
  status.textContent = message;
}

function setEnabled(enabled) {
  localStorage.setItem(storageKey, String(enabled));
  button.textContent = enabled ? text.disable : text.enable;
  setStatus(enabled ? text.ready : '');
}

async function postSubscription(path, token, details = {}) {
  const response = await fetch(`${config.workerUrl.replace(/\/$/, '')}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, ...details })
  });
  if (!response.ok) throw new Error(`Notification service returned ${response.status}`);
}

async function enableNotifications() {
  if (Capacitor.isNativePlatform()) {
    const permission = await FirebaseMessaging.requestPermissions();
    if (permission.receive !== 'granted') throw new Error('permission-denied');
    await FirebaseMessaging.getToken();
    await FirebaseMessaging.subscribeToTopic({ topic });
    return;
  }

  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    throw new Error('permission-denied');
  }
  const permission = await FirebaseMessaging.requestPermissions();
  if (permission.receive !== 'granted') throw new Error('permission-denied');

  if (!getApps().length) initializeApp(config.firebase);
  const serviceWorkerRegistration = await navigator.serviceWorker.register('firebase-messaging-sw.js');
  const { token } = await FirebaseMessaging.getToken({
    vapidKey: config.vapidKey,
    serviceWorkerRegistration
  });
  if (!token) throw new Error('Firebase returned an empty registration token');
  await postSubscription('subscribe', token);
  localStorage.setItem(webTokenStorageKey, token);
}

async function disableNotifications() {
  if (Capacitor.isNativePlatform()) {
    await FirebaseMessaging.unsubscribeFromTopic({ topic });
    await FirebaseMessaging.deleteToken();
    await refreshDailyAfterTokenReset();
    return;
  }

  if (!getApps().length) initializeApp(config.firebase);
  const token = localStorage.getItem(webTokenStorageKey);
  if (token) await postSubscription('unsubscribe', token);
  await FirebaseMessaging.deleteToken();
  localStorage.removeItem(webTokenStorageKey);
  await refreshDailyAfterTokenReset();
}

button.addEventListener('click', async () => {
  if (button.disabled) return;
  button.disabled = true;
  setStatus(text.working);
  try {
    const enabled = localStorage.getItem(storageKey) === 'true';
    if (enabled) {
      await disableNotifications();
      setEnabled(false);
    } else {
      await enableNotifications();
      setEnabled(true);
    }
  } catch (error) {
    console.error('Unable to update live notification subscription.', error);
    setStatus(error.message === 'permission-denied' ? text.denied : text.failed);
  } finally {
    button.disabled = false;
  }
});

if (!isConfigured()) {
  button.disabled = true;
  setStatus(text.disabled);
} else {
  button.disabled = false;
  setStatus('');
  if (!Capacitor.isNativePlatform() && !getApps().length) initializeApp(config.firebase);

  FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
    window.location.assign(event.notification?.data?.url || 'church.html');
  });

  FirebaseMessaging.addListener('notificationReceived', () => {
    setStatus(text.live);
  });

  const enabled = localStorage.getItem(storageKey) === 'true';
  button.textContent = enabled ? text.disable : text.enable;
  if (enabled && Capacitor.isNativePlatform()) {
    FirebaseMessaging.checkPermissions()
      .then((permission) => {
        if (permission.receive !== 'granted') {
          return FirebaseMessaging.unsubscribeFromTopic({ topic })
            .then(() => FirebaseMessaging.deleteToken())
            .then(() => {
              localStorage.removeItem(storageKey);
              button.textContent = text.enable;
              setStatus(text.denied);
            });
        }
        return FirebaseMessaging.getToken();
      })
      .then((result) => {
        if (result) return;
        return FirebaseMessaging.subscribeToTopic({ topic });
      })
      .catch((error) => {
        console.error('Unable to restore live notification subscription.', error);
        setStatus(text.failed);
      });
  }
  if (enabled && !Capacitor.isNativePlatform() && Notification.permission === 'granted') {
    navigator.serviceWorker.register('firebase-messaging-sw.js')
      .then((serviceWorkerRegistration) => FirebaseMessaging.getToken({
        vapidKey: config.vapidKey,
        serviceWorkerRegistration
      }))
      .then(({ token }) => postSubscription('subscribe', token).then(() => {
        localStorage.setItem(webTokenStorageKey, token);
      }))
      .catch((error) => {
        console.error('Unable to restore live notification subscription.', error);
        setStatus(text.failed);
      });
  }
  if (enabled && !Capacitor.isNativePlatform() && Notification.permission !== 'granted') {
    const token = localStorage.getItem(webTokenStorageKey);
    const removeRemoteSubscription = token ? postSubscription('unsubscribe', token) : Promise.resolve();
    removeRemoteSubscription
      .then(() => FirebaseMessaging.deleteToken())
      .then(() => {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(webTokenStorageKey);
        button.textContent = text.enable;
        setStatus(text.denied);
      })
      .catch((error) => {
        console.error('Unable to remove revoked web notification subscription.', error);
        setStatus(text.failed);
      });
  }
}

function selectedLanguage() {
  const savedLanguage = localStorage.getItem('bibleAppLanguage');
  return ['ar', 'en', 'es', 'fr'].includes(savedLanguage) ? savedLanguage : language;
}

async function getDailyToken(requestPermission) {
  if (Capacitor.isNativePlatform()) {
    const permission = requestPermission
      ? await FirebaseMessaging.requestPermissions()
      : await FirebaseMessaging.checkPermissions();
    if (permission.receive !== 'granted') throw new Error('permission-denied');
    const result = await FirebaseMessaging.getToken();
    if (!result.token) throw new Error('Firebase returned an empty registration token');
    return result.token;
  }

  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    throw new Error('permission-denied');
  }
  if (requestPermission) {
    const permission = await FirebaseMessaging.requestPermissions();
    if (permission.receive !== 'granted') throw new Error('permission-denied');
  } else if (Notification.permission !== 'granted') {
    throw new Error('permission-denied');
  }
  if (!getApps().length) initializeApp(config.firebase);
  const serviceWorkerRegistration = await navigator.serviceWorker.register('firebase-messaging-sw.js');
  const result = await FirebaseMessaging.getToken({
    vapidKey: config.vapidKey,
    serviceWorkerRegistration
  });
  if (!result.token) throw new Error('Firebase returned an empty registration token');
  return result.token;
}

async function updateDailySubscription(token) {
  const previousToken = localStorage.getItem(dailyTokenStorageKey);
  await postSubscription('daily-subscribe', token, {
    language: selectedLanguage(),
    platform: Capacitor.isNativePlatform() ? 'native' : 'web'
  });
  localStorage.setItem(dailyTokenStorageKey, token);
  if (previousToken && previousToken !== token) {
    try {
      await postSubscription('daily-unsubscribe', previousToken);
    } catch (error) {
      error.activeSubscription = true;
      throw error;
    }
  }
}

async function refreshDailyAfterTokenReset() {
  if (localStorage.getItem(dailyStorageKey) !== 'true') return;
  try {
    await updateDailySubscription(await getDailyToken(false));
  } catch (error) {
    console.error('Unable to refresh daily verse registration after live token reset.', error);
    dailyStatus.textContent = text.dailyFailed;
  }
}

function setDailyEnabled(enabled, message = enabled ? text.dailyReady : '') {
  localStorage.setItem(dailyStorageKey, String(enabled));
  dailyButton.textContent = enabled ? text.dailyDisable : text.dailyEnable;
  dailyStatus.textContent = message;
}

async function removeRevokedDailySubscription() {
  const token = localStorage.getItem(dailyTokenStorageKey);
  if (token) await postSubscription('daily-unsubscribe', token);
  localStorage.removeItem(dailyStorageKey);
  localStorage.removeItem(dailyTokenStorageKey);
  setDailyEnabled(false, text.dailyDenied);
}

if (dailyButton) {
  dailyButton.addEventListener('click', async () => {
    if (dailyButton.disabled) return;
    dailyButton.disabled = true;
    dailyStatus.textContent = text.dailyWorking;
    try {
      const enabled = localStorage.getItem(dailyStorageKey) === 'true';
      if (enabled) {
        const token = localStorage.getItem(dailyTokenStorageKey) || await getDailyToken(false);
        await postSubscription('daily-unsubscribe', token);
        localStorage.removeItem(dailyTokenStorageKey);
        setDailyEnabled(false);
      } else {
        const token = await getDailyToken(true);
        await updateDailySubscription(token);
        setDailyEnabled(true);
      }
    } catch (error) {
      console.error('Unable to update daily verse notification subscription.', error);
      if (error.activeSubscription) setDailyEnabled(true, text.dailyFailed);
      else dailyStatus.textContent = error.message === 'permission-denied' ? text.dailyDenied : text.dailyFailed;
    } finally {
      dailyButton.disabled = false;
    }
  });

  if (!isConfigured()) {
    dailyButton.disabled = true;
    dailyButton.textContent = text.dailyEnable;
    dailyStatus.textContent = text.dailyDisabled;
  } else {
    dailyButton.disabled = false;
    const enabled = localStorage.getItem(dailyStorageKey) === 'true';
    dailyButton.textContent = enabled ? text.dailyDisable : text.dailyEnable;
    dailyStatus.textContent = enabled ? text.dailyReady : '';
    if (enabled) {
      getDailyToken(false)
        .then(updateDailySubscription)
        .catch(async (error) => {
          if (error.message === 'permission-denied') {
            try {
              await removeRevokedDailySubscription();
            } catch (unsubscribeError) {
              console.error('Unable to remove revoked daily verse subscription.', unsubscribeError);
              dailyStatus.textContent = text.dailyFailed;
            }
            return;
          }
          console.error('Unable to restore daily verse notification subscription.', error);
          dailyStatus.textContent = text.dailyFailed;
        });
    }
  }
}
