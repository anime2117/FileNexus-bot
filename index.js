const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const admin = require('firebase-admin');
const crypto = require('crypto'); 
const app = express();

// ১. ফায়ারবেস সেটআপ
const serviceAccount = {
  "type": "service_account",
  "project_id": "apki-d2597",
  "private_key_id": "b1667ca1b05c308efefe305f3db94c55124e3c35",
  "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@apki-d2597.iam.gserviceaccount.com",
  "client_id": "117088486174654038483",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40apki-d2597.iam.gserviceaccount.com..."
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://apki-d2597-default-rtdb.firebaseio.com/" 
});

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

// ⚠️ এখানে আপনার নিজের টেলিগ্রাম অ্যাকাউন্ট আইডি বসান (যেমন: 12345678)
// এই আইডি ছাড়া অন্য কেউ ফরোয়ার্ড বা ফাইল পাঠালে বট রিসিভ করবে না।
const ADMIN_ID = 8273597769; 

const bot = new TelegramBot(TOKEN, { polling: true });

// বটের মূল লজিক
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // ব্যবহারকারী যদি কোনো ফাইল (ডকুমেন্ট, ফটো বা ভিডিও) পাঠায়
    if (msg.document || msg.photo || msg.video) {
        
        // 🔒 চেক করা হচ্ছে যে ফাইলটি আপনি (অ্যাডমিন) পাঠিয়েছেন কিনা
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
