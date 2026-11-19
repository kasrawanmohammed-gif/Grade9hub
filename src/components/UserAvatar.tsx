import React, { useEffect, useState } from 'react';
import { User as UserIcon } from 'lucide-react';

export function getUserInitials(name?: string | null): string {
  const cleaned = String(name || '').trim();
  if (!cleaned) return '';

  const words = cleaned
    .split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean);

  if (words.length === 0) return '';
  if (words.length === 1) {
    return Array.from(words[0]).slice(0, 2).join('').toUpperCase();
  }

  const firstChar = Array.from(words[0])[0] || '';
  const lastChar = Array.from(words[words.length - 1])[0] || '';
  return `${firstChar}${lastChar}`.toUpperCase();
}

interface UserAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  sizeClass?: string;
  textClass?: string;
  iconClass?: string;
  fallbackClass?: string;
  borderClass?: string;
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  avatarUrl,
  sizeClass = 'w-10 h-10',
  textClass = 'text-sm',
  iconClass = 'w-1/2 h-1/2',
  fallbackClass = 'bg-[#6B1118] text-white',
  borderClass = 'border border-[#E6DFD5]',
  className = '',
}) => {
  const normalizedUrl = typeof avatarUrl === 'string' ? avatarUrl.trim() : '';
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [normalizedUrl]);

  const showImage = Boolean(normalizedUrl) && !imgFailed;
  const initials = getUserInitials(name);

  return (
    <div
      role="img"
      aria-label={name?.trim() || 'User avatar'}
      className={`relative rounded-full overflow-hidden flex items-center justify-center shrink-0 select-none ${sizeClass} ${
        showImage ? borderClass : fallbackClass
      } ${className}`}
    >
      {showImage ? (
        <img
          src={normalizedUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover block"
        />
      ) : initials ? (
        <span
          className={`block max-w-full overflow-hidden text-ellipsis whitespace-nowrap px-0.5 font-bold leading-none tracking-tight text-center ${textClass}`}
        >
          {initials}
        </span>
      ) : (
        <UserIcon className={iconClass} aria-hidden="true" />
      )}
    </div>
  );
};
