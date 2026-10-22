const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mc = require('minecraft-protocol');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Bot Durum Değişkenleri
let bot = null;
let isBotActive = false;
let antiAfkInterval = null;
let reconnectTimeout = null;
let subServerInterval = null;

let isSpawned = false; 
let subServerJoined = false; 

let botConfig = {
    host: 'oyun.sunucuadresi.com',
    port: 25565,
    username: 'AFK_Bot',
    password: 'sifreniz123',
    version: '1.20.6',
    subServerCommand: '/gir asmp',
    homeCommand: '/ev ev',
    antiAfkDelay: 15
};

app.use(express.static('public'));

// Dahili HTML Web Paneli
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Minecraft AFK Bot Panel</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f8fafc; padding: 20px; }
        .container { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
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
        #terminal { background: #020617; border: 1px solid #1e293b; height: 320px; border-radius: 6px; padding: 10px; overflow-y: auto; font-family: monospace; font-size: 0.85rem; color: #4ade80; }
        .chat-input-group { display: flex; gap: 10px; margin-top: 10px; }
        .chat-input-group input { flex: 1; }
        .chat-input-group button { flex: 0 0 80px; background: #0284c7; color: #fff; }
        .status-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; margin-bottom: 10px; }
        .status-online { background: #166534; color: #4ade80; }
        .status-offline { background: #991b1b; color: #fca5a5; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <h2>Bot Ayarları</h2>
            <div id="statusBadge" class="status-badge status-offline">DURDURULDU</div>
            
            <div class="form-group">
                <label>Sunucu IP (Host)</label>
                <input type="text" id="host" value="${botConfig.host}">
            </div>
            <div class="form-group">
                <label>Port</label>
                <input type="number" id="port" value="${botConfig.port}">
            </div>
            <div class="form-group">
                <label>Kullanıcı Adı (Bot İsim)</label>
                <input type="text" id="username" value="${botConfig.username}">
            </div>
            <div class="form-group">
                <label>Oyun İçi Şifre (/login Sadece)</label>
                <input type="password" id="password" value="${botConfig.password}" placeholder="Şifreniz yoksa boş bırakın">
            </div>
            <div class="form-group">
                <label>Sürüm (Örn: 1.20.6)</label>
                <input type="text" id="version" value="${botConfig.version}">
            </div>
            <div class="form-group">
                <label>Alt Sunucu Komutu</label>
                <input type="text" id="subServerCommand" value="${botConfig.subServerCommand}" placeholder="/gir asmp">
            </div>
            <div class="form-group">
                <label>Ev Komutu (Girişte / Ölümde)</label>
                <input type="text" id="homeCommand" value="${botConfig.homeCommand}" placeholder="/ev ev">
            </div>
            <div class="form-group">
                <label>Anti-AFK Süresi (Saniye)</label>
                <input type="number" id="antiAfkDelay" value="${botConfig.antiAfkDelay}">
            </div>

            <div class="btn-group">
                <button class="btn-start" onclick="startBot()">Başlat</button>
                <button class="btn-stop" onclick="stopBot()">Durdur</button>
            </div>
        </div>

        <div class="card">
            <h2>Canlı Terminal</h2>
            <div id="terminal"></div>
            <div class="chat-input-group">
                <input type="text" id="chatMessage" placeholder="Komut veya mesaj yazın..." onkeydown="if(event.key==='Enter') sendChat()">
                <button onclick="sendChat()">Gönder</button>
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

        socket.on('status', (active) => {
            if(active) {
                statusBadge.textContent = "BAĞLANDI / AKTİF";
                statusBadge.className = "status-badge status-online";
            } else {
                statusBadge.textContent = "DURDURULDU";
                statusBadge.className = "status-badge status-offline";
            }
        });

        function startBot() {
            const config = {
                host: document.getElementById('host').value,
                port: parseInt(document.getElementById('port').value),
                username: document.getElementById('username').value,
                password: document.getElementById('password').value,
                version: document.getElementById('version').value,
                subServerCommand: document.getElementById('subServerCommand').value,
                homeCommand: document.getElementById('homeCommand').value,
                antiAfkDelay: parseInt(document.getElementById('antiAfkDelay').value)
            };
            socket.emit('start_bot', config);
        }

        function stopBot() {
            socket.emit('stop_bot');
        }

        function sendChat() {
            const input = document.getElementById('chatMessage');
            if(input.value.trim() !== '') {
                socket.emit('send_chat', input.value);
                input.value = '';
            }
        }
    </script>
</body>
</html>
    `);
});

// Terminal Log Mekanizması
function logToConsole(message) {
    console.log(message);
    io.emit('log', message);
}

// Bot Başlatma Mantığı
function startBotProcess(config) {
    if (bot) {
        stopBotProcess();
    }

    isBotActive = true;
    isSpawned = false;
    subServerJoined = false;
    botConfig = config;
    io.emit('status', true);

    logToConsole(`Sunucuya bağlanılıyor: ${config.host}:${config.port} (${config.username})`);

    try {
        bot = mc.createClient({
            host: config.host,
            port: config.port,
            username: config.username,
            version: config.version || false,
            auth: 'offline'
        });

        bot.on('connect', () => {
            logToConsole('TCP Bağlantısı sağlandı.');
        });

        bot.on('login', () => {
            logToConsole(`[BAŞARILI] Bot protokol seviyesinde bağlandı: ${bot.username}`);
        });

        // DOĞMA (SPAWN) KONTROLÜ
        bot.on('spawn', () => {
            if (!isSpawned) {
                isSpawned = true;
                logToConsole('[KONTROL] Bot ana sunucuya doğdu.');

                // 1. /login Komutu Gönderimi
                if (config.password && config.password.trim() !== '') {
                    setTimeout(() => {
                        logToConsole('Oyun içi giriş yapılıyor (/login)...');
                        sendChatMessage(`/login ${config.password}`);
                    }, 1500);
                }

                // 2. Alt Sunucu Komut Döngüsü
                if (config.subServerCommand && config.subServerCommand.trim() !== '') {
                    clearSubServerLoop();
                    
                    setTimeout(() => {
                        if (isBotActive && !subServerJoined) {
                            logToConsole(`Alt sunucu komutu gönderiliyor: ${config.subServerCommand}`);
                            sendChatMessage(config.subServerCommand);
                        }
                    }, 3000);

                    subServerInterval = setInterval(() => {
                        if (isBotActive && !subServerJoined) {
                            logToConsole(`[OTO TEKRAR] Alt sunucuya geçiş deneniyor: ${config.subServerCommand}`);
                            sendChatMessage(config.subServerCommand);
                        }
                    }, 5000);
                } else {
                    if (config.homeCommand && config.homeCommand.trim() !== '') {
                        setTimeout(() => {
                            logToConsole(`Ev komutu gönderiliyor: ${config.homeCommand}`);
                            sendChatMessage(config.homeCommand);
                        }, 3500);
                    }
                }

                // 3. Anti-AFK Başlat
                startAntiAfk(config.antiAfkDelay);
            } else {
                if (!subServerJoined && config.subServerCommand) {
                    logToConsole('[BİLGİ] Alt sunucuya başarıyla geçildi.');
                    subServerJoined = true;
                    clearSubServerLoop(); 

                    if (config.homeCommand && config.homeCommand.trim() !== '') {
                        setTimeout(() => {
                            logToConsole(`Ev komutu gönderiliyor: ${config.homeCommand}`);
                            sendChatMessage(config.homeCommand);
                        }, 2500);
                    }
                }
            }
        });

        // 4. OTOMATİK YENİDEN DOĞMA VE EV MEKANİZMASI
        bot.on('health', (packet) => {
            if (packet.health <= 0) {
                logToConsole('[ÖLÜM] Bot öldü! Yeniden doğuluyor (Respawn)...');
                setTimeout(() => {
                    try {
                        bot.write('client_status', { action: 0 });

                        if (botConfig.homeCommand && botConfig.homeCommand.trim() !== '') {
                            setTimeout(() => {
                                logToConsole(`Yeniden doğma sonrası ev komutu gönderiliyor: ${botConfig.homeCommand}`);
                                sendChatMessage(botConfig.homeCommand);
                            }, 2500);
                        }
                    } catch (e) {
                        logToConsole(`[RESPAWN HATA]: ${e.message}`);
                    }
                }, 1000);
            }
        });

        // 5. ENVANTER GÜVENLİĞİ
        bot.on('window_items', (packet) => {});
        bot.on('set_slot', (packet) => {});

        bot.on('chat', (packet) => {
            try {
                const jsonMsg = JSON.parse(packet.message);
                const text = jsonMsg.text || (jsonMsg.extra ? jsonMsg.extra.map(e => e.text).join('') : '');
                if (text.trim()) {
                    logToConsole(`[CHAT]: ${text}`);
                }
            } catch (e) {}
        });

        bot.on('end', (reason) => {
            logToConsole(`[KOPMA] Bağlantı kesildi. Sebep: ${reason}`);
            resetStates();

            if (isBotActive) {
                logToConsole('Auto-Reconnect: 8 saniye sonra otomatik tekrar bağlanılıyor...');
                reconnectTimeout = setTimeout(() => {
                    startBotProcess(botConfig);
                }, 8000);
            }
        });

        bot.on('error', (err) => {
            logToConsole(`[HATA]: ${err.message || err}`);
        });

    } catch (err) {
        logToConsole(`[BAĞLANTI HATASI]: ${err.message}`);
    }
}

function sendChatMessage(message) {
    if (bot && isBotActive) {
        try {
            bot.write('chat', { message: message });
        } catch (e) {
            logToConsole(`[MESAJ HATASI]: ${e.message}`);
        }
    }
}

function stopBotProcess() {
    isBotActive = false;
    resetStates();
    if (reconnectTimeout) clearTimeout(reconnectTimeout);

    if (bot) {
        bot.end('Panel üzerinden durduruldu.');
        bot = null;
    }
    logToConsole('Bot tamamen durduruldu.');
    io.emit('status', false);
}

function resetStates() {
    isSpawned = false;
    subServerJoined = false;
    clearAntiAfk();
    clearSubServerLoop();
}

function clearSubServerLoop() {
    if (subServerInterval) clearInterval(subServerInterval);
}

function startAntiAfk(delaySeconds) {
    clearAntiAfk();
    const intervalMs = (delaySeconds || 15) * 1000;

    antiAfkInterval = setInterval(() => {
        if (bot && isBotActive && isSpawned) {
            try {
                const randomYaw = Math.floor(Math.random() * 360) - 180;
                const randomPitch = Math.floor(Math.random() * 40) - 20;

                bot.write('look', {
                    yaw: randomYaw,
                    pitch: randomPitch,
                    onGround: true
                });

                bot.write('position', {
                    x: 0,
                    y: 64,
                    z: 0,
                    onGround: true
                });
            } catch (e) {}
        }
    }, intervalMs);
}

function clearAntiAfk() {
    if (antiAfkInterval) clearInterval(antiAfkInterval);
}

io.on('connection', (socket) => {
    socket.emit('status', isBotActive);
    socket.emit('log', 'Web Paneline Bağlanıldı.');

    socket.on('start_bot', (config) => {
        logToConsole('Panel üzerinden başlatma isteği alındı.');
        startBotProcess(config);
    });

    socket.on('stop_bot', () => {
        logToConsole('Panel üzerinden durdurma isteği alındı.');
        stopBotProcess();
    });

    socket.on('send_chat', (msg) => {
        logToConsole(`[SEN -> SUNUCU]: ${msg}`);
        sendChatMessage(msg);
    });
});

server.listen(PORT, () => {
    console.log(`Web Kontrol Paneli ${PORT} portunda aktif.`);
});
