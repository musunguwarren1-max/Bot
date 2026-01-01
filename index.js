const http = require('http');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeInMemoryStore
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");

// --- 1. KOYEB CLOUD KEEP-ALIVE SERVER ---
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('Velocity OS: Cloud Engine Running 24/7');
    res.end();
}).listen(process.env.PORT || 8080);

async function startVelocityBot() {
   const { state, saveCreds } = await useMultiFileAuthState("velocity_session");

    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // --- 2. PAIRING CODE LOGIC ---
    if (!sock.authState.creds.registered) {
        // Updated with your specific number
        const myNumber = "254705127804";

        setTimeout(async () => {
            let code = await sock.requestPairingCode(myNumber);
            console.log("\n========================================");
            console.log("🔗 YOUR WHATSAPP PAIRING CODE IS:", code);
            console.log("========================================\n");
        }, 3000);
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = (new Boom(lastDisconnect?.error)?.output.statusCode) !== DisconnectReason.loggedOut;
            if (shouldReconnect) startVelocityBot();
        } else if (connection === "open") {
            console.log("✅ VELOCITY OS IS ONLINE & SYNCED TO THE CLOUD");
        }
    });

    // --- 3. ALL COMMANDS (ADMIN + SYSTEM + FUN) ---
    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const from = msg.key.remoteJid;
        const pushName = msg.pushName || "User";
        const isGroup = from.endsWith('@g.us');
        const type = Object.keys(msg.message)[0];
        
        const body = (type === 'conversation') ? msg.message.conversation : 
                     (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : 
                     (type === 'imageMessage') ? msg.message.imageMessage.caption : '';

        const command = body.toLowerCase().trim().split(/ +/)[0];

        // FEATURE: AUTO BLUE TICK
        await sock.readMessages([msg.key]);

        switch (command) {
            case "!menu":
                const menu = `🚀 *VELOCITY OS COMMAND CENTER*\n\n` +
                             `*User:* ${pushName}\n\n` +
                             `🛡️ *ADMIN:* !kick, !promote, !demote\n` +
                             `⚙️ *SYSTEM:* !status, !owner, !ping\n` +
                             `🎭 *FUN:* !react, !poll, !location\n\n` +
                             `_Hosting: Koyeb Cloud 24/7_`;
                await sock.sendMessage(from, { text: menu });
                break;

            case "!status":
                await sock.sendMessage(from, { text: "✅ *System Status: OPTIMAL*\n⚡ Response: <1s\n🛰️ Server: Frankfurt, DE" });
                break;

            case "!owner":
                await sock.sendMessage(from, { text: "👤 *Developer:* Musungu Warren\n🇰🇪 *Location:* Eldoret, Kenya\n🛠️ *Status:* Active" });
                break;

            case "!ping":
                await sock.sendMessage(from, { text: "🏓 *Pong!* Velocity OS is responsive." });
                break;

            case "!react":
                await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } });
                break;

            case "!poll":
                await sock.sendMessage(from, {
                    poll: {
                        name: "Velocity OS: Next Update Priority?",
                        values: ["AI Integration", "Security Patch", "Media Downloader"],
                        selectableCount: 1
                    }
                });
                break;

            case "!location":
                await sock.sendMessage(from, { location: { degreesLatitude: 0.5143, degreesLongitude: 35.2698 } });
                break;

            // GROUP ADMIN COMMANDS
            case "!kick":
                if (isGroup) {
                    const targetK = msg.message.extendedTextMessage?.contextInfo?.mentionedJid[0];
                    if (targetK) {
                        await sock.groupParticipantsUpdate(from, [targetK], "remove");
                        await sock.sendMessage(from, { text: "🚫 User removed." });
                    }
                }
                break;

            case "!promote":
                if (isGroup) {
                    const targetP = msg.message.extendedTextMessage?.contextInfo?.mentionedJid[0];
                    if (targetP) {
                        await sock.groupParticipantsUpdate(from, [targetP], "promote");
                        await sock.sendMessage(from, { text: "✅ User promoted to Admin." });
                    }
                }
                break;

            case "!demote":
                if (isGroup) {
                    const targetD = msg.message.extendedTextMessage?.contextInfo?.mentionedJid[0];
                    if (targetD) {
                        await sock.groupParticipantsUpdate(from, [targetD], "demote");
                        await sock.sendMessage(from, { text: "📉 User demoted." });
                    }
                }
                break;
        }
    });
}

startVelocityBot();
