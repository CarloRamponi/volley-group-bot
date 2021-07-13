import { default as path } from "path";
import { default as TelegramBot } from "node-telegram-bot-api";
import { connect } from "./db/database";
import GroupModel from "./db/models/group.model";
import UserModel, { User } from "./db/models/user.model";

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const KICK_TIME = 5*60*1000; //5 minuti
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if(!TOKEN) {
    throw new Error("Unable to read TELEGRAM_BOT_TOKEN environment variable");
} else {

    const bot = new TelegramBot(TOKEN, {polling: true});

    connect().then(_ => {

        bot.on('message', async (msg) => {
            const chatId = msg.chat.id;

            if(chatId > 0) {
                await bot.sendMessage(chatId, 'Aggiungimi ad un gruppo per mettermi in funzione!');
            } else {

                if(msg.text) {
                    console.log(`[${msg.chat.title}] @${msg.from?.username} -> ${msg.text}`);
                }

                const group = await GroupModel.findOne({chatId: chatId}).exec();
                
                if(!group) {
                    await GroupModel.create({
                        chatId: chatId,
                        title: msg.chat.title
                    });
                    console.log(`Group document created (${chatId})`);
                }

                if(msg.from) {
                    await addNewMember(chatId, msg.from);
                }

                if(msg.new_chat_members) {
                    for(let member of msg.new_chat_members) {
                        await addNewMember(chatId, member);
                    }
                }
            }

        });

        bot.onText(/\/partita (.+)/, async (msg, match) => {

            const chatId = msg.chat.id;
            if(chatId < 0) {
                if(match) {
                    const descrizione = match[1];

                    await bot.deleteMessage(chatId, msg.message_id.toString());
                    const poll = await bot.sendPoll(chatId, descrizione, ["Si", "No"], {
                        is_anonymous: false
                    });
                    await bot.pinChatMessage(chatId, poll.message_id.toString());
                    await GroupModel.updateOne({chatId: chatId}, {$push: {activePolls: poll.poll?.id}});
                    await UserModel.updateMany({group_id: chatId}, {$inc: {strikes: 1}});
            
                }
            }
        });

        bot.onText(/\/ammonizioni/, async (msg) => {

            const chatId = msg.chat.id;
            if(chatId < 0) {
                await computeStrikes(bot, chatId);
            }
        });

        bot.on("poll_answer", async answer => {
            const group = await GroupModel.findOne({activePolls: answer.poll_id}).exec();
            await addNewMember(group.chatId, answer.user);
            if(group) {
                await UserModel.updateOne({tg_id: answer.user.id, group_id: group.chatId}, {$set: {strikes: 0}});
            }
        });

        bot.onText(/\/stop/, async (msg) => {

            const chatId = msg.chat.id;

            if(chatId < 0) {

                if(msg.reply_to_message && msg.reply_to_message.poll && msg.from) {

                    const user = await bot.getChatMember(chatId, msg.from?.id.toString());
                    if(user.status == "creator" || user.status == "administrator") {
                        await bot.deleteMessage(chatId, msg.message_id.toString());
                        await bot.stopPoll(chatId, msg.reply_to_message.message_id);
                        
                        //@ts-ignore
                        await bot.unpinChatMessage(chatId, {
                            message_id: msg.reply_to_message.message_id
                        });
    
                        await GroupModel.updateOne({chatId: chatId}, {$pull: {activePolls: msg.reply_to_message.message_id}});
    
                        computeStrikes(bot, chatId, true);
                    } else {
                        await bot.sendMessage(chatId, "Comando riservato agli admin", {
                            reply_to_message_id: msg.message_id
                        });
                    }

                } else {
                    await bot.sendMessage(chatId, "Per fermare un sondaggio manda questo comando in risposta al messaggio contenente il sondaggio", {
                        reply_to_message_id: msg.message_id
                    });
                }
            }

        });

        bot.on("callback_query", async query => {
            if(query.message) {
                await addNewMember(query.message.chat.id, query.from);
                await UserModel.updateOne({tg_id: query.from.id, group_id: query.message.chat.id}, {$set: {strikes: 0}});
                computeStrikes(bot, query.message.chat.id.toString(), false, query.message.message_id);
            }
        });
        
    });

}

