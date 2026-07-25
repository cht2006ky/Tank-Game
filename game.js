// ============================================================
// 坦克大战 - 经典NES风格网页游戏
// ============================================================

(function () {
    'use strict';

    // ---- 常量 ----
    const TILE = 32;            // 每格像素（逻辑尺寸）
    const COLS = 13;
    const ROWS = 13;
    const MAP_W = COLS * TILE;  // 416
    const MAP_H = ROWS * TILE;  // 416

    // 地图元素
    const E = 0;  // 空地
    const B = 1;  // 砖墙
    const S = 2;  // 钢墙
    const W = 3;  // 水
    const G = 4;  // 草地(可穿过)

    // 关卡地图 13x13  (6,12)=基地鹰标, 用E占位由drawBase绘制
    // col 4 = 玩家出生点, col 8 = 第二玩家出生点, 保持空地
    const LEVEL_MAP = [
        [E,E,E,E,E,E,E,E,E,E,E,E,E],
        [E,E,B,B,E,B,E,B,E,B,B,E,E],
        [E,E,B,B,E,B,E,B,E,B,B,E,E],
        [E,E,B,B,E,B,S,B,E,B,B,E,E],
        [E,E,B,B,E,E,E,E,E,B,B,E,E],
        [B,B,E,E,B,E,E,E,B,E,E,B,B],
        [E,E,E,E,E,B,B,B,E,E,E,E,E],
        [E,E,B,E,B,B,E,B,B,E,B,E,E],
        [E,E,B,E,E,E,E,E,E,E,B,E,E],
        [E,E,B,E,E,B,E,B,E,E,B,E,E],
        [E,E,E,E,E,B,E,B,E,E,E,E,E],
        [E,E,E,E,E,B,E,B,E,E,E,E,E],
        [E,E,E,E,E,B,E,B,E,E,E,E,E],
    ];

    // 方向
    const UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;
    const DX = [0, 1, 0, -1];
    const DY = [-1, 0, 1, 0];

    // 游戏参数
    const PLAYER_SPEED = 5;
    const ENEMY_SPEED = 3;
    const BULLET_SPEED = 16;
    const MAX_ENEMIES = 12;        // 同时在场最大敌人数
    const TOTAL_ENEMIES = 30;     // 本关总敌人数
    const PLAYER_LIVES = 3;
    const SHOOT_COOLDOWN = 5;    // 射击冷却帧数
    const RESPAWN_TIME = 90;      // 重生帧数
    const INVINCIBLE_TIME = 120;  // 无敌帧数

    // ---- NES 调色板 ----
    const C = {
        black:     '#000000',
        gray:      '#7C7C7C',
        darkGray:  '#4C4C4C',
        white:     '#FCFCFC',
        brick:     '#C84C0C',
        brickDark: '#A43000',
        steel:     '#BCBCBC',
        steelDark: '#7C7C7C',
        water:     '#0058F8',
        waterDark: '#003CBC',
        grass:     '#00A800',
        grassDark: '#007800',
        player:    '#FCFCFC',
        playerGun: '#BCBCBC',
        enemy:     '#C84C0C',
        enemyGun:  '#8C5C00',
        bullet:    '#FCFCFC',
        base:      '#FC9838',
        baseDead:  '#7C0000',
        shield:    '#00A800',
        explode:   '#FC9838',
    };

    // ---- Canvas ----
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
        const wrapper = document.getElementById('game-container');
        const maxW = wrapper.clientWidth;
        const maxH = wrapper.clientHeight;
        const scale = Math.min(maxW / MAP_W, maxH / MAP_H);
        canvas.width = MAP_W;
        canvas.height = MAP_H;
        canvas.style.width = (MAP_W * scale) + 'px';
        canvas.style.height = (MAP_H * scale) + 'px';
    }
    window.addEventListener('resize', resizeCanvas);

    // ---- 音效 (Web Audio 简易合成) ----
    let audioCtx = null;
    function getAudio() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        return audioCtx;
    }
    function playSound(freq, dur, type) {
        try {
            const a = getAudio();
            const o = a.createOscillator();
            const g = a.createGain();
            o.type = type || 'square';
            o.frequency.value = freq;
            g.gain.value = 0.08;
            g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
            o.connect(g);
            g.connect(a.destination);
            o.start();
            o.stop(a.currentTime + dur);
        } catch(e) {}
    }
    function sfxShoot()    { playSound(800, 0.08, 'square'); }
    function sfxExplode()  { playSound(120, 0.25, 'sawtooth'); }
    function sfxHit()      { playSound(300, 0.1, 'square'); }
    function sfxGameOver() { playSound(100, 0.8, 'sawtooth'); }

    // ---- 游戏状态 ----
    let gameState = 'menu'; // menu | playing | gameover | victory
    let map = [];
    let player = null;
    let enemies = [];
    let bullets = [];
    let explosions = [];
    let spawnPoints = [];
    let enemiesKilled = 0;
    let enemiesSpawned = 0;
    let spawnTimer = 0;
    let baseAlive = true;
    let keys = {};
    let mobileDir = -1;
    let mobileFire = false;
    let frameCount = 0;

    // ---- 地图操作 ----
    function cloneMap() {
        return LEVEL_MAP.map(r => r.slice());
    }

    function tileAt(col, row) {
        if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return S;
        return map[row][col];
    }

    function isBlocking(tile) {
        return tile === B || tile === S || tile === W;
    }

    // 砖墙被击中时只破坏半格，这里简化为整格破坏
    function destroyTile(col, row) {
        if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
        if (map[row][col] === B) {
            map[row][col] = E;
        }
    }

    // ---- 坦克 ----
    function createTank(col, row, dir, isPlayer) {
        return {
            x: col * TILE,
            y: row * TILE,
            dir: dir,
            isPlayer: isPlayer,
            speed: isPlayer ? PLAYER_SPEED : ENEMY_SPEED,
            alive: true,
            shootCooldown: 0,
            invincible: isPlayer ? INVINCIBLE_TIME : 0,
            respawnTimer: 0,
            aiTimer: 0,
            aiShootTimer: 0,
        };
    }

    function tankRect(t) {
        return { x: t.x, y: t.y, w: TILE, h: TILE };
    }

    function tankCol(t) { return Math.floor((t.x + TILE/2) / TILE); }
    function tankRow(t) { return Math.floor((t.y + TILE/2) / TILE); }

    function snapToGrid(t) {
        // 网格对齐：转弯时对齐到最近的格子
        if (t.dir === UP || t.dir === DOWN) {
            t.x = Math.round(t.x / TILE) * TILE;
        } else {
            t.y = Math.round(t.y / TILE) * TILE;
        }
    }

    function canMoveTo(t, nx, ny) {
        // 边界
        if (nx < 0 || ny < 0 || nx + TILE > MAP_W || ny + TILE > MAP_H) return false;
        // 地图碰撞
        const c1 = Math.floor(nx / TILE);
        const r1 = Math.floor(ny / TILE);
        const c2 = Math.floor((nx + TILE - 1) / TILE);
        const r2 = Math.floor((ny + TILE - 1) / TILE);
        for (let r = r1; r <= r2; r++) {
            for (let c = c1; c <= c2; c++) {
                if (isBlocking(tileAt(c, r))) return false;
            }
        }
        // 与其他坦克碰撞
        const allTanks = player && player.alive ? [player, ...enemies] : [...enemies];
        for (const other of allTanks) {
            if (other === t || !other.alive) continue;
            if (nx < other.x + TILE && nx + TILE > other.x &&
                ny < other.y + TILE && ny + TILE > other.y) return false;
        }
        // 基地碰撞
        if (baseAlive) {
            const bx = 6 * TILE, by = 12 * TILE;
            if (nx < bx + TILE && nx + TILE > bx && ny < by + TILE && ny + TILE > by) return false;
        }
        return true;
    }

    function moveTank(t, dir) {
        if (t.dir !== dir) {
            t.dir = dir;
            snapToGrid(t);
        }
        const nx = t.x + DX[dir] * t.speed;
        const ny = t.y + DY[dir] * t.speed;
        if (canMoveTo(t, nx, ny)) {
            t.x = nx;
            t.y = ny;
        }
    }

    // ---- 子弹 ----
    function createBullet(tank) {
        const cx = tank.x + TILE / 2;
        const cy = tank.y + TILE / 2;
        const size = 6;
        let bx, by;
        if (tank.dir === UP)    { bx = cx - size/2; by = tank.y - size; }
        if (tank.dir === DOWN)  { bx = cx - size/2; by = tank.y + TILE; }
        if (tank.dir === LEFT)  { bx = tank.x - size; by = cy - size/2; }
        if (tank.dir === RIGHT) { bx = tank.x + TILE; by = cy - size/2; }
        return {
            x: bx, y: by,
            w: size, h: size,
            dir: tank.dir,
            owner: tank.isPlayer ? 'player' : 'enemy',
        };
    }

    function shoot(tank) {
        if (tank.shootCooldown > 0) return;
        // 限制同阵营子弹数量
        const myBullets = bullets.filter(b => b.owner === (tank.isPlayer ? 'player' : 'enemy'));
        const maxB = tank.isPlayer ? 2 : 1;
        if (myBullets.length >= maxB) return;
        bullets.push(createBullet(tank));
        tank.shootCooldown = SHOOT_COOLDOWN;
        sfxShoot();
    }

    // ---- 爆炸 ----
    function createExplosion(x, y, big) {
        explosions.push({ x, y, timer: big ? 20 : 12, big });
    }

    // ---- 碰撞检测 ----
    function rectsOverlap(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x &&
               a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function updateBullets() {
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.x += DX[b.dir] * BULLET_SPEED;
            b.y += DY[b.dir] * BULLET_SPEED;

            // 出界
            if (b.x < -b.w || b.y < -b.h || b.x > MAP_W || b.y > MAP_H) {
                bullets.splice(i, 1);
                continue;
            }

            // 碰地图
            const c1 = Math.floor(b.x / TILE);
            const r1 = Math.floor(b.y / TILE);
            const c2 = Math.floor((b.x + b.w - 1) / TILE);
            const r2 = Math.floor((b.y + b.h - 1) / TILE);
            let hitWall = false;
            for (let r = r1; r <= r2; r++) {
                for (let c = c1; c <= c2; c++) {
                    const tile = tileAt(c, r);
                    if (tile === B) {
                        destroyTile(c, r);
                        hitWall = true;
                        sfxHit();
                    } else if (tile === S) {
                        hitWall = true;
                        sfxHit();
                    }
                }
            }
            if (hitWall) {
                createExplosion(b.x, b.y, false);
                bullets.splice(i, 1);
                continue;
            }

            // 碰基地
            if (baseAlive) {
                const baseRect = { x: 6 * TILE, y: 12 * TILE, w: TILE, h: TILE };
                if (rectsOverlap(b, baseRect)) {
                    baseAlive = false;
                    createExplosion(6 * TILE, 12 * TILE, true);
                    sfxExplode();
                    bullets.splice(i, 1);
                    gameState = 'gameover';
                    sfxGameOver();
                    continue;
                }
            }

            // 碰坦克
            // 玩家子弹碰敌人
            if (b.owner === 'player') {
                for (let j = enemies.length - 1; j >= 0; j--) {
                    const en = enemies[j];
                    if (!en.alive) continue;
                    if (rectsOverlap(b, tankRect(en))) {
                        en.alive = false;
                        createExplosion(en.x, en.y, true);
                        sfxExplode();
                        enemiesKilled++;
                        bullets.splice(i, 1);
                        if (enemiesKilled >= TOTAL_ENEMIES) {
                            gameState = 'victory';
                        }
                        break;
                    }
                }
            }
            // 敌人子弹碰玩家
            if (b.owner === 'enemy' && player && player.alive) {
                if (rectsOverlap(b, tankRect(player))) {
                    if (player.invincible <= 0) {
                        player.alive = false;
                        createExplosion(player.x, player.y, true);
                        sfxExplode();
                        player.lives--;
                        if (player.lives <= 0) {
                            gameState = 'gameover';
                            sfxGameOver();
                        } else {
                            player.respawnTimer = RESPAWN_TIME;
                        }
                    }
                    bullets.splice(i, 1);
                    continue;
                }
            }

            // 子弹碰子弹
            for (let j = bullets.length - 1; j >= 0; j--) {
                if (i === j) continue;
                const b2 = bullets[j];
                if (b.owner !== b2.owner && rectsOverlap(b, b2)) {
                    createExplosion(b.x, b.y, false);
                    bullets.splice(Math.max(i, j), 1);
                    bullets.splice(Math.min(i, j), 1);
                    i = -1;
                    break;
                }
            }
            if (i < 0) continue;
        }
    }

    // ---- 敌人AI ----
    function updateEnemyAI(en) {
        en.aiTimer--;
        en.aiShootTimer--;

        // 随机换方向
        if (en.aiTimer <= 0) {
            en.dir = Math.floor(Math.random() * 4);
            en.aiTimer = 60 + Math.floor(Math.random() * 120);
            snapToGrid(en);
        }

        // 尝试移动，撞墙则换方向
        const nx = en.x + DX[en.dir] * en.speed;
        const ny = en.y + DY[en.dir] * en.speed;
        if (canMoveTo(en, nx, ny)) {
            en.x = nx;
            en.y = ny;
        } else {
            en.dir = Math.floor(Math.random() * 4);
            en.aiTimer = 60 + Math.floor(Math.random() * 60);
            snapToGrid(en);
        }

        // 射击
        if (en.aiShootTimer <= 0) {
            shoot(en);
            en.aiShootTimer = 40 + Math.floor(Math.random() * 60);
        }
    }

    // ---- 敌人刷新 ----
    function spawnEnemy() {
        if (enemiesSpawned >= TOTAL_ENEMIES) return;
        const aliveCount = enemies.filter(e => e.alive).length;
        if (aliveCount >= MAX_ENEMIES) return;

        // 刷新点
        const spawnCols = [0, 6, 12];
        const col = spawnCols[enemiesSpawned % 3];
        const row = 0;

        // 检查刷新点是否被占
        const sx = col * TILE, sy = row * TILE;
        const allTanks = player && player.alive ? [player, ...enemies] : [...enemies];
        let blocked = false;
        for (const t of allTanks) {
            if (!t.alive) continue;
            if (sx < t.x + TILE && sx + TILE > t.x && sy < t.y + TILE && sy + TILE > t.y) {
                blocked = true;
                break;
            }
        }
        if (blocked) return;

        const en = createTank(col, row, DOWN, false);
        en.aiTimer = 60;
        en.aiShootTimer = 30 + Math.floor(Math.random() * 60);
        enemies.push(en);
        enemiesSpawned++;
        createExplosion(sx, sy, false);
    }

    // ---- 玩家重生 ----
    function respawnPlayer() {
        player.x = 4 * TILE;
        player.y = 12 * TILE;
        player.dir = UP;
        player.alive = true;
        player.invincible = INVINCIBLE_TIME;
        player.shootCooldown = 0;
    }

    // ---- 绘制 ----
    function drawTile(col, row, tile) {
        const x = col * TILE, y = row * TILE;
        if (tile === B) {
            ctx.fillStyle = C.brick;
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = C.brickDark;
            // 砖纹
            for (let br = 0; br < 4; br++) {
                for (let bc = 0; bc < 4; bc++) {
                    const bx = x + bc * 8;
                    const by = y + br * 8;
                    if ((br + bc) % 2 === 0) {
                        ctx.fillRect(bx, by, 8, 1);
                        ctx.fillRect(bx, by, 1, 8);
                    }
                }
            }
        } else if (tile === S) {
            ctx.fillStyle = C.steel;
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = C.steelDark;
            ctx.fillRect(x, y, TILE, 2);
            ctx.fillRect(x, y, 2, TILE);
            ctx.fillRect(x + TILE - 2, y, 2, TILE);
            ctx.fillRect(x, y + TILE - 2, TILE, 2);
            // 钢纹
            ctx.fillRect(x + 8, y + 8, 16, 2);
            ctx.fillRect(x + 8, y + 22, 16, 2);
        } else if (tile === W) {
            ctx.fillStyle = C.water;
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = C.waterDark;
            const waveOff = Math.sin(frameCount * 0.05 + col) * 3;
            for (let i = 0; i < 3; i++) {
                ctx.fillRect(x, y + 8 + i * 10 + waveOff, TILE, 2);
            }
        } else if (tile === G) {
            // 草地在坦克上方绘制，这里先跳过
        }
    }

    function drawGrass(col, row) {
        const x = col * TILE, y = row * TILE;
        ctx.fillStyle = C.grass;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = C.grassDark;
        for (let i = 0; i < 8; i++) {
            const gx = x + (i % 4) * 8 + 2;
            const gy = y + Math.floor(i / 4) * 16 + 2;
            ctx.fillRect(gx, gy, 4, 12);
        }
    }

    function drawBase() {
        const x = 6 * TILE, y = 12 * TILE;
        if (baseAlive) {
            // 鹰标志
            ctx.fillStyle = C.base;
            ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
            ctx.fillStyle = C.black;
            ctx.fillRect(x + 8, y + 8, TILE - 16, TILE - 16);
            ctx.fillStyle = C.base;
            // 简单鹰形
            ctx.fillRect(x + 10, y + 6, 12, 4);
            ctx.fillRect(x + 14, y + 6, 4, 20);
            ctx.fillRect(x + 8, y + 14, 16, 4);
            ctx.fillRect(x + 10, y + 22, 4, 4);
            ctx.fillRect(x + 18, y + 22, 4, 4);
        } else {
            ctx.fillStyle = C.baseDead;
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = C.darkGray;
            ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
        }
    }

    function drawTank(t) {
        if (!t.alive) return;
        const x = t.x, y = t.y;
        const isP = t.isPlayer;
        const bodyColor = isP ? C.player : C.enemy;
        const gunColor = isP ? C.playerGun : C.enemyGun;
        const trackColor = isP ? C.darkGray : C.darkGray;

        // 无敌闪烁
        if (t.invincible > 0 && Math.floor(t.invincible / 4) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        ctx.fillStyle = trackColor;
        // 履带
        if (t.dir === UP || t.dir === DOWN) {
            ctx.fillRect(x, y, 8, TILE);
            ctx.fillRect(x + TILE - 8, y, 8, TILE);
        } else {
            ctx.fillRect(x, y, TILE, 8);
            ctx.fillRect(x, y + TILE - 8, TILE, 8);
        }

        // 车身
        ctx.fillStyle = bodyColor;
        ctx.fillRect(x + 6, y + 6, TILE - 12, TILE - 12);

        // 炮管
        ctx.fillStyle = gunColor;
        const cx = x + TILE / 2;
        const cy = y + TILE / 2;
        if (t.dir === UP)    ctx.fillRect(cx - 3, y, 6, TILE / 2);
        if (t.dir === DOWN)  ctx.fillRect(cx - 3, cy, 6, TILE / 2);
        if (t.dir === LEFT)  ctx.fillRect(x, cy - 3, TILE / 2, 6);
        if (t.dir === RIGHT) ctx.fillRect(cx, cy - 3, TILE / 2, 6);

        // 无敌护盾
        if (t.invincible > 0) {
            ctx.strokeStyle = C.shield;
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
        }

        ctx.globalAlpha = 1;
    }

    function drawBullet(b) {
        ctx.fillStyle = C.bullet;
        ctx.fillRect(b.x, b.y, b.w, b.h);
    }

    function drawExplosion(e) {
        const cx = e.x + (e.big ? TILE / 2 : 3);
        const cy = e.y + (e.big ? TILE / 2 : 3);
        const progress = 1 - e.timer / (e.big ? 20 : 12);
        const r = (e.big ? TILE * 0.8 : TILE * 0.3) * (progress < 0.5 ? progress * 2 : 2 - progress * 2);
        ctx.fillStyle = progress < 0.5 ? C.explode : C.white;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(r, 1), 0, Math.PI * 2);
        ctx.fill();
    }

    function drawHUD() {
        // 信息栏在Canvas右侧（我们简化为顶部覆盖文字）
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, MAP_W, 20);
        ctx.fillStyle = C.white;
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('生命: ' + (player ? player.lives : 0), 4, 14);
        ctx.textAlign = 'center';
        ctx.fillText('敌人: ' + (TOTAL_ENEMIES - enemiesKilled), MAP_W / 2, 14);
        ctx.textAlign = 'right';
        ctx.fillText('得分: ' + enemiesKilled * 100, MAP_W - 4, 14);
    }

    function drawMenu() {
        ctx.fillStyle = C.black;
        ctx.fillRect(0, 0, MAP_W, MAP_H);

        ctx.fillStyle = C.white;
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('坦克大战', MAP_W / 2, MAP_H / 2 - 60);

        ctx.font = '14px monospace';
        ctx.fillStyle = C.brick;
        ctx.fillText('BATTLE CITY', MAP_W / 2, MAP_H / 2 - 30);

        ctx.fillStyle = C.white;
        ctx.font = '14px monospace';
        if (Math.floor(frameCount / 30) % 2 === 0) {
            ctx.fillText('按 ENTER 或点击开始', MAP_W / 2, MAP_H / 2 + 30);
        }

        ctx.font = '11px monospace';
        ctx.fillStyle = C.gray;
        ctx.fillText('WASD/方向键 移动 | 空格 射击', MAP_W / 2, MAP_H / 2 + 70);
        ctx.fillText('手机端使用虚拟按键', MAP_W / 2, MAP_H / 2 + 90);
    }

    function drawGameOver() {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, MAP_W, MAP_H);
        ctx.fillStyle = C.enemy;
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', MAP_W / 2, MAP_H / 2 - 10);
        ctx.fillStyle = C.white;
        ctx.font = '14px monospace';
        ctx.fillText('得分: ' + enemiesKilled * 100, MAP_W / 2, MAP_H / 2 + 20);
        if (Math.floor(frameCount / 30) % 2 === 0) {
            ctx.fillText('按 ENTER 重新开始', MAP_W / 2, MAP_H / 2 + 50);
        }
    }

    function drawVictory() {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, MAP_W, MAP_H);
        ctx.fillStyle = C.base;
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('胜利!', MAP_W / 2, MAP_H / 2 - 10);
        ctx.fillStyle = C.white;
        ctx.font = '14px monospace';
        ctx.fillText('得分: ' + enemiesKilled * 100, MAP_W / 2, MAP_H / 2 + 20);
        if (Math.floor(frameCount / 30) % 2 === 0) {
            ctx.fillText('按 ENTER 重新开始', MAP_W / 2, MAP_H / 2 + 50);
        }
    }

    // ---- 主渲染 ----
    function render() {
        ctx.fillStyle = C.black;
        ctx.fillRect(0, 0, MAP_W, MAP_H);

        if (gameState === 'menu') {
            drawMenu();
            return;
        }

        // 地图（非草地）
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (map[r][c] !== G) drawTile(c, r, map[r][c]);
            }
        }

        // 基地
        drawBase();

        // 坦克
        enemies.forEach(drawTank);
        if (player && player.alive) drawTank(player);

        // 草地（覆盖在坦克上方）
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (map[r][c] === G) drawGrass(c, r);
            }
        }

        // 子弹
        bullets.forEach(drawBullet);

        // 爆炸
        explosions.forEach(drawExplosion);

        // HUD
        drawHUD();

        // 结束画面
        if (gameState === 'gameover') drawGameOver();
        if (gameState === 'victory') drawVictory();
    }

    // ---- 更新 ----
    function update() {
        frameCount++;

        if (gameState !== 'playing') return;

        // 玩家输入
        if (player && player.alive) {
            let moved = false;
            if (keys['ArrowUp'] || keys['KeyW'] || mobileDir === UP)    { moveTank(player, UP); moved = true; }
            if (keys['ArrowDown'] || keys['KeyS'] || mobileDir === DOWN)  { moveTank(player, DOWN); moved = true; }
            if (keys['ArrowLeft'] || keys['KeyA'] || mobileDir === LEFT)  { moveTank(player, LEFT); moved = true; }
            if (keys['ArrowRight'] || keys['KeyD'] || mobileDir === RIGHT) { moveTank(player, RIGHT); moved = true; }

            if (keys['Space'] || mobileFire) {
                shoot(player);
            }

            if (player.shootCooldown > 0) player.shootCooldown--;
            if (player.invincible > 0) player.invincible--;
        }

        // 玩家重生
        if (player && !player.alive && player.lives > 0) {
            player.respawnTimer--;
            if (player.respawnTimer <= 0) {
                respawnPlayer();
            }
        }

        // 敌人AI
        for (const en of enemies) {
            if (!en.alive) continue;
            updateEnemyAI(en);
            if (en.shootCooldown > 0) en.shootCooldown--;
        }

        // 刷新敌人
        spawnTimer--;
        if (spawnTimer <= 0) {
            spawnEnemy();
            spawnTimer = 120;
        }

        // 清理死亡敌人
        enemies = enemies.filter(e => e.alive || e.respawnTimer > 0);

        // 更新子弹
        updateBullets();

        // 更新爆炸
        for (let i = explosions.length - 1; i >= 0; i--) {
            explosions[i].timer--;
            if (explosions[i].timer <= 0) explosions.splice(i, 1);
        }
    }

    // ---- 游戏循环 ----
    function gameLoop() {
        update();
        render();
        requestAnimationFrame(gameLoop);
    }

    // ---- 初始化 ----
    function initGame() {
        map = cloneMap();
        // 基地保护砖墙
        map[11][5] = B; map[11][6] = B; map[11][7] = B;
        map[12][5] = B;                   map[12][7] = B;
        player = createTank(4, 12, UP, true);
        player.lives = PLAYER_LIVES;
        player.invincible = INVINCIBLE_TIME;
        enemies = [];
        bullets = [];
        explosions = [];
        enemiesKilled = 0;
        enemiesSpawned = 0;
        spawnTimer = 60;
        baseAlive = true;
        gameState = 'playing';
    }

    // ---- 键盘输入 ----
    document.addEventListener('keydown', function (e) {
        keys[e.code] = true;

        if (e.code === 'Enter' || e.code === 'Space') {
            if (gameState === 'menu') {
                initGame();
                e.preventDefault();
            } else if (gameState === 'gameover' || gameState === 'victory') {
                initGame();
                e.preventDefault();
            }
        }

        // 阻止方向键和空格滚动页面
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
            e.preventDefault();
        }
    });

    document.addEventListener('keyup', function (e) {
        keys[e.code] = false;
    });

    // ---- 移动端触控 ----
    function setupMobileControls() {
        const dpad = document.getElementById('dpad');
        const btnFire = document.getElementById('btn-fire');

        // 方向键
        dpad.querySelectorAll('.dpad-btn').forEach(function (btn) {
            const dirName = btn.dataset.dir;
            const dirMap = { up: UP, down: DOWN, left: LEFT, right: RIGHT };

            function onStart(e) {
                e.preventDefault();
                mobileDir = dirMap[dirName];
                // 如果在菜单/结束画面，也触发开始
                if (gameState === 'menu' || gameState === 'gameover' || gameState === 'victory') {
                    initGame();
                }
            }
            function onEnd(e) {
                e.preventDefault();
                if (mobileDir === dirMap[dirName]) mobileDir = -1;
            }

            btn.addEventListener('touchstart', onStart, { passive: false });
            btn.addEventListener('touchend', onEnd, { passive: false });
            btn.addEventListener('touchcancel', onEnd, { passive: false });
            btn.addEventListener('mousedown', onStart);
            btn.addEventListener('mouseup', onEnd);
            btn.addEventListener('mouseleave', onEnd);
        });

        // 开火键
        function fireStart(e) {
            e.preventDefault();
            mobileFire = true;
            if (gameState === 'menu' || gameState === 'gameover' || gameState === 'victory') {
                initGame();
            }
        }
        function fireEnd(e) {
            e.preventDefault();
            mobileFire = false;
        }

        btnFire.addEventListener('touchstart', fireStart, { passive: false });
        btnFire.addEventListener('touchend', fireEnd, { passive: false });
        btnFire.addEventListener('touchcancel', fireEnd, { passive: false });
        btnFire.addEventListener('mousedown', fireStart);
        btnFire.addEventListener('mouseup', fireEnd);
        btnFire.addEventListener('mouseleave', fireEnd);

        // Canvas点击也可开始游戏
        canvas.addEventListener('click', function () {
            if (gameState === 'menu' || gameState === 'gameover' || gameState === 'victory') {
                initGame();
            }
        });
    }

    // ---- 启动 ----
    function start() {
        resizeCanvas();
        setupMobileControls();
        gameLoop();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }

})();
