import React, { useState } from 'react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

type AuthMode = 'login' | 'register' | 'forgot-password';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: AuthMode;
  onRegisterSuccess?: () => void;
  onLoginSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onRegisterSuccess,
  onLoginSuccess
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);

  const handleSwitchToRegister = () => setMode('register');
  const handleSwitchToLogin = () => setMode('login');
  const handleSwitchToForgotPassword = () => setMode('forgot-password');

  if (!isOpen) return null;

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button
          className="auth-modal-close"
          onClick={onClose}
          aria-label="关闭"
        >
          ×
        </button>

        {mode === 'login' && (
          <LoginForm
            onSwitchToRegister={handleSwitchToRegister}
            onSwitchToForgotPassword={handleSwitchToForgotPassword}
            onSuccess={() => {
              onLoginSuccess?.();
              onClose();
            }}
          />
        )}

        {mode === 'register' && (
          <RegisterForm
            onSwitchToLogin={handleSwitchToLogin}
            onSuccess={() => {
              onRegisterSuccess?.();
              onClose();
            }}
          />
        )}

        {mode === 'forgot-password' && (
          <div className="auth-form">
            <h2 className="auth-title">忘记密码</h2>
            <div className="auth-form-content">
              <p style={{ textAlign: 'center', marginBottom: '20px' }}>
                密码重置功能正在开发中，请联系管理员重置密码。
              </p>
              <button
                onClick={handleSwitchToLogin}
                className="auth-button secondary"
              >
                返回登录
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
