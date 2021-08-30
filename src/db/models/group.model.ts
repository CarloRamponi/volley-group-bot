import { Schema, model } from "mongoose";

export interface Group {
    _id?: string,
    chatId?: string,
    title?: string
}

const GroupSchema = new Schema({
    chatId: {
        type: String,
        unique: true
    },
    title: String
});

const GroupModel = model("group", GroupSchema);

export default GroupModel;