import Mongoose from "mongoose";

let database: Mongoose.Connection;

export const connect = async () => {
  
  const uri = "mongodb://127.0.0.1:27017/volleybot";

  if (database) {
    return;
  }

  await Mongoose.connect(uri, {
    useNewUrlParser: true,
    useFindAndModify: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
  });

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