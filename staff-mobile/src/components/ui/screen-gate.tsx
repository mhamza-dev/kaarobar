import type { GateStatus } from '@/hooks/use-screen-gate';
import { Screen } from '@/components/ui/screen';
import { LoadingView, StateView } from '@/components/ui/state-view';
import { t } from '@/lib/i18n';
import { pushPath } from '@/lib/nav';

type Props = {
  status: GateStatus;
  /** What the user was trying to open, for the denial copy. */
  featureName: string;
  onRetry: () => void;
};

/** Renders the non-ready states of `useScreenGate` consistently. */
export function ScreenGateFallback({ status, featureName, onRetry }: Props) {
  return (
    <Screen>
      {status === 'loading' || status === 'signedOut' ? (
        <LoadingView label={t('common.workspaceLoading')} />
      ) : status === 'denied' ? (
        <StateView
          icon="lock-closed-outline"
          tone="warning"
          title={`${featureName} isn't available for your role`}
          detail="Your account doesn't have permission for this area. An owner or admin can grant it from Settings → Roles."
          actionLabel="Go to workspace"
          onAction={() => pushPath('/app/dashboard')}
        />
      ) : (
        <StateView
          icon="cloud-offline-outline"
          tone="danger"
          title={`Couldn't open ${featureName.toLowerCase()}`}
          detail="We couldn't read your session. Check your connection and try again."
          actionLabel="Retry"
          onAction={onRetry}
        />
      )}
    </Screen>
  );
}
