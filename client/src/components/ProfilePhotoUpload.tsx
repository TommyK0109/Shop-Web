import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { uploadAvatarRequest, removeAvatarRequest } from "../api/auth";
import { ApiError } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { UserAvatar } from "./UserAvatar";
import type { AuthUser } from "../api/types";

export function ProfilePhotoUpload({ user }: { user: AuthUser }) {
  const input = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const setUser = useAuthStore((state) => state.setUser);
  const upload = useMutation({ mutationFn: uploadAvatarRequest, onSuccess: ({ user: updated }) => {
    setUser(updated); setImage(null); setMessage("Your profile photo has been updated.");
  } });
  const remove = useMutation({ mutationFn: removeAvatarRequest, onSuccess: ({ user: updated }) => {
    setUser(updated); setImage(null); setMessage("Your profile photo has been removed.");
  } });
  const busy = upload.isPending || remove.isPending;
  useEffect(() => {
    if (!image) { setPreview(null); return; }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  function choose(file: File | undefined) {
    if (!file) return;
    setError(null); setMessage(null); upload.reset(); remove.reset();
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Choose a JPEG, PNG, or WebP image."); return; }
    if (file.size > 5 * 1024 * 1024 || !file.size) { setError("Choose an image between 1 byte and 5 MB."); return; }
    setImage(file);
  }
  const mutationError = upload.error || remove.error;
  const errorMessage = error || (mutationError ? mutationError instanceof ApiError ? mutationError.message : "We could not update your photo. Please try again." : null);
  return <div className="profile-photo-section">
    <div className="profile-photo-preview">
      {preview ? <img src={preview} alt="New profile photo preview" /> : <UserAvatar user={user} className="profile-photo-avatar" />}
    </div>
    <div className="profile-photo-controls">
      <h3>Profile photo</h3>
      <p id="photo-hint">JPEG, PNG, or WebP. Up to 5 MB.</p>
      <input ref={input} id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose profile image" aria-describedby="photo-hint" className="sr-only" disabled={busy} onChange={(event) => { choose(event.target.files?.[0]); event.target.value = ""; }} />
      <div className="profile-photo-actions">
        <button type="button" className="button button-light" disabled={busy} onClick={() => input.current?.click()}>{user.avatarUrl ? "Change photo" : "Upload photo"}</button>
        {image && <><button type="button" className="button button-dark" disabled={busy} onClick={() => upload.mutate(image)}>{upload.isPending ? "Uploading…" : "Save photo"}</button><button type="button" className="text-link" disabled={busy} onClick={() => { setImage(null); setError(null); upload.reset(); }}>Cancel</button></>}
        {!image && user.avatarUrl && <button type="button" className="text-link" disabled={busy} onClick={() => { setError(null); setMessage(null); upload.reset(); remove.mutate(); }}>{remove.isPending ? "Removing…" : "Remove photo"}</button>}
      </div>
      {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
      {message && <p className="photo-success" role="status">{message}</p>}
    </div>
  </div>;
}
