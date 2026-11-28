import Image from "next/image";

/**
 * The cosystem. wordmark, from the owner's logo file.
 *
 * Two raster variants cut from the same 1794px source: black type for light
 * surfaces, white type for the dark dashboard sidebar. The orange dot is the
 * same in both. `height` drives the size; width follows the 720×138 ratio.
 */
const RATIO = 720 / 138;

export function Logo({
  variant = "dark",
  height = 26,
  className,
  priority = false,
}: {
  variant?: "dark" | "light";
  height?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={variant === "light" ? "/brand/cosystem-logo-white.png" : "/brand/cosystem-logo.png"}
      alt="cosystem."
      width={Math.round(height * RATIO)}
      height={height}
      preload={priority}
      className={className}
      style={{ height, width: "auto" }}
    />
  );
}
