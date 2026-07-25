# 坦克大战 Tank Game

经典 NES 风格的网页坦克大战游戏，支持用户系统、游戏记录和排行榜功能。

A classic NES-style web tank battle game with user system, game records and leaderboard.

## 功能特性 / Features

- **经典游戏玩法 / Classic Gameplay**：保护基地，消灭敌方坦克 / Protect the base, destroy enemy tanks
- **用户系统 / User System**：注册、登录、个人中心 / Register, login, personal center
- **游戏记录 / Game Records**：自动保存每局游戏得分和结果 / Auto-save game scores and results
- **排行榜 / Leaderboard**：查看全服 TOP 10 最高分排名 / View TOP 10 highest scores
- **响应式设计 / Responsive Design**：支持电脑和手机端 / Support desktop and mobile
- **NES 像素风格 / NES Pixel Style**：复古游戏画面 / Retro game graphics

## 技术栈 / Tech Stack

- **前端 / Frontend**：HTML5 Canvas + JavaScript (原生/vanilla)
- **后端 / Backend**：Node.js + Express
- **数据库 / Database**：PostgreSQL
- **用户注册与会话管理 / User Registration & Session Management**

## 项目结构 / Project Structure

```
Tank Game/
├── index.html          # 游戏首页 / Game homepage
├── game.js             # 游戏核心逻辑 / Game core logic
├── style.css           # 游戏样式 / Game styles
├── auth.css            # 认证页面样式 / Auth page styles
├── login.html          # 登录页面 / Login page
├── register.html       # 注册页面 / Register page
├── profile.html        # 个人中心页面 / Profile page
├── server.js           # Express 服务器 / Express server
├── package.json        # 项目配置 / Project config
├── db/
│   └── init.js         # 数据库初始化脚本 / Database init script
└── 运行说明.md / README_CN.md  # 详细运行说明 / Detailed instructions
```

## 快速开始 / Quick Start

### 1. 安装依赖 / Install Dependencies

```bash
npm install
```

### 2. 配置数据库 / Configure Database

确保 PostgreSQL 已安装并运行，创建数据库：

Make sure PostgreSQL is installed and running, create database:

```sql
CREATE DATABASE tank_game;
```

初始化数据库表 / Initialize database tables:

```bash
npm run init-db
```

### 3. 启动服务器 / Start Server

```bash
npm start
```

### 4. 访问游戏 / Access Game

打开浏览器访问 / Open browser and visit: http://localhost:3000

## 数据库配置 / Database Configuration

可通过环境变量自定义配置：

Customize via environment variables:

```bash
# Windows
set DB_HOST=localhost
set DB_PORT=5432
set DB_NAME=tank_game
set DB_USER=postgres
set DB_PASSWORD=your_password

# Linux/Mac
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=tank_game
export DB_USER=postgres
export DB_PASSWORD=your_password
```

## 游戏操作 / Controls

| 操作 / Action | 电脑端 / Desktop | 手机端 / Mobile |
|---------------|------------------|-----------------|
| 移动 / Move | W A S D 或 方向键 / Arrow keys | 左下方向键 / D-pad |
| 射击 / Fire | 空格键 / Space | 右下 🔥 按钮 / Fire button |
| 开始 / Start | 回车 / 空格 / Enter / Space | 点击画面 / Tap screen |

## 游戏规则 / Game Rules

- 目标：保护底部的鹰标基地，消灭全部 30 辆敌方坦克获胜
- Goal: Protect the eagle base, destroy all 30 enemy tanks to win
- 玩家拥有 3 条生命，被击中后短暂无敌重生
- Player has 3 lives, brief invincibility after respawn
- 砖墙可被子弹摧毁，钢墙不可摧毁
- Brick walls can be destroyed, steel walls cannot
- 基地被击中 → 直接失败
- Base hit → Game Over

## API 接口 / API Endpoints

| 接口 / Endpoint | 方法 / Method | 说明 / Description |
|-----------------|---------------|---------------------|
| /api/register | POST | 用户注册 / User registration |
| /api/login | POST | 用户登录 / User login |
| /api/logout | POST | 用户登出 / User logout |
| /api/me | GET | 获取当前用户信息 / Get current user info |
| /api/game-records | POST | 保存游戏记录 / Save game record |
| /api/game-records | GET | 获取个人游戏记录 / Get personal records |
| /api/leaderboard | GET | 获取排行榜 / Get leaderboard |

## 作者 / Author

cht2026ai