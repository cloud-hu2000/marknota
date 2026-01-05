import React, { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3004';

export const UserProfile: React.FC = () => {
  const { user, updateUser, logout } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      setUploadError('请选择图片文件');
      return;
    }

    // 验证文件大小 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('图片大小不能超过5MB');
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      const token = localStorage.getItem('auth_token');
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch(`${API_BASE_URL}/api/upload/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '上传失败');
      }

      // 更新用户信息
      updateUser(data.user);
    } catch (error: any) {
      setUploadError(error.message || '上传失败，请重试');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!confirm('确定要删除头像吗？')) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/upload/avatar`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '删除失败');
      }

      updateUser(data.user);
    } catch (error: any) {
      alert('删除头像失败：' + error.message);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN');
  };

  return (
    <div className="user-profile">
      <div className="profile-header">
        <div className="avatar-section">
          <div className="avatar-container">
            {user.avatar ? (
              <img
                src={`${API_BASE_URL}${user.avatar}`}
                alt="用户头像"
                className="user-avatar"
              />
            ) : (
              <div className="default-avatar">
                {user.username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="avatar-controls">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="avatar-button primary"
              disabled={isUploading}
            >
              {isUploading ? '上传中...' : '更换头像'}
            </button>

            {user.avatar && (
              <button
                onClick={handleDeleteAvatar}
                className="avatar-button secondary"
              >
                删除头像
              </button>
            )}

            {uploadError && (
              <div className="error-message small">
                {uploadError}
              </div>
            )}
          </div>
        </div>

        <div className="user-info">
          <h3 className="username">{user.username}</h3>
          <p className="email">{user.email}</p>
          <div className="user-status">
            <span className={`email-status ${user.emailVerified ? 'verified' : 'unverified'}`}>
              {user.emailVerified ? '✓ 已验证' : '⚠ 未验证'}
            </span>
          </div>
        </div>
      </div>

      <div className="profile-details">
        <div className="detail-item">
          <label>M币余额</label>
          <span className="m-coins">{user.mCoins} M币</span>
        </div>

        <div className="detail-item">
          <label>注册时间</label>
          <span>{formatDate(user.createdAt)}</span>
        </div>
      </div>

      <div className="profile-actions">
        <button
          onClick={logout}
          className="logout-button"
        >
          退出登录
        </button>
      </div>
    </div>
  );
};
