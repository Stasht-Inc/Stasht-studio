import imgSunnyBeach from "figma:asset/05af2d92acfb7a6f368fe7ee6e352c1f3916bac3.png";

function Frame116() {
  return (
    <div className="box-border content-stretch flex flex-row gap-[7px] items-center justify-end p-0 relative shrink-0">
      <div
        className="relative shrink-0 text-[#393131] text-[16px] text-nowrap text-right"
      >
        <p className="block whitespace-pre text-[14px]">Trips</p>
      </div>
    </div>
  );
}

function Pill() {
  return (
    <div
      className="bg-[#ffd460] text-[#393131] hover:bg-[#ffd460]/90 box-border content-stretch flex flex-row gap-1.5 items-center justify-end px-4 py-0.5 relative rounded-lg shrink-0"
      data-name="Pill"
    >
      <Frame116 />
    </div>
  );
}

function Frame243() {
  return (
    <div className="box-border content-stretch flex flex-row gap-2.5 items-start justify-end px-2 py-0 relative shrink-0 w-[225px]">
      <Pill />
    </div>
  );
}

function Frame746() {
  return (
    <div className="relative shrink-0 w-full">
      <div className="flex flex-row items-center justify-center relative size-full">
        <div className="box-border content-stretch flex flex-row items-center justify-center px-2 py-0 relative w-full">
          <div
            className="basis-0 grow min-h-px min-w-px relative shrink-0 text-[#ffffff] text-[21px] text-left"
          >
            <p className="block font-semibold">{`Cancun - Mexico `}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Frame225() {
  return (
    <div className="box-border content-stretch flex flex-row gap-2.5 items-center justify-center px-2 py-0 relative rounded-2xl shrink-0">
      <div
        className="relative shrink-0 text-[#ffffff] text-[16px] text-center text-nowrap"
      >
        <p className="block whitespace-pre text-[14px]">
          Feb 12- Feb 28/25
        </p>
      </div>
    </div>
  );
}

function Frame747() {
  return (
    <div className="box-border content-stretch flex flex-col gap-0.5 items-start justify-start p-0 relative shrink-0 w-[228px]">
      <Frame243 />
      <Frame746 />
      <Frame225 />
    </div>
  );
}

function Frame239() {
  return (
    <div className="bg-gradient-to-b from-50% from-[#00000000] h-[280px] relative rounded-[58px] shrink-0 to-[#39313199] to-[95.673%] w-full">
      <div className="flex flex-row items-end justify-center relative size-full">
        <div className="box-border content-stretch flex flex-row gap-1 h-[280px] items-end justify-center px-8 py-6 relative w-full before:absolute before:inset-0 before:bg-gradient-to-t before:from-black/30 before:to-transparent before:pointer-events-none before:rounded-[58px]">
          <Frame747 />
        </div>
      </div>
    </div>
  );
}

function Chips() {
  return (
    <div
      className="absolute bg-[rgba(0,0,0,0.6)] box-border content-stretch flex flex-row gap-0.5 h-8 items-center justify-center left-[22px] px-[9px] py-2 rounded-lg top-[22px] w-[42px]"
      data-name="Chips"
    >
      <div
        aria-hidden="true"
        className="absolute border border-[#393131] border-solid inset-0 pointer-events-none rounded-lg"
      />
      <div className="not-italic relative shrink-0 text-[#ffffff] text-[15px] text-left text-nowrap">
        <p className="block whitespace-pre">{`67 `}</p>
      </div>
    </div>
  );
}

export default function SunnyBeach() {
  return (
    <div
      className="bg-center bg-cover bg-no-repeat box-border content-stretch flex flex-col gap-2.5 items-center justify-end p-0 relative rounded-[58px] shadow-[0px_0px_27px_0px_rgba(0,0,0,0.1)] size-full cursor-pointer hover:shadow-[0px_0px_20px_0px_rgba(0,0,0,0.25)] hover:ring-1 hover:ring-black/30"
      data-name="sunny beach"
      style={{ backgroundImage: `url('${imgSunnyBeach}')` }}
    >
      <Frame239 />
      <Chips />
    </div>
  );
}