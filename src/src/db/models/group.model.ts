import { Schema, model } from "mongoose";

export interface Group {
    _id?: string,
    chatId?: string,
    title?: string,
    strikes?: boolean
}

const GroupSchema = new Schema({
    chatId: {
        type: String,
        unique: true
    },
    title: String,
    strikes: {
        type: Boolean,
        default: false
    }
});

const GroupModel = model("group", GroupSchema);

export default GroupModel;