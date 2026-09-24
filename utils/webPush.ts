// Desktop (web) push through OneSignal — the same OneSignal app the mobile app
// uses. The backend already addresses lead pushes by OneSignal external id
// (= the user's external_user_id, which the mobile app logs in with), so once a
// browser is logged in under that id it receives the same lead alerts.
//
// OneSignal's worker lives at /push/onesignal/ with its own scope so it doesn't
// fight Studio's PWA service worker, which controls "/".
//
// OneSignal only accepts the Site URL configured in its dashboard
// (https://studio.stasht.com). Anywhere else — localhost, staging — web push
// stays off unless VITE_ONESIGNAL_DEV_APP_ID points at a separate dev app.

const PROD_HOST = 'studio.stasht.com';
const PROD_APP_ID = 'e89de750-d11c-45d3-aedc-5be4d3f35db7';
const SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';

type OneSignalApi = any;

let ready: Promise<OneSignalApi | null> | null = null;

function appIdForThisSite(): string | null {
  if (typeof window === 'undefined') return null;
  if (window.location.hostname === PROD_HOST) return PROD_APP_ID;
  return (import.meta as any).env?.VITE_ONESIGNAL_DEV_APP_ID || null;
}

export function isWebPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'Notification' in window
    && 'PushManager' in window;
}

// Loads and initialises the SDK once; resolves null when web push isn't
// available here (unsupported browser, wrong host, SDK blocked). Never throws.
export function initWebPush(): Promise<OneSignalApi | null> {
  if (ready) return ready;
  const appId = appIdForThisSite();
  if (!appId || !isWebPushSupported()) {
    ready = Promise.resolve(null);
    return ready;
  }

  ready = new Promise((resolve) => {
    const w = window as any;
    w.OneSignalDeferred = w.OneSignalDeferred || [];
    w.OneSignalDeferred.push(async (OneSignal: OneSignalApi) => {
      try {
        await OneSignal.init({
          appId,
          serviceWorkerPath: 'push/onesignal/OneSignalSDKWorker.js',
          serviceWorkerUpdaterPath: 'push/onesignal/OneSignalSDKUpdaterWorker.js',
          serviceWorkerParam: { scope: '/push/onesignal/' },
          allowLocalhostAsSecureOrigin: window.location.hostname === 'localhost',
          // We ask from our own "Enable desktop alerts" button, never on page load.
          promptOptions: { slidedown: { prompts: [] } },
          notifyButton: { enable: false },
        });
        resolve(OneSignal);
      } catch (e) {
        console.warn('[WebPush] OneSignal init failed', e);
        resolve(null);
      }
    });

    if (!document.querySelector(`script[src="${SDK_URL}"]`)) {
      const s = document.createElement('script');
      s.src = SDK_URL;
      s.defer = true;
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    }
  });
  return ready;
}

// Tie this browser's subscription to the signed-in Stasht user.
export async function webPushLogin(externalUserId: string | number | null | undefined): Promise<void> {
  if (externalUserId == null || externalUserId === '') return;
  const os = await initWebPush();
  if (!os) return;
  try {
    await os.login(String(externalUserId));
  } catch (e) {
    console.warn('[WebPush] login failed', e);
  }
}

// On sign-out, detach the browser so the next person here doesn't get this user's alerts.
export async function webPushLogout(): Promise<void> {
  if (!ready) return; // never initialised this session — nothing to detach
  const os = await ready;
  if (!os) return;
  try {
    await os.logout();
  } catch (e) {
    console.warn('[WebPush] logout failed', e);
  }
}

export type WebPushState = 'unavailable' | 'blocked' | 'off' | 'on';

export async function getWebPushState(): Promise<WebPushState> {
  const os = await initWebPush();
  if (!os) return 'unavailable';
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return 'blocked';
  return os.User?.PushSubscription?.optedIn ? 'on' : 'off';
}

export async function enableWebPush(): Promise<WebPushState> {
  const os = await initWebPush();
  if (!os) return 'unavailable';
  try {
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      await os.Notifications.requestPermission();
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return 'blocked';
    await os.User.PushSubscription.optIn();
  } catch (e) {
    console.warn('[WebPush] enable failed', e);
  }
  return getWebPushState();
}

export async function disableWebPush(): Promise<WebPushState> {
  const os = await initWebPush();
  if (!os) return 'unavailable';
  try {
    await os.User.PushSubscription.optOut();
  } catch (e) {
    console.warn('[WebPush] disable failed', e);
  }
  return getWebPushState();
}
