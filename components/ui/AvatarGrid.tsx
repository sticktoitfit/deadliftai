"use client";

import { useState, useRef } from "react";
import { Upload, Loader2, Camera, Plus } from "lucide-react";
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import Image from "next/image";

/** Pre-defined avatar options for the profile setup picker */
export const AVATARS = [
  { id: "lifter-1", emoji: "🏋️", label: "Lifter" },
  { id: "fire",     emoji: "🔥", label: "Fire" },
  { id: "bolt",     emoji: "⚡", label: "Bolt" },
  { id: "skull",    emoji: "💀", label: "Skull" },
  { id: "flex",     emoji: "💪", label: "Flex" },
  { id: "target",   emoji: "🎯", label: "Target" },
  { id: "gem",      emoji: "💎", label: "Gem" },
  { id: "wolf",     emoji: "🐺", label: "Wolf" },
  { id: "rocket",   emoji: "🚀", label: "Rocket" },
  { id: "crown",    emoji: "👑", label: "Crown" },
  { id: "shield",   emoji: "🛡️", label: "Shield" },
  { id: "atom",     emoji: "⚛️", label: "Atom" },
];

interface AvatarGridProps {
  userId: string;
  selected: string;
  onSelect: (id: string) => void;
  onUploadComplete: (url: string) => void;
  /** Optional Google photo URL to show as an option */
  googlePhotoURL?: string | null;
  /** Optional uploaded photo URL */
  uploadedPhotoURL?: string | null;
}

/**
 * Renders a scrollable grid of avatar options for the profile-setup step.
 * Includes pre-defined emojis, existing photo options, and an upload trigger.
 */
export function AvatarGrid({ 
  userId, 
  selected, 
  onSelect, 
  onUploadComplete, 
  googlePhotoURL, 
  uploadedPhotoURL 
}: AvatarGridProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Max size 5MB.");
      return;
    }

    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const storageRef = ref(storage, `avatars/${userId}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error("Upload error:", error);
          setError("Upload failed.");
          setIsUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          onUploadComplete(downloadURL);
          setIsUploading(false);
        }
      );
    } catch (err) {
      console.error("Upload setup error:", err);
      setError("System error.");
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {/* Upload Tile */}
        <div className="relative group">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative flex flex-col items-center justify-center w-full aspect-square rounded-2xl 
              border-2 transition-all duration-200 border-dashed
              ${isUploading 
                ? "border-primary/50 bg-primary/5 cursor-wait" 
                : "border-white/10 bg-surface hover:bg-surface-hover hover:border-white/20"
              }
            `}
          >
            {isUploading ? (
              <div className="flex flex-col items-center">
                <Loader2 size={24} className="text-primary animate-spin" />
                <span className="text-[10px] font-bold text-white mt-1">{Math.round(uploadProgress)}%</span>
              </div>
            ) : (
              <div className="flex flex-col items-center text-text-secondary group-hover:text-primary transition-colors">
                <Camera size={24} />
                <span className="text-[10px] font-bold uppercase mt-1">Upload</span>
              </div>
            )}
            
            <Plus size={12} className="absolute top-2 right-2 text-primary" />
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
        </div>

        {/* Existing Photo Options */}
        {uploadedPhotoURL && (
          <button
            type="button"
            onClick={() => onSelect("uploaded-photo")}
            className={`
              relative flex flex-col items-center justify-center aspect-square rounded-2xl 
              border-2 transition-all duration-200 overflow-hidden
              ${selected === "uploaded-photo"
                ? "border-primary bg-primary/10 shadow-[0_0_20px_var(--color-primary-glow)] scale-105"
                : "border-white/10 bg-surface hover:bg-surface-hover hover:border-white/20"
              }
            `}
          >
            <Image 
              src={uploadedPhotoURL} 
              alt="Uploaded" 
              fill 
              className="object-cover" 
            />
            {selected === "uploaded-photo" && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center border-2 border-background z-10">
                <span className="text-background text-[10px] font-black">✓</span>
              </span>
            )}
          </button>
        )}

        {googlePhotoURL && (
          <button
            type="button"
            onClick={() => onSelect("google-photo")}
            className={`
              relative flex flex-col items-center justify-center aspect-square rounded-2xl 
              border-2 transition-all duration-200 overflow-hidden
              ${selected === "google-photo"
                ? "border-primary bg-primary/10 shadow-[0_0_20px_var(--color-primary-glow)] scale-105"
                : "border-white/10 bg-surface hover:bg-surface-hover hover:border-white/20"
              }
            `}
          >
            <Image 
              src={googlePhotoURL} 
              alt="Google Profile" 
              fill 
              className="object-cover" 
            />
            {selected === "google-photo" && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center border-2 border-background z-10">
                <span className="text-background text-[10px] font-black">✓</span>
              </span>
            )}
          </button>
        )}

        {/* Emoji Avatars */}
        {AVATARS.map((av) => {
          const isSelected = selected === av.id;
          return (
            <button
              key={av.id}
              type="button"
              onClick={() => onSelect(av.id)}
              aria-label={`Select avatar: ${av.label}`}
              className={`
                relative flex flex-col items-center justify-center aspect-square rounded-2xl 
                border-2 transition-all duration-200 text-3xl
                ${isSelected
                  ? "border-primary bg-primary/10 shadow-[0_0_20px_var(--color-primary-glow)] scale-105"
                  : "border-white/10 bg-surface hover:bg-surface-hover hover:border-white/20"
                }
              `}
            >
              <span>{av.emoji}</span>

              {isSelected && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center border-2 border-background">
                  <span className="text-background text-[10px] font-black">✓</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      
      {error && (
        <p className="text-red-400 text-[10px] font-bold uppercase tracking-wider text-center">
          {error}
        </p>
      )}
    </div>
  );
}
