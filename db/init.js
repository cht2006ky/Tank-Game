// 数据库初始化脚本 - 创建 users 表
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tank_game',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '111111',
});

async function initDB() {
  const client = await pool.connect();
  try {
    // 创建用户表
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('users 表创建成功（或已存在）');

    // 创建游戏记录表
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_records (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        scenario VARCHAR(100),
        final_score INTEGER DEFAULT 0,
        result VARCHAR(20),
        played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('game_records 表创建成功（或已存在）');
  } catch (err) {
    console.error('创建表失败:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

initDB();
