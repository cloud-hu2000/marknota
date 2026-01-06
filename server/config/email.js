const AWS = require('aws-sdk');

// 配置AWS SES
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const ses = new AWS.SES({ apiVersion: '2010-12-01' });

// 发送邮件函数
const sendEmail = async (to, subject, htmlBody, textBody = null) => {
  const params = {
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Body: {
        Html: {
          Charset: 'UTF-8',
          Data: htmlBody,
        },
        ...(textBody && {
          Text: {
            Charset: 'UTF-8',
            Data: textBody,
          },
        }),
      },
      Subject: {
        Charset: 'UTF-8',
        Data: subject,
      },
    },
    Source: process.env.AWS_SES_FROM_EMAIL,
  };

  try {
    const result = await ses.sendEmail(params).promise();
    console.log('Email sent successfully:', result.MessageId);
    return { success: true, messageId: result.MessageId };
  } catch (error) {
    console.error('Failed to send email:', error);
    throw new Error('Failed to send email');
  }
};

// 发送验证邮件
const sendVerificationEmail = async (email, verificationToken) => {
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;

  const subject = '验证您的MarkNota账户';
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">欢迎加入MarkNota！</h2>
      <p>请点击下面的链接验证您的邮箱地址：</p>
      <a href="${verificationUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 16px 0;">
        验证邮箱
      </a>
      <p>如果您无法点击链接，请复制以下URL到浏览器中打开：</p>
      <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
      <p style="color: #999; font-size: 12px;">此链接将在24小时后过期。</p>
      <p>如果这不是您的操作，请忽略此邮件。</p>
    </div>
  `;

  return await sendEmail(email, subject, htmlBody);
};

// 发送重置密码邮件
const sendPasswordResetEmail = async (email, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

  const subject = '重置您的MarkNota密码';
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">重置密码</h2>
      <p>您收到此邮件是因为有人请求重置MarkNota账户的密码。</p>
      <p>请点击下面的链接重置您的密码：</p>
      <a href="${resetUrl}" style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 16px 0;">
        重置密码
      </a>
      <p>如果您无法点击链接，请复制以下URL到浏览器中打开：</p>
      <p style="word-break: break-all; color: #666;">${resetUrl}</p>
      <p style="color: #999; font-size: 12px;">此链接将在1小时后过期。</p>
      <p>如果这不是您的操作，请忽略此邮件。</p>
    </div>
  `;

  return await sendEmail(email, subject, htmlBody);
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
};
