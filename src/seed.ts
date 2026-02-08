import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import User from "./models/Users";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI!);

  const email = "admin@test.com";
  const password = "admin123";

  const exists = await User.findOne({ email });
  if (exists) {
    console.log("Admin already exists");
    process.exit(0);
  }

  const hashed = await bcrypt.hash(password, 10);
  await User.create({ email, password: hashed, role: "admin" });

  console.log("Admin created:", email, password);
  process.exit(0);
}

run();
