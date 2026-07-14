const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const express = require("express");
const puppeteer = require("puppeteer"); // Import puppeteer to locate the browser executable

// 1. Create a basic web server for Render
const app = express();
const PORT = process.env.PORT || 10000; // Render will provide this port
let lastQr = null;

// 2. Set up the WhatsApp client with required arguments for web servers
const client = new Client({ 
    authStrategy: new LocalAuth(),
    puppeteer: { 
        executablePath: puppeteer.executablePath(), // Automatically finds the correct Chrome path
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    } 
});

const userWallets = {}, deactivatedChats = {}, mutedUsers = {};

function getWallet(id) { 
    if (userWallets[id] === undefined) userWallets[id] = 500; 
    return userWallets[id]; 
}

// 3. Handle the QR code setup
client.on("qr", qr => {
    lastQr = qr; // Saves the QR code string for our web page
    qrcode.generate(qr, { small: true }); // Still prints it to terminal logs
});

client.on("ready", () => {
    console.log("WhatsApp Bot is ready and online!");
    lastQr = null; // Clear QR data once logged in successfully
});

// 4. Create the web page so you can scan the QR code from your browser
app.get("/", (req, res) => {
    if (!lastQr) {
        return res.send('<h3>No QR generated yet or the bot is already logged in!</h3>');
    }
    // Fixed: Corrected the full Google Charts API URL to convert the QR string into an image
    const qrImageUrl = `https://googleapis.com{encodeURIComponent(lastQr)}`;
    res.send(`<h1>Scan this with your WhatsApp (Linked Devices):</h1><br><img src="${qrImageUrl}">`);
});

