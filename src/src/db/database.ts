import { assert } from "console";
import Mongoose from "mongoose";

let database: Mongoose.Connection;

const MONGO_URL = process.env.MONGO_URL;

assert(MONGO_URL, "MONGO_URL environment variable is not set");

export const connect = async () => {

  if (database) {
    return;
  }

  await Mongoose.connect(MONGO_URL ?? "");

  database = Mongoose.connection;
  database.once("open", async () => {
    console.log("Connected to database");
  });
  database.on("error", () => {
    console.log("Error connecting to database");
  });
};

export const disconnect = async () => {

  if (!database) {
    return;
  }

  await Mongoose.disconnect();
};