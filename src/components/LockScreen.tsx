import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { storageService } from '../services/storageService';
import { useAppContext } from '../contexts/AppContext';
import { useI18n } from '../contexts/I18nContext';

interface LockScreenProps {
  onUnlock: (password: string) => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const { dispatch, hasPassword } = useAppContext();
  const { t } = useI18n();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isSetupMode = !hasPassword;

  useEffect(() => {
    const checkPasswordStatus = async () => {
      const hasPwd = storageService.hasPasswordHash();
      dispatch({ type: 'SET_HAS_PASSWORD', payload: hasPwd });
    };
    checkPasswordStatus();
  }, [dispatch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isSetupMode) {
        if (password.length < 4) {
          setError(t('lock.passwordTooShort'));
          setIsLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError(t('lock.passwordMismatch'));
          setIsLoading(false);
          return;
        }

        const setupSuccess = await storageService.setPasswordAndEncryptApiKeys(password);
        if (!setupSuccess) {
          setError(t('lock.unlockError'));
          setIsLoading(false);
          return;
        }

        dispatch({ type: 'SET_HAS_PASSWORD', payload: true });
        dispatch({ type: 'SET_PASSWORD', payload: password });
        dispatch({ type: 'SET_LOCKED', payload: false });
        onUnlock(password);
      } else {
        const isValid = await storageService.verifyPassword(password);
        if (isValid) {
          dispatch({ type: 'SET_LOCKED', payload: false });
          onUnlock(password);
        } else {
          setError(t('lock.invalidPassword'));
        }
      }
    } catch (err) {
      setError(t('lock.unlockError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center espresso-basic-bg p-4">
      <div className="espresso-card rounded-2xl w-full max-w-md p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#f9e2af]/20 mb-4">
            <Lock className="w-8 h-8 text-[#f9e2af]" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            {isSetupMode ? t('lock.setupTitle') : t('lock.lockedTitle')}
          </h1>
          <p className="text-sm espresso-muted mt-2">
            {isSetupMode ? t('lock.setupDescription') : t('lock.lockedDescription')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium espresso-muted mb-2">
              {isSetupMode ? t('lock.createPassword') : t('lock.enterPassword')}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg px-4 py-3 pr-12 espresso-input"
                placeholder={isSetupMode ? t('lock.newPasswordPlaceholder') : t('lock.passwordPlaceholder')}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 espresso-muted hover:text-white"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {isSetupMode && (
            <div>
              <label className="block text-sm font-medium espresso-muted mb-2">
                {t('lock.confirmPassword')}
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg px-4 py-3 espresso-input"
                placeholder={t('lock.confirmPasswordPlaceholder')}
                required
              />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-lg font-medium transition-colors espresso-btn-primary disabled:opacity-50"
          >
            {isLoading ? t('lock.loading') : (isSetupMode ? t('lock.setup') : t('lock.unlock'))}
          </button>
        </form>
      </div>
    </div>
  );
};
