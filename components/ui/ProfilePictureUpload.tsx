"use client";

import { useState, useRef } from "react";
import { Upload, X, Loader2, Camera } from "lucide-react";
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import Image from "next/image";

interface ProfilePictureUploadProps {
  userId: string;
  currentPhotoURL: string | null;
  onUploadComplete: (url: string) => void;
  onRemove: () => void;
}

export function ProfilePictureUpload({
  userId,
  currentPhotoURL,
  onUploadComplete,
  onRemove,
}: ProfilePictureUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB.");
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
          console.error("Upload failed:", error);
          setError("Upload failed. Please try again.");
          setIsUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          onUploadComplete(downloadURL);
          setIsUploading(false);
        }
      );
    } catch (err) {
      console.error("Error setting up upload:", err);
      setError("Failed to start upload.");
      setIsUploading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative group">
        <div 
          className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-2 border-white/10 bg-surface flex items-center justify-center cursor-pointer hover:border-primary/50 transition-all duration-300 relative"
          onClick={triggerFileInput}
        >
          {currentPhotoURL ? (
            <Image 
              src={currentPhotoURL} 
              alt="Profile" 
              fill 
              className="object-cover"
            />
          ) : (
            <div className="flex flex-col items-center text-text-secondary group-hover:text-primary transition-colors">
              <Camera size={32} />
              <span className="text-[10px] font-bold uppercase mt-1">Upload</span>
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
              <Loader2 size={24} className="text-primary animate-spin" />
              <span className="text-[10px] font-bold text-white mt-1">{Math.round(uploadProgress)}%</span>
            </div>
          )}

          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Upload size={24} className="text-white" />
          </div>
        </div>

        {currentPhotoURL && !isUploading && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="absolute -top-1 -right-1 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {error && <p className="text-red-400 text-xs font-medium">{error}</p>}
      
      {!currentPhotoURL && !isUploading && !error && (
        <p className="text-text-secondary text-xs">JPG, PNG or GIF. Max 5MB.</p>
      )}
    </div>
  );
}
