import { useState } from "react";
import type { AuthUser } from "../api/types";

export function UserAvatar({ user, className = "" }: { user: AuthUser; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <span className={`avatar ${className}`}>
    {user.avatarUrl && failedUrl !== user.avatarUrl
      ? <img src={user.avatarUrl} alt="" onError={() => setFailedUrl(user.avatarUrl!)} referrerPolicy="no-referrer" />
      : user.email[0]?.toUpperCase()}
  </span>;
}
