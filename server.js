const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mc = require('minecraft-protocol');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Bot ve Yönetim Değişkenleri
let activeBots = []; // Çalışan bot objelerini tutar
let isRunning = false;

// Varsayılan Ayarlar
let botConfig = {
    host: 'oyun.sunucuadresi.com',
    port: 25565,
    version: '1.20.6',
    botCount: 3,
    namePrefix: 'Bot_',
    antiAfkDelay: 15
};

app.use(express.static('public'));

// Web Paneli Arayüzü (HTML / CSS / JS)
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Çoklu Minecraft Bot Paneli</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f8fafc; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media (max-width: 768px) { .container { grid-template-columns: 1fr; } }
        .card { background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; }
        h2 { margin-bottom: 15px; color: #38bdf8; font-size: 1.2rem; }
        .form-group { margin-bottom: 12px; }
        label { display: block; margin-bottom: 5px; font-size: 0.85rem; color: #94a3b8; }
        input { width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #334155; background: #0f172a; color: #fff; font-size: 0.9rem; }
        .btn-group { display: flex; gap: 10px; margin-top: 15px; }
        button { flex: 1; padding: 12px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; }
        .btn-start { background: #22c55e; color: #fff; }
        .btn-start:hover { background: #16a34a; }
        .btn-stop { background: #ef4444; color: #fff; }
        .btn-stop:hover { background: #dc2626; }
        #terminal { background: #020617; border: 1px solid #1e293b; height: 350px; border-radius: 6px; padding: 10px; overflow-y: auto; font-family: monospace; font-size: 0.85rem; color: #4ade80; }
        .chat-input-group { display: flex; gap: 10px; margin-top: 10px; }
        .chat-input-group input { flex: 1; }
        .chat-input-group button { flex: 0 0 100px; background: #0284c7; color: #fff; }
        .status-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; margin-bottom: 10px; }
        .status-online { background: #166534; color: #4ade80; }
        .status-offline { background: #991b1b; color: #fca5a5; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <h2>Bot Havuzu Ayarları</h2>
            <div id="statusBadge" class="status-badge status-offline">TÜM BOTLAR KAPALI</div>
            
            <div class="form-group">
                <label>Sunucu IP (Host)</label>
                <input type="text" id="host" value="${botConfig.host}">
            </div>
            <div class="form-group">
                <label>Port</label>
                <input type="number" id="port" value="${botConfig.port}">
            </div>
            <div class="form-group">
                <label>Sürüm (Örn: 1.20.6)</label>
                <input type="text" id="version" value="${botConfig.version}">
            </div>
            <div class="form-group">
                <label>Bot Sayısı</label>
                <input type="number" id="botCount" value="${botConfig.botCount}">
            </div>
            <div class="form-group">
                <label>İsim Ön Eki</label>
                <input type="text" id="namePrefix" value="${botConfig.namePrefix}">
            </div>
            <div class="form-group">
                <label>Anti-AFK Süresi (Saniye)</label>
                <input type="number" id="antiAfkDelay" value="${botConfig.antiAfkDelay}">
            </div>

            <div class="btn-group">
                <button class="btn-start" onclick="startBots()">Tüm Botları Başlat</button>
                <button class="btn-stop" onclick="stopBots()">Tümünü Durdur</button>
            </div>
        </div>

        <div class="card">
            <h2>Canlı Terminal & Toplu Komut</h2>
            <div id="terminal"></div>
            <div class="chat-input-group">
                <input type="text" id="globalCommand" placeholder="Bütün botlara komut gönder (örn: /home)..." onkeydown="if(event.key==='Enter') sendGlobalCommand()">
                <button onclick="sendGlobalCommand()">Tümüne Gönder</button>
            </div>
        </div>
    </div>

    <script>
        const socket = io();
        const terminal = document.getElementById('terminal');
        const statusBadge = document.getElementById('statusBadge');

        socket.on('log', (msg) => {
            const div = document.createElement('div');
            div.textContent = \`[\${new Date().toLocaleTimeString()}] \${msg}\`;
            terminal.appendChild(div);
            terminal.scrollTop = terminal.scrollHeight;
        });

        socket.on('status', (data) => {
            if(data.running) {
                statusBadge.textContent = \`AKTİF (Çalışan Bot: \${data.count})\`;
                statusBadge.className = "status-badge status-online";
            } else {
                statusBadge.textContent = "TÜM BOTLAR KAPALI";
                statusBadge.className = "status-badge status-offline";
            }
        });

        function startBots() {
            const config = {
                host: document.getElementById('host').value,
                port: parseInt(document.getElementById('port').value),
                version: document.getElementById('version').value,
                botCount: parseInt(document.getElementById('botCount').value),
                namePrefix: document.getElementById('namePrefix').value,
                antiAfkDelay: parseInt(document.getElementById('antiAfkDelay').value)
            };
            socket.emit('start_bots', config);
        }

        function stopBots() {
            socket.emit('stop_bots');
        }

        function sendGlobalCommand() {
            const input = document.getElementById('globalCommand');
            if(input.value.trim() !== '') {
                socket.emit('global_command', input.value);
                input.value = '';
            }
        }
    </script>
</body>
</html>
    `);
});

// Terminal Log Fonksiyonu
function logToConsole(message) {
    console.log(message);
    io.emit('log', message);
}

// Rastgele İsim Üretici
function generateRandomName(prefix) {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${randomNum}`;
}

// Tekil Bot Oluşturma ve Yönetme
function createSingleBot(index, config) {
    if (!isRunning) return;

    const username = generateRandomName(config.namePrefix);
    logToConsole(`[Bot #${index + 1}] "${username}" ismiyle bağlanılıyor...`);

    const client = mc.createClient({
        host: config.host,
        port: config.port,
        username: username,
        version: config.version,
        auth: 'offline'
    });

    const botObj = {
        client: client,
        username: username,
        index: index,
        antiAfkInterval: null,
        reconnectTimeout: null
    };

    client.on('login', () => {
        logToConsole(`[BAŞARILI] "${username}" oyuna giriş yaptı.`);
    });

    // Anti-AFK Döngüsü
    const intervalMs = (config.antiAfkDelay || 15) * 1000;
    botObj.antiAfkInterval = setInterval(() => {
        try {
            client.write('position', {
                x: 0,
                y: 64,
                z: 0,
                onGround: true
            });
        } catch (e) {}
    }, intervalMs);

    client.on('end', (reason) => {
        logToConsole(`[KOPMA] "${username}" düştü. Sebep: ${reason}`);
        clearInterval(botObj.antiAfkInterval);

        // Auto-Reconnect
        if (isRunning) {
            logToConsole(`[YENİDEN BAĞLANMA] "${username}" 10 saniye sonra tekrar bağlanacak...`);
            botObj.reconnectTimeout = setTimeout(() => {
                createSingleBot(index, config);
            }, 10000);
        }
    });

    client.on('error', (err) => {
        logToConsole(`[HATA - ${username}]: ${err.message || err}`);
    });

    activeBots.push(botObj);
}

// Tüm Botları Başlatma
function startAllBots(config) {
    stopAllBots(); // Önce varsa eski botları temizle
    isRunning = true;
    botConfig = config;

    logToConsole(`Toplam ${config.botCount} adet bot sırayla başlatılıyor...`);
    io.emit('status', { running: true, count: config.botCount });

    for (let i = 0; i < config.botCount; i++) {
        // Sunucu Flood / Çakışma atmasın diye botlar arasına 2.5 saniye gecikme koyuyoruz
        setTimeout(() => {
            if (isRunning) {
                createSingleBot(i, config);
            }
        }, i * 2500);
    }
}

// Tüm Botları Durdurma
function stopAllBots() {
    isRunning = false;
    logToConsole('Tüm botlar durduruluyor...');

    activeBots.forEach(bot => {
        if (bot.antiAfkInterval) clearInterval(bot.antiAfkInterval);
        if (bot.reconnectTimeout) clearTimeout(bot.reconnectTimeout);
        try {
            bot.client.end('Panel üzerinden kapatıldı.');
        } catch (e) {}
    });

    activeBots = [];
    io.emit('status', { running: false, count: 0 });
    logToConsole('Tüm bot bağlantıları sonlandırıldı.');
}

// Socket.io Bağlantı Yönetimi
io.on('connection', (socket) => {
    socket.emit('status', { running: isRunning, count: activeBots.length });
    socket.emit('log', 'Web Paneline başarıyla bağlandınız.');

    socket.on('start_bots', (config) => {
        startAllBots(config);
    });

    socket.on('stop_bots', () => {
        stopAllBots();
    });

    // Bütün botlara aynı anda komut/mesaj gönderme
    socket.on('global_command', (cmd) => {
        if (!isRunning || activeBots.length === 0) {
            logToConsole('[UYARI] Aktif çalışan bot bulunamadığı için komut gönderilemedi.');
            return;
        }

        logToConsole(`[TOPLU KOMUT -> TÜM BOTLAR]: ${cmd}`);
        activeBots.forEach(bot => {
            try {
                bot.client.write('chat', { message: cmd });
            } catch (e) {}
        });
    });
});

server.listen(PORT, () => {
    console.log(`Çoklu Bot Web Paneli http://localhost:${PORT} adresinde çalışıyor.`);
});
