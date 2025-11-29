// 対称ゲーム JavaScript（Neon Ignite オーディオリアクティブ版）

// ▼▼▼ エフェクト用パーティクル（発光仕様） ▼▼▼
class Particle {
    constructor(x, y, colors, speedMultiplier = 1) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 10 + 2;
        // 爆発力を強化
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 15 * speedMultiplier;
        this.speedX = Math.cos(angle) * speed;
        this.speedY = Math.sin(angle) * speed;
        
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.life = 1.0;
        this.decay = Math.random() * 0.03 + 0.01;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.speedX *= 0.95; // 摩擦
        this.speedY *= 0.95;
        this.life -= this.decay;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        // パーティクルも光らせる
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class SymmetryGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        
        // ネオンカラーパレット
        this.colors = ['#ff0055', '#00ffcc', '#0099ff', '#ccff00', '#ffcc00', '#ff00cc', '#ffffff'];
        this.colorEmojis = ['🔴', '🔵', '💧', '🟢', '🟡', '🟣', '⚪'];
        this.currentColorIndex = 0;
        this.brushSizes = [3, 6, 12]; // 少し太くした
        this.brushSizeNames = ['小', '中', '大'];
        this.currentSizeIndex = 1;
        this.symmetryModes = [2, 4, 6, 8, 12]; // 12方向を追加
        this.currentSymmetryIndex = 0;
        
        this.drawingHistory = [];
        this.currentStrokePoints = [];
        
        this.isPlaying = false;
        this.animationId = null;
        this.playBtn = document.getElementById('playBtn');
        this.audioElement = document.getElementById('bgm');
        this.audioElement.volume = 0.6;

        // オーディオ解析用
        this.audioCtx = null;
        this.analyser = null;
        this.dataArray = null;
        this.source = null;

        // アニメーションパラメータ
        this.baseRotation = 0;
        this.beatScale = 1;
        this.particles = [];
        
        this.initCanvas();
        this.bindEvents();
        this.updateUI();
        
        // 描画音用（簡易）
        this.drawAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    initCanvas() {
        const container = document.querySelector('.canvas-container');
        const maxWidth = Math.min(600, container.clientWidth - 20); // 少し大きく
        const maxHeight = Math.min(600, window.innerHeight * 0.6);
        this.canvas.width = maxWidth;
        this.canvas.height = maxHeight;
        
        // デフォルト背景
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        if (this.drawingHistory.length > 0 && !this.isPlaying) {
             this.redrawHistory();
        }
    }
    
    bindEvents() {
        document.getElementById('clearBtn').addEventListener('click', () => this.clearCanvas());
        document.getElementById('colorBtn').addEventListener('click', () => this.changeColor());
        document.getElementById('modeBtn').addEventListener('click', () => this.changeSymmetryMode());
        document.getElementById('sizeBtn').addEventListener('click', () => this.changeBrushSize());
        
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());
        
