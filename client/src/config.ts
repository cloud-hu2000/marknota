// 服务器配置
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || (() => {
  // 开发环境使用localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3004';
  }

  // 内网环境使用当前域名
  if (window.location.hostname.match(/^192\.168\.|^10\.|^172\./)) {
    return `http://${window.location.hostname}:3004`;
  }

  // 生产环境从环境变量获取，或使用默认值
  return 'https://your-server-url.onrender.com';
})();

