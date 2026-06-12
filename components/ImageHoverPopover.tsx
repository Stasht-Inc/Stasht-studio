import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";

interface ImageHoverPopoverProps {
  src: string;
  alt: string;
  children: React.ReactNode;
  maxWidth?: number;
  maxHeight?: number;
}

export default function ImageHoverPopover({ 
  src, 
  alt, 
  children, 
  maxWidth = 400, 
  maxHeight = 300 
}: ImageHoverPopoverProps) {
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent 
        className="w-auto p-2 border border-gray-200 shadow-lg bg-white rounded-lg"
        side="right"
        align="start"
        sideOffset={8}
      >
        <div className="relative overflow-hidden rounded-md">
          <img 
            src={src} 
            alt={alt}
            className="object-cover transition-transform duration-200 hover:scale-105"
            style={{
              maxWidth: `${maxWidth}px`,
              maxHeight: `${maxHeight}px`,
              width: 'auto',
              height: 'auto'
            }}
            loading="lazy"
          />
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}