async function kickUsers(bot: TelegramBot, chatId: string|number) {
    const users:Array<User> = await UserModel.find().exec();
    
    const toBeKicked = [];

    for(const user of users) {
        if(user.tg_id) {
            const member = await bot.getChatMember(chatId, user.tg_id);
            if(member.status != "administrator" && member.status != "creator" && user.strikes && user.strikes >= 3) {
                toBeKicked.push(user);
            }
        }
    }

    for(const user of toBeKicked) {
        if(user.tg_id) {
            await bot.kickChatMember(chatId, user.tg_id);
            await UserModel.findByIdAndDelete(user._id).exec();
        }
    }

    if(toBeKicked.length > 0) {
        const usersToString = (users:Array<User>) => users.map((user) => (user.username ? `@${user.username}`: `[${user.first_name}](tg://user?id=${user.tg_id})`)).join("\n");
        const message_text = `I seguenti utenti sono stati rimossi dal gruppo in seguito a tre ammonizioni:\n\n${usersToString(toBeKicked)}`;
        await bot.sendDocument(chatId, path.join(__dirname, "../img/red.gif"), {
            caption: message_text,
            parse_mode: "Markdown"
        });
    }
}

async function computeStrikes(bot: TelegramBot, chatId: string|number, kick:boolean = false, messageId?: number) {

    const users:Array<User> = await UserModel.find().exec();
    
    const gialli = [];
    const arancioni = [];
    const rossi = [];

    for(const user of users) {
        if(user.tg_id) {
            const member = await bot.getChatMember(chatId, user.tg_id);
            if(member.status != "administrator" && member.status != "creator") {
                if(user.strikes) {
                    if(user.strikes == 1) {
                        gialli.push(user);
                    } else if(user.strikes == 2){
                        arancioni.push(user);
                    } else if(user.strikes >= 3) {
                        rossi.push(user);
                    }
                }
            }
        }
    }

    const usersToString = (users:Array<User>, prefix:string) => users.map((user) => prefix + (user.username ? `@${user.username}`: `[${user.first_name}](tg://user?id=${user.tg_id})`)).join("\n");
    const message_text = `Non rispondere ad un sondaggio comporta un ammonizione, con tre ammonizioni si viene espulsi!\n\nAmmonizioni:\n\n${gialli.length > 0 ? `*Gialli:*\n\n${usersToString(gialli, "🟡 ")}\n\n` : ""}${arancioni.length > 0 ? `*Arancioni:*\n\n${usersToString(arancioni, "🟠 ")}\n\n` : ""}${rossi.length > 0 ? `*Rossi:*\n\n${usersToString(rossi, "🔴 ")}\n\n` : ""}Per azzerare le proprie ammonizioni cliccare il bottone sotto.\n\nGli utenti Rossi verranno espulsi tra 5 minuti!`;
    
    if(messageId) {
        try {
            await bot.editMessageText(message_text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [[{
                        text: "VAR",
                        callback_data: "var_cb"
                    }]]
                }
            });
        } catch(e) {
            console.log("Message not modified");
        }
    } else {
        await bot.sendMessage(chatId, message_text, {
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [[{
                    text: "VAR",
                    callback_data: "var_cb"
                }]]
            }
        });
        if(kick) {
            setTimeout(() => kickUsers(bot, chatId), KICK_TIME);
        }
    }
}

async function addNewMember(chatId:string|number, member:TelegramBot.User):Promise<void> {
    if(!member.is_bot) {

        const user = await UserModel.findOne({
            tg_id: member.id,
            group_id: chatId
        });

        if(!user) {
            await UserModel.create({
                tg_id: member.id,
                group_id: chatId,
                username: member.username,
                first_name: member.first_name,
                last_name: member.last_name
            });
            console.log(`[i] Added new user`);
        }
    }
}