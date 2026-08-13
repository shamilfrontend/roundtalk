import { Types } from "mongoose";
import { UserModel } from "../models/user.js";
import type { AuthUser } from "../types/auth.js";
import { HttpError } from "../utils/http-error.js";
import { isRecord } from "../utils/json.js";

export interface OAuthProfile {
  email: string;
  name: string;
  yandexId?: string;
  vkId?: string;
}

function toAuthUser(user: { _id: Types.ObjectId; email: string; name: string }): AuthUser {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
  };
}

function isDuplicateKey(error: unknown): boolean {
  return isRecord(error) && error.code === 11000;
}

async function applyProviderIds(
  user: InstanceType<typeof UserModel>,
  profile: OAuthProfile,
): Promise<AuthUser> {
  user.name = profile.name;

  if (profile.yandexId !== undefined && user.yandexId === undefined) {
    user.yandexId = profile.yandexId;
  }

  if (profile.vkId !== undefined && user.vkId === undefined) {
    user.vkId = profile.vkId;
  }

  await user.save();

  return toAuthUser(user);
}

export async function findUserById(id: string): Promise<AuthUser | null> {
  if (!Types.ObjectId.isValid(id)) {
    return null;
  }

  const user = await UserModel.findById(id);

  if (!user) {
    return null;
  }

  return toAuthUser(user);
}

export async function findOrCreateOAuthUser(
  profile: OAuthProfile,
): Promise<AuthUser> {
  const email = profile.email.trim().toLowerCase();

  if (email.length === 0) {
    throw new HttpError(
      400,
      "email_required",
      "Разрешите доступ к email",
    );
  }

  if (profile.yandexId !== undefined) {
    const byYandex = await UserModel.findOne({ yandexId: profile.yandexId });

    if (byYandex) {
      return applyProviderIds(byYandex, { ...profile, email });
    }
  }

  if (profile.vkId !== undefined) {
    const byVk = await UserModel.findOne({ vkId: profile.vkId });

    if (byVk) {
      return applyProviderIds(byVk, { ...profile, email });
    }
  }

  const byEmail = await UserModel.findOne({ email });

  if (byEmail) {
    return applyProviderIds(byEmail, { ...profile, email });
  }

  try {
    const created = await UserModel.create({
      email,
      name: profile.name,
      ...(profile.yandexId !== undefined ? { yandexId: profile.yandexId } : {}),
      ...(profile.vkId !== undefined ? { vkId: profile.vkId } : {}),
    });

    return toAuthUser(created);
  } catch (error) {
    if (!isDuplicateKey(error)) {
      throw error;
    }

    const existing = await UserModel.findOne({ email });

    if (!existing) {
      throw error;
    }

    return applyProviderIds(existing, { ...profile, email });
  }
}
