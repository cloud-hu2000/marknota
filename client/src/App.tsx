import React, { useState, useRef, useEffect } from 'react';
import { Whiteboard } from './components/Whiteboard';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthModal } from './components/Auth/AuthModal';
import { UserProfile } from './components/User/UserProfile';
import { CoinDisplay } from './components/Coin/CoinDisplay';

// 导入样式
import './styles/auth.css';
import './styles/user.css';
import './styles/coin.css';

// 固定使用一个房间
const FIXED_ROOM_ID = 'main-room';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [showUserProfile, setShowUserProfile] = useState(false);
  const whiteboardRef = useRef<HTMLDivElement>(null);

  // 监听认证状态变化，登录成功后滚动到白板区域
  useEffect(() => {
    if (isAuthenticated && whiteboardRef.current) {
      // 延迟一点时间，确保DOM更新完成
      setTimeout(() => {
        whiteboardRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 300);
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner">加载中...</div>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="app-header">
        <div className="header-left">
          <h1>MarkNota</h1>
          <span className="app-subtitle">多人实时协作白板</span>
        </div>

        <div className="header-center">
        </div>

        <div className="header-right">
          {isAuthenticated ? (
            <>
              {isAuthenticated && <CoinDisplay />}
              <span className="user-greeting">
                欢迎, {user?.username}
              </span>
              <button
                onClick={() => setShowUserProfile(!showUserProfile)}
                className="user-menu-button"
              >
                {user?.avatar ? (
                  <img
                    src={`http://localhost:3004${user.avatar}`}
                    alt="头像"
                    className="user-avatar-small"
                  />
                ) : (
                  <div className="default-avatar-small">
                    {user?.username.charAt(0).toUpperCase()}
                  </div>
                )}
              </button>
            </>
          ) : (
            <div className="auth-buttons">
              <button
                onClick={() => {
                  setAuthMode('login');
                  setShowAuthModal(true);
                }}
                className="auth-button login"
              >
                登录
              </button>
              <button
                onClick={() => {
                  setAuthMode('register');
                  setShowAuthModal(true);
                }}
                className="auth-button register"
              >
                注册
              </button>
            </div>
          )}
        </div>
      </div>

      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          initialMode={authMode}
          onRegisterSuccess={() => setShowAuthModal(false)}
          onLoginSuccess={() => setShowAuthModal(false)}
        />
      )}

      {showUserProfile && isAuthenticated && (
        <div className="user-profile-modal">
          <div className="modal-overlay" onClick={() => setShowUserProfile(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <UserProfile />
            </div>
          </div>
        </div>
      )}

      <div className="main-content" ref={whiteboardRef}>
        <Whiteboard roomId={FIXED_ROOM_ID} />
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

