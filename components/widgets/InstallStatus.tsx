import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Search } from 'lucide-react';
import type { ContactWidget } from '../../services/widgetsAPI';
import { isStaleInstall, timeAgo } from './widgetHelpers';

const BRAND = '#6C60FF';

/** One line for the widgets list: where the widget was last seen, or that it isn't installed yet. */
export function InstallStatusLine({ widget }: { widget: ContactWidget }) {
  const installs = widget.installs || [];
  const latest = installs[0];

  if (!latest) {
    return <p className="text-sm text-gray-500 truncate">Not installed yet</p>;
  }

  const more = installs.length > 1 ? ` and ${installs.length - 1} more` : '';
  if (isStaleInstall(latest.last_seen_at)) {
    return (
      <p className="text-sm text-amber-700 truncate">
        Last seen on {latest.host}{more} {timeAgo(latest.last_seen_at)}
      </p>
    );
  }
  return (
    <p className="text-sm text-green-700 truncate">
      <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5 align-middle" aria-hidden="true" />
      Installed on {latest.host}{more} · seen {timeAgo(latest.last_seen_at)}
    </p>
  );
}

/** Install-guide banner: installed / possibly removed / not detected yet, with a Check again button. */
export function InstallStatusPanel({ widget, onCheck }: { widget: ContactWidget; onCheck: () => Promise<void> }) {
  const [checking, setChecking] = useState(false);
  const installs = widget.installs || [];
  const latest = installs[0];
  const isLive = widget.status === 'live';

  const check = async () => {
    if (checking) return;
    setChecking(true);
    try {
      await onCheck();
    } finally {
      setChecking(false);
    }
  };

  const button = (
    <button
      type="button"
      onClick={check}
      disabled={checking}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60 flex-shrink-0"
    >
      {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Check again
    </button>
  );

  const hostList = (
    <ul className="mt-2 space-y-1">
      {installs.map((i) => (
        <li key={i.host} className="text-sm">
          <span className="font-semibold text-gray-900">{i.host}</span>
          <span className="text-gray-600"> · last seen {timeAgo(i.last_seen_at)}</span>
        </li>
      ))}
    </ul>
  );

  if (latest && !isStaleInstall(latest.last_seen_at)) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-start gap-3" role="status">
        <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-green-800">Installed on your website</p>
          <p className="text-sm text-green-800">Visitors on these sites can see your chat bubble.</p>
          {hostList}
        </div>
        {button}
      </div>
    );
  }

  if (latest) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3" role="status">
        <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-amber-900">Not seen on your website recently</p>
          <p className="text-sm text-amber-900">
            {isLive
              ? 'If the code was removed or your website was rebuilt, add it again using the steps below.'
              : 'The widget is not Live, so your website can\'t load it. Set it to Live in step 1.'}
          </p>
          {hostList}
        </div>
        {button}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex items-start gap-3" role="status">
      <Search className="w-6 h-6 flex-shrink-0" style={{ color: BRAND }} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900">Not installed yet</p>
        <p className="text-sm text-gray-600">
          {isLive
            ? 'Once the code is on your website, open your site in a browser, then click Check again. We\'ll show it here as installed.'
            : 'We can detect it once the widget is Live and the code is on your website.'}
        </p>
      </div>
      {button}
    </div>
  );
}
