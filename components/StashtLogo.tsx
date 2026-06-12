import svgPaths from "../imports/svg-nf2tpvishn";

interface StashtLogoProps {
  className?: string;
  fill?: string;
}

export default function StashtLogo({ className = "h-16 w-16", fill = "#6C60FF" }: StashtLogoProps) {
  return (
    <div className={className}>
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 160 41"
      >
        <g clipPath="url(#clip0_1_227)" id="Layer_1">
          <path
            d={svgPaths.p2234ac00}
            fill={fill}
            id="Vector"
          />
          <path
            d={svgPaths.p11dda00}
            fill={fill}
            id="Vector_2"
          />
          <path
            d={svgPaths.p3c127480}
            fill={fill}
            id="Vector_3"
          />
          <path
            d={svgPaths.p15b5dc00}
            fill={fill}
            id="Vector_4"
          />
          <path
            d={svgPaths.p5c0f300}
            fill={fill}
            id="Vector_5"
          />
          <path
            d={svgPaths.p1fd0ff80}
            fill={fill}
            id="Vector_6"
          />
          <path
            d={svgPaths.p23020900}
            fill={fill}
            id="Vector_7"
          />
        </g>
        <defs>
          <clipPath id="clip0_1_227">
            <rect fill="white" height="41" width="160" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}