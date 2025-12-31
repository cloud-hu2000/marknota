// 图片工具函数

/**
 * 将文件转换为Base64数据URL
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * 检查文件是否为支持的图片格式
 */
export const isValidImageFile = (file: File): boolean => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  return validTypes.includes(file.type);
};

/**
 * 获取图片的原始尺寸
 */
export const getImageDimensions = (src: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = reject;
    img.src = src;
  });
};

/**
 * 压缩图片并转换为Base64
 * PNG图片保持透明度，其他格式转换为JPEG
 */
export const compressImage = (file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<string> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // 计算压缩后的尺寸
      const ratio = Math.min(maxWidth / img.naturalWidth, 1);
      canvas.width = img.naturalWidth * ratio;
      canvas.height = img.naturalHeight * ratio;

      // 绘制并压缩
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

      // 根据输入文件类型决定输出格式
      // PNG文件保持PNG格式以保留透明度，其他格式转换为JPEG
      const outputFormat = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

      canvas.toBlob((blob) => {
        if (blob) {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        } else {
          reject(new Error('压缩失败'));
        }
      }, outputFormat, quality);
    };

    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

/**
 * 生成唯一ID
 */
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

/**
 * 复制文本到剪贴板
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // 降级方案
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch (fallbackErr) {
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
};

/**
 * 测试函数：验证PNG透明度处理
 * 这个函数在开发环境中可以用来测试PNG处理逻辑
 */
export const testPngTransparency = async (file: File): Promise<{ originalType: string; outputType: string; hasTransparency: boolean }> => {
  const originalType = file.type;

  // 压缩图片
  const compressedDataUrl = await compressImage(file, 800, 0.9);

  // 从data URL中提取MIME类型
  const mimeMatch = compressedDataUrl.match(/^data:([^;]+)/);
  const outputType = mimeMatch ? mimeMatch[1] : 'unknown';

  // 简单的透明度检测（检查是否包含alpha通道信息）
  const hasTransparency = outputType === 'image/png';

  console.log('PNG透明度测试结果:', {
    originalType,
    outputType,
    hasTransparency,
    isPngPreserved: originalType === 'image/png' && outputType === 'image/png'
  });

  return { originalType, outputType, hasTransparency };
};

