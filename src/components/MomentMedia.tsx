"use client";

import Image from "next/image";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MomentCardDTO } from "@/server/types";
import { categoryLabel } from "@/config/product";

/**
 * Visuel d'un Moment : image, vidéo ou carte texte.
 * Vidéo : muette, lecture seulement quand elle est visible, désactivée si l'utilisateur
 * préfère moins d'animations, économise ses données, ou a coupé l'autoplay dans ses réglages.
 */
export function MomentMedia({
  moment,
  autoplay = true,
  priority = false,
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  className = "",
}: {
  moment: Pick<MomentCardDTO, "mediaType" | "mediaUrl" | "posterUrl" | "textTheme" | "title" | "category">;
  autoplay?: boolean;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  if (moment.mediaType === "VIDEO" && moment.mediaUrl) {
    return <VideoMedia src={moment.mediaUrl} poster={moment.posterUrl} autoplay={autoplay} className={className} />;
  }
  if (moment.mediaType === "IMAGE" && moment.mediaUrl) {
    return (
      <Image
        src={moment.mediaUrl}
        alt=""
        fill
        priority={priority}
        sizes={sizes}
        className={`object-cover ${className}`}
      />
    );
  }
  return (
    <div className={`absolute inset-0 text-cover-${moment.textTheme ?? "dusk"} ${className}`} aria-hidden>
      <div className="absolute inset-0 flex flex-col justify-center px-7 pb-24 pt-14">
        <span className="eyebrow !text-white/70">{categoryLabel(moment.category)}</span>
        <p className="font-display mt-2 text-[clamp(1.8rem,7vw,2.6rem)] leading-[1.05] text-white">{moment.title}</p>
      </div>
    </div>
  );
}

function VideoMedia({ src, poster, autoplay, className }: { src: string; poster: string | null; autoplay: boolean; className: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    setAllowed(autoplay && !reduce && !saveData);
  }, [autoplay]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !allowed) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) el.play().catch(() => {});
        else el.pause();
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [allowed]);

  return (
    <>
      <video
        ref={ref}
        className={`absolute inset-0 h-full w-full object-cover ${className}`}
        src={src}
        poster={poster ?? undefined}
        muted
        loop
        playsInline
        preload={allowed ? "metadata" : "none"}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        aria-hidden
      />
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const el = ref.current;
          if (!el) return;
          if (el.paused) el.play().catch(() => {});
          else el.pause();
        }}
        className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/60"
        aria-label={playing ? "Mettre la vidéo en pause" : "Lire la vidéo (sans son)"}
      >
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
    </>
  );
}
