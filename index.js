const TelegramBot = require('node-telegram-bot-api'); // বড় হাতের Const ছোট হাতের const করা হলো
const express = require('express');
const admin = require('firebase-admin');
const crypto = require('crypto'); 
const app = express();
const fs = require('fs'); // ফাইল চেক করার জন্য যুক্ত করা হলো

// ১. ফায়ারবেস সেটআপ 
// Render-এ Secret File-এর নাম যদি 'firebase-key.json' হয়ে থাকে, তবে নিচের পাথটি একদম সঠিক।
const serviceAccountPath = '/opt/render/project/src/firebase-key.json'; 

try {
  if (fs.existsSync(serviceAccountPath)) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountPath),
      databaseURL: "https://apki-d2597-default-rtdb.firebaseio.com/" 
    });
    console.log("🎉 Firebase সফলভাবে কানেক্ট হয়েছে!");
  } else {
    // যদি ওই পাথে না পায়, তবে কারেন্ট ডিরেক্টরি ট্রাই করবে ক্র্যাশ না করে
    console.log("⚠️ /opt/render পাথে ফাইল পাওয়া যায়নি, কারেন্ট ডিরেক্টরি চেক করা হচ্ছে...");
    admin.initializeApp({
      credential: admin.credential.cert('./firebase-key.json'),
      databaseURL: "https://apki-d2597-default-rtdb.firebaseio.com/" 
    });
  }
} catch (error) {
  console.error("❌ Firebase ইনিশিয়ালাইজ করতে সমস্যা হয়েছে:", error.message);
}

const db = admin.database();

// এক্সপ্রেস সার্ভার (Render-এর জন্য)
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => {
    res.send('বটটি সফলভাবে ২৪ ঘণ্টা লাইভ আছে!');
});
app.listen(PORT, () => {
    console.log(`সার্ভার পোর্ট ${PORT}-এ চলছে...`);
});

// বটের টোকেন এবং ইনফরমেশন
const TOKEN = '8795629325:AAGEMGKSsglmHcUKjEzyty7N72n9MUeKoWk'; 
const BOT_USERNAME = 'filenexus_bot'; 

// অ্যাডমিন আইডি
const ADMIN_ID = 8273597769; 

const bot = new TelegramBot(TOKEN, { polling: true });

// বটের মূল লজিক
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // ব্যবহারকারী যদি কোনো ফাইল (ডকুমেন্ট, ফটো বা ভিডিও) পাঠায়
    if (msg.document || msg.photo || msg.video) {
        
        // চেক করা হচ্ছে যে ফাইলটি আপনি (অ্যাডমিন) পাঠিয়েছেন কিনা
        if (userId !== ADMIN_ID) {
            return bot.sendMessage(chatId, "❌ দুঃখিত! আপনি এই বটের অ্যাডমিন নন। আপনি কোনো ফাইল আপলোড করতে পারবেন না।");
        }

        let fileId;
        let fileType;

        if (msg.document) {
            fileId = msg.document.file_id;
            fileType = 'document';
        } else if (msg.video) {
            fileId = msg.video.file_id;
            fileType = 'video';
        } else {
            fileId = msg.photo[msg.photo.length - 1].file_id;
            fileType = 'photo';
        }

        const shortId = crypto.randomBytes(3).toString('hex'); 

        try {
            await db.ref('files/' + shortId).set({
                fileId: fileId,
                fileType: fileType,
                userId: userId,
                createdAt: admin.database.ServerValue.TIMESTAMP
            });

            const shareLink = `https://t.me/${BOT_USERNAME}?start=${shortId}`;
            bot.sendMessage(chatId, `🎉 **ফাইলটি সফলভাবে ডাটাবেজে সংরক্ষিত হয়েছে!**\n\n🔗 **শেয়ারিং লিংক:**\n\`${shareLink}\``, { parse_mode: 'Markdown' });

        } catch (error) {
            console.error(error);
            bot.sendMessage(chatId, "দুঃখিত, ডাটাবেজে ফাইল সেভ করার সময় একটি সমস্যা হয়েছে।");
        }
    } 
    // ব্যবহারকারী যদি /start কমান্ড দেয়
    else if (msg.text && msg.text.startsWith('/start')) {
        const payload = msg.text.split(' ')[1];

        if (payload) {
            try {
                const snapshot = await db.ref('files/' + payload).once('value');
                const fileData = snapshot.val();

                if (fileData) {
                    if (fileData.fileType === 'document') {
                        await bot.sendDocument(chatId, fileData.fileId);
                    } else if (fileData.fileType === 'video') {
                        await bot.sendVideo(chatId, fileData.fileId);
                    } else if (fileData.fileType === 'photo') {
                        await bot.sendPhoto(chatId, fileData.fileId);
                    }
                } else {
                    bot.sendMessage(chatId, "❌ দুঃখিত, এই লিংকটি অবৈধ অথবা ফাইলটি ডাটাবেজ থেকে মুছে ফেলা হয়েছে।");
                }
            } catch (error) {
                console.error(error);
                bot.sendMessage(chatId, "ফাইলটি লোড করার সময় একটি ত্রুটি ঘটেছে।");
            }
        } else {
            bot.sendMessage(chatId, "👋 স্বাগতম! এই বটটির মাধ্যমে আপনি নির্দিষ্ট ফাইল ডাউনলোড করতে পারবেন।");
        }
    }
});
