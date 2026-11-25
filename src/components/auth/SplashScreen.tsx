import BrandLogo from '../BrandLogo';
import { useLanguage } from '../../services/i18n';
import '../../styles/auth.css';

/** Shown while the saved sign-in is checked at start-up (logo, name, "Checking your account…"). */
export function SplashScreen() {
  const { t, lang } = useLanguage();
  return (
    <div className="auth-screen auth-splash" role="status" aria-live="polite" aria-busy="true" lang={lang === 'ta' ? 'ta' : 'en'}>
      <BrandLogo size={80} stacked />
      <span className="auth-splash-status">
        <span className="auth-spinner" aria-hidden="true" />
        {t('auth_checking')}
      </span>
    </div>
  );
}

export default SplashScreen;
