import { Schema, model } from "mongoose";

export interface User {
    _id?: string,
    tg_id?: string,
    group_id?: string,
    strikes?: number,
    username?: string,
    first_name?: string,
    last_name?: string
}

const UserSchema = new Schema({
    tg_id: String,
    group_id: String,
    strikes: {
        type: Number,
        default: 0
    },
    username: String,
    first_name: String,
    last_name: String
});

const UserModel = model("user", UserSchema);

export default UserModel;