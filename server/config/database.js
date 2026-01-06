// 临时使用简单的PostgreSQL连接，直到Prisma问题解决
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// 创建连接池
let pool;
let useMockDb = false;

// 检查是否应该使用模拟数据库
const shouldUseMockDb = !process.env.DATABASE_URL || process.env.USE_MOCK_DB === 'true';

if (shouldUseMockDb) {
  console.log('🔄 使用内存数据库模式（开发环境推荐）');
  useMockDb = true;
} else {
  console.log('🔌 尝试连接PostgreSQL数据库...');
  console.log('📍 数据库URL:', process.env.DATABASE_URL.replace(/:[^:]*@/, ':***@')); // 隐藏密码

  let connectionTested = false;

  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5, // 减少连接数
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, // 增加连接超时时间到10秒
      query_timeout: 10000, // 查询超时10秒
    });

    // 测试数据库连接
    pool.on('connect', () => {
      console.log('✅ 数据库连接成功');
      useMockDb = false; // 连接成功时使用真实数据库
    });

    pool.on('error', (err) => {
      console.error('❌ 数据库连接错误:', err.message);
      if (!useMockDb && !connectionTested) {
        console.log('🔄 切换到内存数据库模式');
        useMockDb = true;
        connectionTested = true;
      }
    });

    // 异步测试连接 - 立即测试
    (async () => {
      try {
        console.log('🔍 测试数据库连接...');
        const client = await pool.connect();
        await client.query('SELECT 1'); // 简单查询测试
        console.log('✅ 数据库连接测试成功');
        client.release();
        connectionTested = true;
      } catch (error) {
        console.error('❌ 数据库连接测试失败:', error.message);
        console.log('🔄 切换到内存数据库模式');
        useMockDb = true;
        connectionTested = true;

        // 关闭连接池以避免进一步的连接尝试
        if (pool) {
          pool.end().catch(err => console.error('关闭连接池失败:', err));
        }
      }
    })();

  } catch (error) {
    console.log('❌ 无法创建数据库连接池，使用内存数据库');
    console.log('错误详情:', error.message);
    useMockDb = true;
    connectionTested = true;
  }
}

// 内存数据库存储
let mockDb = {
  users: [],
  coin_transactions: [],
  daily_sign_ins: []
};

// 加载内存数据
const MOCK_DB_FILE = path.join(__dirname, '../data/mock-db.json');
async function loadMockDb() {
  try {
    const data = await fs.readFile(MOCK_DB_FILE, 'utf8');
    mockDb = JSON.parse(data);
    console.log('📂 内存数据库已加载');
  } catch (error) {
    console.log('📝 创建新的内存数据库');
    await saveMockDb();
  }
}

async function saveMockDb() {
  try {
    await fs.mkdir(path.dirname(MOCK_DB_FILE), { recursive: true });
    await fs.writeFile(MOCK_DB_FILE, JSON.stringify(mockDb, null, 2));
  } catch (error) {
    console.error('❌ 保存内存数据库失败:', error);
  }
}

// 初始化内存数据库
loadMockDb();

