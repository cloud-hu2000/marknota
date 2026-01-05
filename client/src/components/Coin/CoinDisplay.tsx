import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { CoinBalance, SignInStatus, CoinTransaction } from '../../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3004';

export const CoinDisplay: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [balance, setBalance] = useState<CoinBalance | null>(null);
  const [signInStatus, setSignInStatus] = useState<SignInStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // 获取M币余额和签到状态
  const fetchCoinData = async () => {
    if (!user) return;

    try {
      const token = localStorage.getItem('auth_token');

      const [balanceResponse, signInResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/coins/balance`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/api/coins/sign-in-status`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      const balanceData = await balanceResponse.json();
      const signInData = await signInResponse.json();

      if (balanceResponse.ok) {
        setBalance(balanceData);
      }

      if (signInResponse.ok) {
        setSignInStatus(signInData);
      }
    } catch (error) {
      console.error('获取M币数据失败:', error);
    }
  };

  useEffect(() => {
    fetchCoinData();
  }, [user]);

  // 点击外部关闭面板
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsPanelOpen(false);
      }
    };

    if (isPanelOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPanelOpen]);

  // 每日签到
  const handleDailySignIn = async () => {
    if (!user) return;

    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/coins/daily-signin`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '签到失败');
      }

      // 更新用户M币余额
      updateUser({ ...user, mCoins: data.newBalance });

      // 重新获取数据
      await fetchCoinData();

      alert(`签到成功！获得 ${data.coinsEarned} M币`);
    } catch (error: any) {
      setError(error.message || '签到失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="coin-display-floating">
      {/* 悬浮按钮 */}
      <button
        className="coin-trigger-button"
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        title="M币余额"
      >
        💰 {user.mCoins}
      </button>

      {/* 悬浮面板 */}
      {isPanelOpen && (
        <div className="coin-panel" ref={panelRef}>
          <div className="coin-balance">
            <div className="balance-info">
              <span className="balance-label">M币余额</span>
              <span className="balance-amount">{user.mCoins}</span>
            </div>

            <div className="sign-in-section">
              {signInStatus && (
                <>
                  <div className="sign-in-info">
                    <p>连续签到: {signInStatus.consecutiveDays} 天</p>
                    <p>明日奖励: {signInStatus.tomorrowReward} M币</p>
                  </div>

                  {!signInStatus.signedInToday ? (
                    <button
                      onClick={handleDailySignIn}
                      className="sign-in-button"
                      disabled={isLoading}
                    >
                      {isLoading ? '签到中...' : '每日签到'}
                    </button>
                  ) : (
                    <div className="signed-in-today">
                      ✓ 今日已签到
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {balance && balance.transactions.length > 0 && (
            <div className="recent-transactions">
              <h4>最近交易</h4>
              <div className="transaction-list">
                {balance.transactions.map((transaction: CoinTransaction) => (
                  <div key={transaction.id} className="transaction-item">
                    <div className="transaction-info">
                      <span className="transaction-description">
                        {transaction.description || transaction.reason}
                      </span>
                      <span className="transaction-date">
                        {new Date(transaction.createdAt).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                    <span className={`transaction-amount ${transaction.type}`}>
                      {transaction.type === 'earn' ? '+' : '-'}{transaction.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
