/*
 * Script per importare la lista degli utenti dall'export dei messaggi del gruppo (in JSON)
 * Utilizzo: node import_members.ts chatID /percorso/file/export.json
 */

import { default as path } from "path";
import { default as TelegramBot } from "node-telegram-bot-api";
import { connect } from "./db/database";
import GroupModel from "./db/models/group.model";
import UserModel from "./db/models/user.model";
import { default as fs } from "fs";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if(!TOKEN) {
    throw new Error("Unable to read TELEGRAM_BOT_TOKEN environment variable");
} else {

    const bot = new TelegramBot(TOKEN, {polling: false});
    
    connect().then(async _ => {
        const chatId = process.argv[2];
        const file = process.argv[3];
        const exported = JSON.parse(fs.readFileSync(file).toString());
        
        for(let message of exported.messages) {
            
            let userId;
            if(message.actor_id && message.actor_id.startsWith("user")) {
                userId = message.actor_id.slice(4);
            } else if(message.from_id && message.from_id.startsWith("user")) {
                userId = message.from_id.slice(4);
            }

            if(userId) {
                const user = await UserModel.findOne({tg_id: userId, group_id: chatId}).exec();
                if(!user) {
                    try {
                        const member = await bot.getChatMember(chatId, userId);
                        await addNewMember(chatId, member.user);
                        console.log(`${member.user.username ?? ""} (${member.user.first_name ?? ""} ${member.user.last_name ?? ""})`);
                    } catch (e) {
                        console.log(`Error adding user ${userId}`);
                    }
                }
            }
        }

        process.exit(0);
    });

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