// 简单的查询函数 (临时替代Prisma)
const db = {
  // 用户相关
  async createUser(data) {
    if (useMockDb) {
      const user = {
        id: Date.now().toString(),
        email: data.email,
        username: data.username,
        password: data.password,
        emailVerificationToken: data.emailVerificationToken,
        emailVerificationExpires: data.emailVerificationExpires,
        mCoins: data.mCoins || 0,
        emailVerified: false,
        avatar: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockDb.users.push(user);
      await saveMockDb();
      return user;
    }

    const query = `
      INSERT INTO users (email, username, password, "emailVerificationToken", "emailVerificationExpires", "mCoins", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
    `;
    const values = [data.email, data.username, data.password, data.emailVerificationToken, data.emailVerificationExpires, data.mCoins || 0];
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  async findUserByEmail(email) {
    if (useMockDb) {
      return mockDb.users.find(user => user.email === email);
    }
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  },

  async findUserByUsername(username) {
    if (useMockDb) {
      return mockDb.users.find(user => user.username === username);
    }
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0];
  },

  async findUserById(id) {
    if (useMockDb) {
      return mockDb.users.find(user => user.id === id);
    }
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  },

  async updateUser(id, data) {
    if (useMockDb) {
      const userIndex = mockDb.users.findIndex(user => user.id === id);
      if (userIndex >= 0) {
        mockDb.users[userIndex] = { ...mockDb.users[userIndex], ...data, updatedAt: new Date() };
        await saveMockDb();
        return mockDb.users[userIndex];
      }
      return null;
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(data).forEach(key => {
      fields.push(`"${key}" = $${paramIndex}`);
      values.push(data[key]);
      paramIndex++;
    });

    values.push(id); // WHERE id = $n

    const query = `
      UPDATE users
      SET ${fields.join(', ')}, "updatedAt" = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  // M币相关
  async createCoinTransaction(data) {
    if (useMockDb) {
      const transaction = {
        id: Date.now().toString(),
        userId: data.userId,
        type: data.type,
        amount: data.amount,
        reason: data.reason,
        description: data.description,
        createdAt: new Date()
      };
      mockDb.coin_transactions.push(transaction);
      await saveMockDb();
      return transaction;
    }

    const query = `
      INSERT INTO coin_transactions ("userId", type, amount, reason, description, "createdAt")
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;
    const values = [data.userId, data.type, data.amount, data.reason, data.description];
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  async getCoinTransactions(userId, limit = 10) {
    if (useMockDb) {
      return mockDb.coin_transactions
        .filter(transaction => transaction.userId === userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit);
    }
    const result = await pool.query(
      'SELECT * FROM coin_transactions WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT $2',
      [userId, limit]
    );
    return result.rows;
  },

  async getCoinBalance(userId) {
    if (useMockDb) {
      const user = mockDb.users.find(u => u.id === userId);
      return user?.mCoins || 0;
    }
    const result = await pool.query('SELECT "mCoins" FROM users WHERE id = $1', [userId]);
    return result.rows[0]?.mCoins || 0;
  },

  // 签到相关
  async createDailySignIn(data) {
    if (useMockDb) {
      const signIn = {
        id: Date.now().toString(),
        userId: data.userId,
        date: data.date,
        mCoins: data.mCoins,
        createdAt: new Date()
      };
      mockDb.daily_sign_ins.push(signIn);
      await saveMockDb();
      return signIn;
    }

    const query = `
      INSERT INTO daily_sign_ins ("userId", date, "mCoins", "createdAt")
      VALUES ($1, $2, $3, NOW())
      RETURNING *
    `;
    const values = [data.userId, data.date, data.mCoins];
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  async findDailySignIn(userId, date) {
    if (useMockDb) {
      return mockDb.daily_sign_ins.find(signIn =>
        signIn.userId === userId &&
        new Date(signIn.date).toDateString() === new Date(date).toDateString()
      );
    }
    const result = await pool.query(
      'SELECT * FROM daily_sign_ins WHERE "userId" = $1 AND date = $2',
      [userId, date]
    );
    return result.rows[0];
  },

  async getRecentSignIns(userId, days = 7) {
    if (useMockDb) {
      return mockDb.daily_sign_ins
        .filter(signIn => signIn.userId === userId)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, days);
    }
    const result = await pool.query(
      'SELECT * FROM daily_sign_ins WHERE "userId" = $1 ORDER BY date DESC LIMIT $2',
      [userId, days]
    );
    return result.rows;
  },

  // 每日签到 (使用事务)
  async dailySignIn(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 检查今天是否已经签到
    const existingSignIn = await this.findDailySignIn(userId, today);
    if (existingSignIn) {
      throw new Error('今天已经签到了');
    }

    // 计算连续签到天数
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdaySignIn = await this.findDailySignIn(userId, yesterday);

    // 计算奖励M币
    let mCoinsEarned = 1; // 基础奖励
    if (yesterdaySignIn) {
      // 连续签到奖励
      mCoinsEarned = Math.min(yesterdaySignIn.mCoins + 1, 7); // 最多7币
    }

    if (useMockDb) {
      // 模拟事务操作
      const userIndex = mockDb.users.findIndex(user => user.id === userId);
      if (userIndex < 0) {
        throw new Error('用户不存在');
      }

      const signIn = {
        id: Date.now().toString(),
        userId,
        date: today,
        mCoins: mCoinsEarned,
        createdAt: new Date()
      };

      const transaction = {
        id: (Date.now() + 1).toString(),
        userId,
        type: 'earn',
        amount: mCoinsEarned,
        reason: 'daily_sign_in',
        description: `每日签到奖励 ${mCoinsEarned} M币`,
        createdAt: new Date()
      };

      // 更新用户M币
      mockDb.users[userIndex].mCoins += mCoinsEarned;
      mockDb.users[userIndex].updatedAt = new Date();

      // 添加记录
      mockDb.daily_sign_ins.push(signIn);
      mockDb.coin_transactions.push(transaction);

      await saveMockDb();

      return {
        signIn,
        updatedUser: mockDb.users[userIndex],
        coinsEarned: mCoinsEarned,
      };
    }

    // 开始事务
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 创建签到记录
      const signInResult = await client.query(
        'INSERT INTO daily_sign_ins ("userId", date, "mCoins", "createdAt") VALUES ($1, $2, $3, NOW()) RETURNING *',
        [userId, today, mCoinsEarned]
      );

      // 增加用户M币
      const userResult = await client.query(
        'UPDATE users SET "mCoins" = "mCoins" + $1, "updatedAt" = NOW() WHERE id = $2 RETURNING id, "mCoins"',
        [mCoinsEarned, userId]
      );

      // 创建交易记录
      await client.query(
        'INSERT INTO coin_transactions ("userId", type, amount, reason, description, "createdAt") VALUES ($1, $2, $3, $4, $5, NOW())',
        [userId, 'earn', mCoinsEarned, 'daily_sign_in', `每日签到奖励 ${mCoinsEarned} M币`]
      );

      await client.query('COMMIT');

      return {
        signIn: signInResult.rows[0],
        updatedUser: userResult.rows[0],
        coinsEarned: mCoinsEarned,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // 消费M币 (使用事务)
  async spendCoins(userId, amount, reason, description) {
    if (useMockDb) {
      const userIndex = mockDb.users.findIndex(user => user.id === userId);
      if (userIndex < 0) {
        throw new Error('用户不存在');
      }

      const user = mockDb.users[userIndex];
      if (user.mCoins < amount) {
        throw new Error('M币余额不足');
      }

      // 扣除M币
      user.mCoins -= amount;
      user.updatedAt = new Date();

      const transaction = {
        id: Date.now().toString(),
        userId,
        type: 'spend',
        amount,
        reason,
        description,
        createdAt: new Date()
      };

      mockDb.coin_transactions.push(transaction);
      await saveMockDb();

      return {
        updatedUser: user,
        transaction,
      };
    }

    // 开始事务
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 检查用户余额
      const userResult = await client.query('SELECT "mCoins" FROM users WHERE id = $1', [userId]);
      const user = userResult.rows[0];

      if (!user) {
        throw new Error('用户不存在');
      }

      if (user.mCoins < amount) {
        throw new Error('M币余额不足');
      }

      // 扣除M币
      const updateResult = await client.query(
        'UPDATE users SET "mCoins" = "mCoins" - $1, "updatedAt" = NOW() WHERE id = $2 RETURNING id, "mCoins"',
        [amount, userId]
      );

      // 创建交易记录
      const transactionResult = await client.query(
        'INSERT INTO coin_transactions ("userId", type, amount, reason, description, "createdAt") VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
        [userId, 'spend', amount, reason, description]
      );

      await client.query('COMMIT');

      return {
        updatedUser: updateResult.rows[0],
        transaction: transactionResult.rows[0],
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
};

// 导出数据库接口
const dbInterface = { ...db };

// 只在PostgreSQL可用时导出pool
if (!useMockDb && pool) {
  dbInterface.pool = pool;
}

module.exports = dbInterface;