// Keep the web server listening so Render doesn't shut down
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Web monitoring portal active on port ${PORT}`);
});

// 5. Your Bot's Core Event Listener and Features
client.on("message_create", async msg => {
    // Prevent the bot from triggering its own messages
    if (msg.fromMe) return; 

    const chatInput = msg.body.trim().toLowerCase();
    const replyTarget = msg.from;
    const senderId = msg.author || msg.from; 

    // Handle Muted Users
    if (mutedUsers[senderId]) {
        setTimeout(async () => {
            try {
                const chat = await msg.getChat();
                if (!chat.isGroup || (chat.isGroup && chat.participants.find(p => p.id._serialized === client.info.wid._serialized)?.isAdmin)) {
                    await msg.delete(true);
                }
            } catch (e) {}
        }, 600);
        return;
    }

    // Admin Commands
    if (chatInput === ".deactivate") { deactivatedChats[replyTarget] = true; await client.sendMessage(replyTarget, "🛑 *System Alert:* Deactivated."); return; }
    if (chatInput === ".activate") { delete deactivatedChats[replyTarget]; await client.sendMessage(replyTarget, "🚀 *System Alert:* Activated."); return; }
    
    if (chatInput.startsWith(".money")) {
        const args = msg.body.split(/\s+/);
        const amt = parseInt(args[1]);
        if (!isNaN(amt) && amt > 0) {
            getWallet(senderId);
            userWallets[senderId] += amt;
            await client.sendMessage(replyTarget, `💰 Added $${amt}! Balance: $${userWallets[senderId]}`);
        }
        return;
    }

    if (chatInput.startsWith(".mute")) {
        const m = await msg.getMentions();
        if (m && m.length > 0) {
            const targetId = m[0].id._serialized;
            mutedUsers[targetId] = true;
            await client.sendMessage(replyTarget, `🤫 Muted @${m[0].id.user} permanently.`, { mentions: [targetId] });
        }
        return;
    }

    if (chatInput.startsWith(".unmute")) {
        const m = await msg.getMentions();
        if (m && m.length > 0) {
            const targetId = m[0].id._serialized;
            delete mutedUsers[targetId];
            await client.sendMessage(replyTarget, `🔊 Unmuted @${m[0].id.user}.`, { mentions: [targetId] });
        }
        return;
    }

    // Ignore commands if chat is deactivated
    if (deactivatedChats[replyTarget]) return;

    // Public Chat Menu / Fun Commands
    if (chatInput === "hi" || chatInput === "hello") {
        await client.sendMessage(replyTarget, "Hi there! Type *.menu* to see what I can do.");
    } 
    else if (chatInput === ".menu") {
        await client.sendMessage(replyTarget, "🤖 *Menu* 🤖\n\n🔹 *.ping*\n🔹 *.hello*\n🔹 *.about*\n🔹 *.race*\n🔹 *.pay @user [amt]*");
    } 
    else if (chatInput === ".ping") {
        await msg.reply("pong");
    } 
    else if (chatInput === ".hello") {
        await client.sendMessage(replyTarget, "NUGGET NUGGET NUGGET");
    } 
    else if (chatInput === ".about") {
        await client.sendMessage(replyTarget, "CHICKEN NUGGET");
    } 
    else if (chatInput.startsWith(".pay")) {
        const m = await msg.getMentions();
        const args = msg.body.split(/\s+/);
        const amt = parseInt(args.find(arg => !isNaN(arg) && parseInt(arg) > 0)); 
        
        if (m && m.length > 0 && !isNaN(amt) && getWallet(senderId) >= amt) {
            const tId = m[0].id._serialized;
            if (senderId !== tId) {
                getWallet(tId);
                userWallets[senderId] -= amt;
                userWallets[tId] += amt;
                await client.sendMessage(replyTarget, `💸 Sent $${amt} to @${m[0].id.user}. Balance: $${userWallets[senderId]}`, { mentions: [tId] });
            }
        }
    } 
    else if (chatInput.startsWith(".race")) {
        const currentBalance = getWallet(senderId);
        const args = msg.body.trim().split(/\s+/);
        
        if (args.length < 3) {
            await client.sendMessage(replyTarget, `🏇 *Race Arena*\nWallet: $${currentBalance}\nType: \`.race [horse 1-3] [bet]\``);
            return;
        }
        
        const horse = parseInt(args[1]);
        const bet = parseInt(args[2]);
        
        if (!isNaN(horse) && horse >= 1 && horse <= 3 && !isNaN(bet) && bet > 0 && bet <= currentBalance) {
            userWallets[senderId] -= bet;
            await client.sendMessage(replyTarget, `🏁 Race started! $${bet} placed on Horse ${horse}.`);
            
            let h1 = 0, h2 = 0, h3 = 0, trackMessage = null;
            
            for (let s = 0; s < 5; s++) {
                h1 += Math.floor(Math.random() * 3) + 1;
                h2 += Math.floor(Math.random() * 3) + 1;
                h3 += Math.floor(Math.random() * 3) + 1;
                
                const p1 = Math.min(h1, 10), p2 = Math.min(h2, 10), p3 = Math.min(h3, 10);
                const frame = `🏇 *LIVE RACE TRACK* 🏇\n\n1️⃣ |${"-".repeat(p1)}🐎${"-".repeat(10-p1)}|🏁\n2️⃣ |${"-".repeat(p2)}🐎${"-".repeat(10-p2)}|🏁\n3️⃣ |${"-".repeat(p3)}🐎${"-".repeat(10-p3)}|🏁`;
                
                try {
                    if (s === 0) trackMessage = await client.sendMessage(replyTarget, frame);
                    else await trackMessage.edit(frame);
                } catch (editError) {}
                await new Promise(r => setTimeout(r, 2000)); 
            }
            
            // Fair Winner Selection Logic
            const max = Math.max(h1, h2, h3);
            const winners = [];
            if (h1 === max) winners.push(1);
            if (h2 === max) winners.push(2);
            if (h3 === max) winners.push(3);
            
            const win = winners[Math.floor(Math.random() * winners.length)]; 
            
            let res = `🏆 *Race Over!* 🏆\n🥇 1st Place: Horse ${win}\n`;
            if (horse === win) {
                userWallets[senderId] += bet * 2;
                res += `🎉 Won $${bet * 2}!`;
            } else {
                res += `💔 Lost $${bet}.`;
            }
            res += `\nWallet: $${userWallets[senderId]}`;
            await client.sendMessage(replyTarget, res);
        } else {
            await client.sendMessage(replyTarget, `❌ Invalid bet or horse selection! Check your wallet: $${currentBalance}`);
        }
    }
});

client.initialize();
