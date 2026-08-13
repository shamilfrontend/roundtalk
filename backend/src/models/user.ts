import { Schema, model } from "mongoose";

export interface UserDoc {
  email: string;
  yandexId?: string;
  vkId?: string;
  name: string;
  createdAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    yandexId: {
      type: String,
      unique: true,
      sparse: true,
    },
    vkId: {
      type: String,
      unique: true,
      sparse: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

export const UserModel = model<UserDoc>("User", userSchema);
