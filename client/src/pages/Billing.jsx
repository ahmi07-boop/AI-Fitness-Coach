import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Activity, ArrowLeft, CheckCircle2, CreditCard, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { createCheckoutSession, getBillingStatus, openBillingPortal } from '../services/billingApi';
import { getApiMessage } from '../services/api';

function Billing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      setBilling(await getBillingStatus());
    } catch (err) {
      setError(getApiMessage(err, 'Unable to load billing status.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (searchParams.get('success') === '1') {
      const timer = window.setInterval(load, 2500);
      const stop = window.setTimeout(() => window.clearInterval(timer), 15000);
      return () => { window.clearInterval(timer); window.clearTimeout(stop); };
    }
  }, [searchParams]);

  const subscribe = async () => {
    try {
      setBusy(true);
      setError('');
      const { url } = await createCheckoutSession();
      window.location.assign(url);
    } catch (err) {
      setError(getApiMessage(err, 'Unable to start Stripe Checkout.'));
      setBusy(false);
    }
  };

  const manage = async () => {
    try {
      setBusy(true);
      const { url } = await openBillingPortal();
      window.location.assign(url);
    } catch (err) {
      setError(getApiMessage(err, 'Unable to open billing portal.'));
      setBusy(false);
    }
  };

  const active = billing?.subscriptionActive;
  const success = searchParams.get('success') === '1';
  const canceled = searchParams.get('canceled') === '1';

  return (
    <div className="billing-page">
      <div className="billing-shell">
        <header className="billing-header">
          <button className="billing-back" onClick={() => navigate('/plan')}><ArrowLeft size={17} /> Back to Plan</button>
          <div className="billing-brand"><div className="billing-logo"><Activity size={19} /></div><div><strong>FitCoach AI</strong><span>Subscription</span></div></div>
        </header>

        {loading ? (
          <div className="billing-card billing-loading"><RefreshCw className="spin" size={20} /> Loading your subscription...</div>
        ) : (
          <>
            <section className="billing-hero">
              <div className="billing-eyebrow"><Sparkles size={15} /> FITCOACH AI PLANS</div>
              <h1>{active ? 'Your AI plan subscription is active.' : 'Keep building your personalized plans.'}</h1>
              <p>{active ? 'Your subscription removes the four-plan free limit. You can keep generating personalized AI plans.' : `You have used ${billing.freeGenerationsUsed} of ${billing.freePlanLimit} free AI plan generations. Subscribe after the free allowance to continue.`}</p>
            </section>

            {success && <div className="billing-notice success"><CheckCircle2 size={17} /> Payment completed. Stripe is confirming your subscription; this page will refresh automatically.</div>}
            {canceled && <div className="billing-notice">Checkout was canceled. No subscription was started.</div>}
            {error && <div className="billing-notice error">{error}</div>}

            <section className="billing-grid">
              <article className="billing-card">
                <div className="billing-card-icon"><CreditCard size={20} /></div>
                <h2>{active ? 'Subscription active' : 'FitCoach AI Pro'}</h2>
                <p>{active ? `Status: ${billing.subscriptionStatus}` : 'Continue generating personalized diet and workout plans after your four free generations.'}</p>
                <ul>
                  <li><CheckCircle2 size={16} /> Personalized AI plan generation</li>
                  <li><CheckCircle2 size={16} /> No four-plan free limit while subscribed</li>
                  <li><CheckCircle2 size={16} /> Existing plans, progress and AI Coach remain available</li>
                </ul>
                {active ? (
                  <button className="billing-primary" onClick={manage} disabled={busy}>{busy ? 'Opening...' : 'Manage Subscription'}</button>
                ) : (
                  <button className="billing-primary" onClick={subscribe} disabled={busy}>{busy ? 'Opening Stripe...' : 'Subscribe with Stripe'}</button>
                )}
                <div className="billing-secure"><ShieldCheck size={15} /> Secure payment handled by Stripe Checkout.</div>
              </article>

              <aside className="billing-card billing-status-card">
                <span className="billing-label">YOUR USAGE</span>
                <div className="billing-count"><strong>{billing.freeGenerationsUsed}</strong><span>/ {billing.freePlanLimit} free plans used</span></div>
                <div className="billing-meter"><div style={{ width: `${Math.min(100, (billing.freeGenerationsUsed / billing.freePlanLimit) * 100)}%` }} /></div>
                <p>{active ? 'Your subscription is active.' : billing.freeGenerationsRemaining > 0 ? `${billing.freeGenerationsRemaining} free generation${billing.freeGenerationsRemaining === 1 ? '' : 's'} remaining.` : 'Your free allowance is finished. Subscription is required for new AI plans.'}</p>
              </aside>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default Billing;
