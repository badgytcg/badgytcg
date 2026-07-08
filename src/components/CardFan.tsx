"use client";

import { useState } from "react";
import Image from "next/image";

const FAN_CARDS = [
  "https://ocg-card-catalog.s3.us-west-2.amazonaws.com/Spoiler_Previews/RedWizardPenguin.png",
  "https://ocg-card-catalog.s3.us-west-2.amazonaws.com/Spoiler_Previews/UmbrellaRod.png",
  "/cards/baron-fishpockets.png",
  "https://ocg-card-catalog.s3.us-west-2.amazonaws.com/Spoiler_Previews/StrikingSwordsmanPenguin.png",
  "https://ocg-card-catalog.s3.us-west-2.amazonaws.com/Spoiler_Previews/ChubopolisUnleashed.png",
];

// Base rotation, vertical offset, and horizontal position for each card
const FAN = [
  { rotate: -14, translateY: 12, left: "0%" },
  { rotate: -7,  translateY: 4,  left: "14%" },
  { rotate: 0,   translateY: 0,  left: "28%" },
  { rotate: 7,   translateY: 4,  left: "42%" },
  { rotate: 14,  translateY: 12, left: "56%" },
];

export default function CardFan() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="relative mx-auto flex h-64 w-full max-w-sm items-center justify-center sm:h-80">
      {FAN_CARDS.map((src, i) => {
        const isHovered = hovered === i;
        const base = FAN[i];

        // When hovered: lift up, scale up, zero rotation, full z-index
        const rotate = isHovered ? 0 : base.rotate;
        const translateY = isHovered ? -24 : base.translateY;
        const scale = isHovered ? 1.12 : 1;
        const zIndex = isHovered ? 50 : i;

        return (
          <div
            key={src}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className="absolute h-56 w-40 cursor-pointer overflow-hidden rounded-2xl sm:h-72 sm:w-52"
            style={{
              left: base.left,
              zIndex,
              transform: `rotate(${rotate}deg) translateY(${translateY}px) scale(${scale})`,
              transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease, filter 0.2s ease",
              boxShadow: isHovered
                ? "0 0 0 3px rgba(168,85,247,0.8), 0 24px 48px rgba(88,28,135,0.7)"
                : "0 8px 32px rgba(88,28,135,0.4)",
              filter: hovered !== null && !isHovered ? "brightness(0.6)" : "brightness(1)",
            }}
          >
            <Image src={src} alt="" fill sizes="220px" className="object-cover" unoptimized />
          </div>
        );
      })}
    </div>
  );
}
