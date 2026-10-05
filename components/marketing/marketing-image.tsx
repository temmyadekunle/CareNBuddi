import type { MarketingImage } from "@/lib/marketing-images";

type Props = {
  image: MarketingImage;
  className?: string;
  sizes?: string;
  /** Above-the-fold images should load eagerly with high priority. */
  priority?: boolean;
  /** Set for purely visual images (backgrounds, textures) that add no meaning. */
  decorative?: boolean;
};

export function MarketingImage({
  image,
  className,
  sizes,
  priority,
  decorative,
}: Props) {
  return (
    // Remote Pexels files are pre-sized by URL, so the Next.js optimizer adds
    // nothing here. width/height keep the layout stable while loading.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.src(1080)}
      srcSet={image.srcSet || undefined}
      sizes={sizes ?? image.sizes}
      alt={decorative ? "" : image.alt}
      aria-hidden={decorative || undefined}
      width={image.width}
      height={image.height}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
      className={className}
    />
  );
}
