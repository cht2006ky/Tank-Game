const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL 连接配置（Neon 云数据库）
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_t1NpWB5KZkVy@ep-tiny-night-aol2whvh-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
  ssl: {
    rejectUnauthorized: false,
  },
});

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'tank-game-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24小时
    httpOnly: true,
  },
}));

// 静态文件
app.use(express.static(path.join(__dirname)));

// 认证中间件 - 未登录重定向到登录页
function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login.html');
  }
}

// ============ 路由 ============

// 首页（游戏页面）- 无需登录即可访问
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 注册 API
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  if (username.length < 2 || username.length > 50) {
    return res.status(400).json({ error: '用户名长度需在2-50之间' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '密码长度至少6位' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
      [username, hashedPassword]
    );

    // 注册成功自动登录
    req.session.userId = result.rows[0].id;
    req.session.username = result.rows[0].username;

    res.json({ success: true, username: result.rows[0].username });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: '用户名已存在' });
    }
    console.error('注册错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 登录 API
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, password FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 登录成功
    req.session.userId = user.id;
    req.session.username = user.username;

    res.json({ success: true, username: user.username });
  } catch (err) {
    console.error('登录错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 登出 API
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// 获取当前用户信息
app.get('/api/me', (req, res) => {
  if (req.session.userId) {
    res.json({ loggedIn: true, username: req.session.username });
  } else {
    res.json({ loggedIn: false });
  }
});

// 保存游戏记录 API（需要登录）
app.post('/api/game-records', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: '请先登录' });
  }

  const { scenario, final_score, result } = req.body;

  if (!scenario || final_score === undefined || !result) {
    return res.status(400).json({ error: '缺少游戏记录字段' });
  }

  try {
    await pool.query(
      'INSERT INTO game_records (user_id, scenario, final_score, result) VALUES ($1, $2, $3, $4)',
      [req.session.userId, scenario, final_score, result]
    );
    res.json({ success: true, message: '游戏记录已保存' });
  } catch (err) {
    console.error('保存游戏记录错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取当前用户游戏记录 API（需要登录）
app.get('/api/game-records', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: '请先登录' });
  }

  try {
    const result = await pool.query(
      'SELECT id, scenario, final_score, result, played_at FROM game_records WHERE user_id = $1 ORDER BY played_at DESC LIMIT 50',
      [req.session.userId]
    );
    res.json({ success: true, records: result.rows });
  } catch (err) {
    console.error('获取游戏记录错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取排行榜 API（公开，无需登录）
app.get('/api/leaderboard', async (req, res) => {
  try {
    // 获取每个用户的最高分
    const result = await pool.query(`
      SELECT 
        u.username,
        MAX(gr.final_score) as best_score,
        COUNT(gr.id) as games_played
      FROM game_records gr
      JOIN users u ON gr.user_id = u.id
      GROUP BY u.id, u.username
      ORDER BY best_score DESC
      LIMIT 10
    `);
    res.json({ success: true, leaderboard: result.rows });
  } catch (err) {
    console.error('获取排行榜错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`坦克大战服务器运行在 http://localhost:${PORT}`);
});