        this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); this.startDrawing(e.touches[0]); });
        this.canvas.addEventListener('touchmove', (e) => { e.preventDefault(); this.draw(e.touches[0]); });
        this.canvas.addEventListener('touchend', (e) => { e.preventDefault(); this.stopDrawing(); });
        
        window.addEventListener('resize', () => { setTimeout(() => this.initCanvas(), 100); });

        this.playBtn.addEventListener('click', () => this.toggleAnimation());
        this.audioElement.addEventListener('ended', () => { if (this.isPlaying) this.toggleAnimation(); });
    }

    // ▼▼▼ オーディオ解析のセットアップ ▼▼▼
    setupAudioAnalyzer() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = 256; // 解像度
            
            // MediaElementSourceを作成して接続
            this.source = this.audioCtx.createMediaElementSource(this.audioElement);
            this.source.connect(this.analyser);
            this.analyser.connect(this.audioCtx.destination); // スピーカーへ
            
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    toggleAnimation() {
        this.isPlaying = !this.isPlaying;
        
        if (this.isPlaying) {
            this.setupAudioAnalyzer(); // 再生時にセットアップ
            
            this.playBtn.textContent = '■ STOP';
            this.playBtn.classList.add('playing');
            document.body.classList.add('neon-mode'); // ダークモードへ
            
            this.audioElement.currentTime = 0;
            this.audioElement.play().catch(e => console.log("Audio play failed:", e));
            
            this.animate();
        } else {
            this.playBtn.textContent = '▶ MUSIC START';
            this.playBtn.classList.remove('playing');
            document.body.classList.remove('neon-mode');
            this.canvas.classList.remove('beat-hit');
            
            this.audioElement.pause();
            cancelAnimationFrame(this.animationId);
            
            this.baseRotation = 0;
            this.beatScale = 1;
            this.particles = [];
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.redrawHistory();
        }
    }

    animate() {
        if (!this.isPlaying) return;
        
        // 周波数データの取得
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // 低音域（バスドラム）の平均音量を取得 (インデックス 0-10あたり)
        let bassSum = 0;
        for(let i=0; i<10; i++) bassSum += this.dataArray[i];
        const bassLevel = bassSum / 10; // 0-255
        
        // 中高域（スネア・メロディ）の平均
        let midSum = 0;
        for(let i=20; i<100; i++) midSum += this.dataArray[i];
        const midLevel = midSum / 80;

        // ビートに合わせたスケール計算 (低音が強いと大きく揺れる)
        const scaleEffect = (bassLevel / 255) * 0.4; 
        this.beatScale = 1.0 + scaleEffect;

        // 回転速度もエネルギーに比例
        this.baseRotation += 0.002 + (midLevel / 255) * 0.02;

        // 背景色の動的変更（激しいときだけ）
        if (bassLevel > 200) {
            document.body.style.background = `radial-gradient(circle, #4a00e0, #000)`;
            this.canvas.classList.add('beat-hit'); // CSSフィルタ発動
        } else {
            this.canvas.classList.remove('beat-hit');
        }

        // キャンバスリセット（黒背景・残像効果）
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; // 残像を残すために半透明の黒で塗りつぶす
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 描画
        this.drawStoredPaths(bassLevel, midLevel);

        // パーティクル生成（高音が強いとき、または定期的に）
        if (midLevel > 150 || Math.random() < 0.1) {
             const pCount = Math.floor(midLevel / 40);
             for(let i=0; i<pCount; i++) {
                 this.particles.push(new Particle(this.centerX, this.centerY, this.colors, 1 + (bassLevel/100)));
             }
        }
        
        // パーティクル更新
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update();
            this.particles[i].draw(this.ctx);
            if (this.particles[i].life <= 0) this.particles.splice(i, 1);
        }

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    drawStoredPaths(bassLevel, midLevel) {
        // 発光設定（ネオン効果）
        this.ctx.shadowBlur = 15 + (bassLevel / 10); // 音に合わせて光が強くなる
        
        this.drawingHistory.forEach((stroke, index) => {
            const symmetryCount = stroke.symmetryCount;
            const angleStep = (2 * Math.PI) / symmetryCount;
            
            // 色を音に合わせてシフトさせる
            const colorShift = Math.floor(midLevel / 30);
            const originalColorIndex = this.colors.indexOf(stroke.color);
            const dynamicColor = this.colors[(originalColorIndex + colorShift) % this.colors.length];
            
            this.ctx.strokeStyle = dynamicColor;
            this.ctx.shadowColor = dynamicColor; // 光の色も合わせる
            
            // 音が大きいと線も太くなる
            this.ctx.lineWidth = stroke.size * (1 + bassLevel/300);

            for (let i = 0; i < symmetryCount; i++) {
                const angle = i * angleStep + this.baseRotation;
                
                this.ctx.save();
                this.ctx.translate(this.centerX, this.centerY);
                this.ctx.rotate(angle);
                this.ctx.scale(this.beatScale, this.beatScale);
                this.ctx.translate(-this.centerX, -this.centerY);

                if (stroke.points.length > 1) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
                    for (let j = 1; j < stroke.points.length; j++) {
                        this.ctx.lineTo(stroke.points[j].x, stroke.points[j].y);
                    }
                    this.ctx.stroke();

                    // ミラー描画
                    if (symmetryCount > 2) {
                         this.ctx.beginPath();
                         let startRefX = this.centerX - (stroke.points[0].x - this.centerX);
                         this.ctx.moveTo(startRefX, stroke.points[0].y);
                         for (let j = 1; j < stroke.points.length; j++) {
                             let refX = this.centerX - (stroke.points[j].x - this.centerX);
                             this.ctx.lineTo(refX, stroke.points[j].y);
                         }
                         this.ctx.stroke();
                    }
                }
                this.ctx.restore();
            }
        });
        
        // 設定リセット
        this.ctx.shadowBlur = 0;
    }

    // ▼▼▼ 以下、通常描画機能（大きな変更なし） ▼▼▼
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
            y: (e.clientY - rect.top) * (this.canvas.height / rect.height)
        };
    }
    
    startDrawing(e) {
        if (this.isPlaying) return;
        if (this.drawAudioCtx.state === 'suspended') this.drawAudioCtx.resume();
        
        this.isDrawing = true;
        const pos = this.getMousePos(e);
        this.lastX = pos.x;
        this.lastY = pos.y;
        this.currentStrokePoints = [{x: pos.x, y: pos.y}];
    }
    
    draw(e) {
        if (!this.isDrawing || this.isPlaying) return;
        const pos = this.getMousePos(e);
        this.drawSymmetric(this.lastX, this.lastY, pos.x, pos.y);
        this.currentStrokePoints.push({x: pos.x, y: pos.y});
        this.lastX = pos.x;
        this.lastY = pos.y;
        
        // 描画音（簡易的なビープ）
        this.playDrawSound(pos.x, pos.y);
    }
    
    playDrawSound(x, y) {
        // 簡易オシレーター（連続すると重いので間引くなどの処理は省略）
        // 実際の実装ではGainNodeの制御でスムーズにするのが良い
    }
    
    stopDrawing() {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        if (this.currentStrokePoints.length > 1) {
            this.drawingHistory.push({
                points: this.currentStrokePoints,
                color: this.colors[this.currentColorIndex],
                size: this.brushSizes[this.currentSizeIndex],
                symmetryCount: this.symmetryModes[this.currentSymmetryIndex]
            });
        }
        this.currentStrokePoints = [];
    }

    clearCanvas() {
        if (this.isPlaying) return;
        this.drawingHistory = [];
        this.particles = [];
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    redrawHistory() {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawingHistory.forEach(stroke => {
            const symmetryCount = stroke.symmetryCount;
            const angleStep = (2 * Math.PI) / symmetryCount;
            this.ctx.strokeStyle = stroke.color;
            this.ctx.lineWidth = stroke.size;
            this.ctx.shadowBlur = 0; // 静止画では光らせない

            for (let i = 0; i < symmetryCount; i++) {
                const angle = i * angleStep;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                
                const drawPath = (points, isRef) => {
                    this.ctx.beginPath();
                    points.forEach((pt, idx) => {
                        let rx = pt.x - this.centerX;
                        let ry = pt.y - this.centerY;
                        if(isRef) rx = -rx;
                        const finalX = rx * cos - ry * sin + this.centerX;
                        const finalY = rx * sin + ry * cos + this.centerY;
                        if(idx===0) this.ctx.moveTo(finalX, finalY);
                        else this.ctx.lineTo(finalX, finalY);
                    });
                    this.ctx.stroke();
                };
                drawPath(stroke.points, false);
                if (symmetryCount > 2) drawPath(stroke.points, true);
            }
        });
    }

    drawSymmetric(x1, y1, x2, y2) {
        const symmetryCount = this.symmetryModes[this.currentSymmetryIndex];
        const angleStep = (2 * Math.PI) / symmetryCount;
        this.ctx.strokeStyle = this.colors[this.currentColorIndex];
        this.ctx.lineWidth = this.brushSizes[this.currentSizeIndex];
        
        for (let i = 0; i < symmetryCount; i++) {
            const angle = i * angleStep;
            // 座標変換計算（省略せずに実装）
            const cos = Math.cos(angle), sin = Math.sin(angle);
            const rotate = (x, y) => ({
                x: (x - this.centerX) * cos - (y - this.centerY) * sin + this.centerX,
                y: (x - this.centerX) * sin + (y - this.centerY) * cos + this.centerY
            });
            const p1 = rotate(x1, y1);
            const p2 = rotate(x2, y2);
            
            this.ctx.beginPath();
            this.ctx.moveTo(p1.x, p1.y);
            this.ctx.lineTo(p2.x, p2.y);
            this.ctx.stroke();
            
            if (symmetryCount > 2) {
                const refRotate = (x, y) => ({
                    x: (x - this.centerX) * cos + (y - this.centerY) * sin + this.centerX,
                    y: -(x - this.centerX) * sin + (y - this.centerY) * cos + this.centerY
                });
                const rp1 = refRotate(x1, y1);
                const rp2 = refRotate(x2, y2);
                this.ctx.beginPath();
                this.ctx.moveTo(rp1.x, rp1.y);
                this.ctx.lineTo(rp2.x, rp2.y);
                this.ctx.stroke();
            }
        }
    }

    changeColor() {
        this.currentColorIndex = (this.currentColorIndex + 1) % this.colors.length;
        this.updateUI();
    }
    changeSymmetryMode() {
        this.currentSymmetryIndex = (this.currentSymmetryIndex + 1) % this.symmetryModes.length;
        this.updateUI();
    }
    changeBrushSize() {
        this.currentSizeIndex = (this.currentSizeIndex + 1) % this.brushSizes.length;
        this.updateUI();
    }
    updateUI() {
        document.getElementById('currentColor').textContent = this.colorEmojis[this.currentColorIndex];
        document.getElementById('symmetryCount').textContent = this.symmetryModes[this.currentSymmetryIndex];
        document.getElementById('modeBtn').textContent = `対称モード: ${this.symmetryModes[this.currentSymmetryIndex]}方向`;
        document.getElementById('sizeBtn').textContent = `筆のサイズ: ${this.brushSizeNames[this.currentSizeIndex]}`;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new SymmetryGame();
});
