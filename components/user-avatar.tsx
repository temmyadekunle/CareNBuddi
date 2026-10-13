"use client";

import { useSyncExternalStore } from "react";
import { Avatar, type AvatarProps } from "@/components/app-ui";
import { readPhoto } from "@/lib/profile-photo";
import { onLocalChange } from "@/lib/storage";

function subscribePhotos(cb: () => void): () => void {
  return onLocalChange(() => cb());
}

function readPhotoSnapshot(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return readPhoto(userId);
}

export function UserAvatar({ userId, name, ...props }: AvatarProps & { userId: string | null }) {
  const src = useSyncExternalStore(
    subscribePhotos,
    () => readPhotoSnapshot(userId),
    () => readPhotoSnapshot(userId),
  );

  return <Avatar name={name} src={src} {...props} />;
}
