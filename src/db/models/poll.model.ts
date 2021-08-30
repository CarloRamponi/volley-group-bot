import { Schema, model } from "mongoose";

export interface Poll {
    _id?: string,
    tg_id?: string,
    group_id?: string,
    responses?: Array<string>
}

const PollSchema = new Schema({
    tg_id: String,
    group_id: String,
    responses: [String]
});

const PollModel = model("poll", PollSchema);

export default PollModel;