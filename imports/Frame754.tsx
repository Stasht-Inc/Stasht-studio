import imgSunnyBeach from "figma:asset/05af2d92acfb7a6f368fe7ee6e352c1f3916bac3.png";
import imgAdobeStock481724704Preview from "figma:asset/26a535d4ae4a1cda1cc08a29995c0ad52273bbcb.png";
import imgCloseUpOfMaleFace from "figma:asset/087ab8e97cf8a625e87975fda60c19e3d883bd77.png";
import imgRockClimbing from "figma:asset/a3e3000bfe54dd4475546d95ccae9e54943f7f46.png";
import imgKtichenRenovation from "figma:asset/4372b0d1ddd875ed7ce6f43204e9973e505d55c7.png";
import imgFemaleFaceUpclose from "figma:asset/23b4f833bd610625b26f040f2002f0d528d595f6.png";
import imgGrandmaAndGrandpaAtAPicknic from "figma:asset/23348f096adcf25164bae8e20ab2f6b759758677.png";
import { imgAdobeStock481724704Preview1 } from "./svg-wv4zk";
import { imgAdobeStock481724704Preview1 as imgAdobeStock481724704Preview1Vfg13 } from "./svg-vfg13";

function Frame116() {
  return (
    <div className="box-border content-stretch flex flex-row gap-[7px] items-center justify-end p-0 relative shrink-0">
      <div
        className="font-['Roboto:Medium',_sans-serif] font-medium leading-[0] relative shrink-0 text-[#393131] text-[16px] text-nowrap text-right"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p className="block leading-[27px] whitespace-pre">Trips</p>
      </div>
    </div>
  );
}

function Pill() {
  return (
    <div
      className="bg-[#ffd460] box-border content-stretch flex flex-row gap-1.5 items-center justify-end px-4 py-1.5 relative rounded-[18px] shrink-0"
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
            className="basis-0 font-['Roboto:Medium',_sans-serif] font-medium grow leading-[0] min-h-px min-w-px relative shrink-0 text-[#ffffff] text-[21px] text-left"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            <p className="block leading-[24px]">{`Cancun - Mexico `}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Frame225() {
  return (
    <div className="box-border content-stretch flex flex-row gap-2.5 items-center justify-center px-2 py-[3px] relative rounded-2xl shrink-0">
      <div
        className="font-['Roboto:Regular',_sans-serif] font-normal leading-[0] relative shrink-0 text-[#ffffff] text-[16px] text-center text-nowrap"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p className="block leading-[19.2px] whitespace-pre">
          Feb 12- Feb 28/25
        </p>
      </div>
    </div>
  );
}

function Frame747() {
  return (
    <div className="box-border content-stretch flex flex-col gap-1 items-start justify-start p-0 relative shrink-0 w-[228px]">
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
        <div className="box-border content-stretch flex flex-row gap-[11px] items-end justify-center px-8 py-6 relative w-full">
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
      <div className="font-['Inter:Medium',_sans-serif] font-medium leading-[0] not-italic relative shrink-0 text-[#ffffff] text-[15px] text-left text-nowrap">
        <p className="block leading-[26.2px] whitespace-pre">{`67 `}</p>
      </div>
    </div>
  );
}

function SunnyBeach() {
  return (
    <div
      className="w-[280px] bg-center bg-cover bg-no-repeat box-border content-stretch flex flex-col gap-2.5 h-64 items-center justify-end p-0 relative rounded-[58px] shadow-[0px_0px_27px_0px_rgba(0,0,0,0.1)] shrink-0"
      data-name="sunny beach"
      style={{ backgroundImage: `url('${imgSunnyBeach}')` }}
    >
      <Frame239 />
      <Chips />
      <Frame749 />
    </div>
  );
}

function MaskGroup() {
  return (
    <div
      className="grid-cols-[max-content] grid-rows-[max-content] inline-grid mr-[-10px] order-4 place-items-start relative shrink-0"
      data-name="Mask group"
    >
      <div
        className="[grid-area:1_/_1] bg-center bg-cover bg-no-repeat mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[20.414px_77.241px] mask-size-[32px_32px] ml-[-20.414px] mt-[-77.241px] size-[187.034px]"
        data-name="AdobeStock_481724704_Preview"
        style={{
          backgroundImage: `url('${imgAdobeStock481724704Preview}')`,
          maskImage: `url('${imgAdobeStock481724704Preview1Vfg13}')`,
        }}
      />
    </div>
  );
}

function MaskGroup1() {
  return (
    <div
      className="grid-cols-[max-content] grid-rows-[max-content] inline-grid mr-[-10px] order-3 place-items-start relative shrink-0"
      data-name="Mask group"
    >
      <div
        className="[grid-area:1_/_1] bg-center bg-cover bg-no-repeat mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[20.414px_113.778px] mask-size-[32px_32px] ml-[-20.414px] mt-[-113.778px] size-[187.034px]"
        data-name="AdobeStock_481724704_Preview"
        style={{
          backgroundImage: `url('${imgAdobeStock481724704Preview}')`,
          maskImage: `url('${imgAdobeStock481724704Preview1Vfg13}')`,
        }}
      />
    </div>
  );
}

function MaskGroup2() {
  return (
    <div
      className="grid-cols-[max-content] grid-rows-[max-content] inline-grid mr-[-10px] order-2 place-items-start relative shrink-0"
      data-name="Mask group"
    >
      <div
        className="[grid-area:1_/_1] bg-center bg-cover bg-no-repeat mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[20.414px_40.889px] mask-size-[32px_32px] ml-[-20.414px] mt-[-40.889px] size-[187.034px]"
        data-name="AdobeStock_481724704_Preview"
        style={{
          backgroundImage: `url('${imgAdobeStock481724704Preview}')`,
          maskImage: `url('${imgAdobeStock481724704Preview1Vfg13}')`,
        }}
      />
    </div>
  );
}

function MaskGroup3() {
  return (
    <div
      className="grid-cols-[max-content] grid-rows-[max-content] inline-grid mr-[-10px] order-1 place-items-start relative shrink-0"
      data-name="Mask group"
    >
      <div
        className="[grid-area:1_/_1] bg-center bg-cover bg-no-repeat mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[58px_40.889px] mask-size-[32px_32px] ml-[-58px] mt-[-40.889px] size-[187.034px]"
        data-name="AdobeStock_481724704_Preview"
        style={{
          backgroundImage: `url('${imgAdobeStock481724704Preview}')`,
          maskImage: `url('${imgAdobeStock481724704Preview1Vfg13}')`,
        }}
      />
      <div className="[grid-area:1_/_1] flex h-[39px] items-center justify-center ml-0 mt-[-4px] relative w-[35px]">
        <div className="flex-none rotate-[180deg] scale-y-[-100%]">
          <div
            className="bg-[rgba(0,0,0,0.4)] h-[39px] mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[0px_4px] mask-size-[32px_32px] w-[35px]"
            style={{ maskImage: `url('${imgAdobeStock481724704Preview1Vfg13}')` }}
          />
        </div>
      </div>
      <div
        className="[grid-area:1_/_1] font-['Roboto:Medium',_sans-serif] font-medium leading-[0] mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[-11px_-2px] mask-size-[32px_32px] ml-[21px] mt-0.5 relative text-[#ffffff] text-[16px] text-nowrap text-right translate-x-[-100%]"
        style={{
          fontVariationSettings: "'wdth' 100",
          maskImage: `url('${imgAdobeStock481724704Preview1Vfg13}')`,
        }}
      >
        <p className="block leading-[27px] whitespace-pre">2</p>
      </div>
    </div>
  );
}

function Collaborators() {
  return (
    <div
      className="box-border content-stretch flex flex-row-reverse h-8 items-center justify-start leading-[0] pl-0 pr-2.5 py-0 relative shrink-0"
      data-name="Collaborators"
    >
      <MaskGroup />
      <MaskGroup1 />
      <MaskGroup2 />
      <MaskGroup3 />
    </div>
  );
}

function Plus02() {
  return (
    <div className="relative shrink-0 size-5" data-name="plus-02">
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 20 20"
      >
        <g id="plus-02">
          <path
            d="M10 5L10 15M15 10L5 10"
            id="Icon"
            stroke="var(--stroke-0, white)"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </g>
      </svg>
    </div>
  );
}

function Chips1() {
  return (
    <div
      className="bg-[#393131] box-border content-stretch flex flex-row gap-px h-8 items-center justify-center px-3 py-2 relative rounded-lg shrink-0"
      data-name="Chips"
    >
      <div
        aria-hidden="true"
        className="absolute border border-[#393131] border-solid inset-0 pointer-events-none rounded-lg"
      />
      <Plus02 />
      <div
        className="font-['Roboto:Medium',_sans-serif] font-medium leading-[0] relative shrink-0 text-[#ffffff] text-[16px] text-nowrap text-right"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p className="block leading-[27px] whitespace-pre">{`Add `}</p>
      </div>
    </div>
  );
}

function Frame209() {
  return (
    <div className="box-border content-stretch flex flex-row items-center justify-between p-0 relative shrink-0 w-[235px]">
      <Collaborators />
      <Chips1 />
    </div>
  );
}

function Frame749() {
  return (
    <div className="absolute box-border content-stretch flex flex-col gap-2.5 items-center justify-start left-[5px] p-0 top-60 w-[235px]">
      <Frame209 />
    </div>
  );
}

function Frame748() {
  return (
    <div className="relative shrink-0 w-full">
      <div className="flex flex-row items-center justify-center relative size-full">
        <div className="box-border content-stretch flex flex-row items-center justify-center px-2 py-0 relative w-full">
          <div
            className="basis-0 font-['Roboto:Medium',_sans-serif] font-medium grow leading-[0] min-h-px min-w-px relative shrink-0 text-[#ffffff] text-[21px] text-left"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            <p className="block leading-[24px]">Rock Climbing Group</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Frame226() {
  return (
    <div className="box-border content-stretch flex flex-row gap-2.5 items-center justify-center px-2 py-[3px] relative rounded-2xl shrink-0">
      <div
        className="font-['Roboto:Regular',_sans-serif] font-normal leading-[0] relative shrink-0 text-[#ffffff] text-[16px] text-center text-nowrap"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p className="block leading-[19.2px] whitespace-pre">2007- Present</p>
      </div>
    </div>
  );
}

function MaskGroup4() {
  return (
    <div
      className="grid-cols-[max-content] grid-rows-[max-content] inline-grid place-items-start relative shrink-0"
      data-name="Mask group"
    >
      <div
        className="[grid-area:1_/_1] bg-center bg-cover bg-no-repeat mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[0.64px_0.96px] mask-size-[32px_32px] ml-[-0.64px] mt-[-0.96px] size-[33.92px]"
        data-name="close up of male face"
        style={{
          backgroundImage: `url('${imgCloseUpOfMaleFace}')`,
          maskImage: `url('${imgAdobeStock481724704Preview1Vfg13}')`,
        }}
      />
    </div>
  );
}

function Frame224() {
  return (
    <div className="absolute box-border content-stretch flex flex-row gap-1 h-8 items-center justify-center leading-[0] left-0 px-2 py-px rounded-2xl top-[-34px]">
      <MaskGroup4 />
      <div
        className="font-['Roboto:Medium',_sans-serif] font-medium relative shrink-0 text-[#ffffff] text-[18px] text-left text-nowrap"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p className="block leading-[19.2px] whitespace-pre">Dave Sanderson</p>
      </div>
    </div>
  );
}

function Frame750() {
  return (
    <div className="box-border content-stretch flex flex-col gap-1 items-start justify-start p-0 relative shrink-0 w-[228px]">
      <Frame748 />
      <Frame226 />
      <Frame224 />
    </div>
  );
}

function Frame240() {
  return (
    <div className="bg-gradient-to-b from-50% from-[#00000000] h-[280px] relative rounded-[58px] shrink-0 to-[#39313199] to-[95.673%] w-full">
      <div className="flex flex-row items-end justify-center relative size-full">
        <div className="box-border content-stretch flex flex-row gap-[11px] items-end justify-center px-8 py-6 relative w-full">
          <Frame750 />
        </div>
      </div>
    </div>
  );
}

function Chips2() {
  return (
    <div
      className="absolute bg-[rgba(0,0,0,0.6)] box-border content-stretch flex flex-row gap-0.5 h-8 items-center justify-center left-[30px] px-[9px] py-2 rounded-lg top-[30px] w-[42px]"
      data-name="Chips"
    >
      <div
        aria-hidden="true"
        className="absolute border border-[#393131] border-solid inset-0 pointer-events-none rounded-lg"
      />
      <div className="font-['Inter:Medium',_sans-serif] font-medium leading-[0] not-italic relative shrink-0 text-[#ffffff] text-[15px] text-left text-nowrap">
        <p className="block leading-[26.2px] whitespace-pre">{`123 `}</p>
      </div>
    </div>
  );
}

function MaskGroup5() {
  return (
    <div
      className="grid-cols-[max-content] grid-rows-[max-content] inline-grid mr-[-10px] order-4 place-items-start relative shrink-0"
      data-name="Mask group"
    >
      <div
        className="[grid-area:1_/_1] bg-center bg-cover bg-no-repeat mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[20.414px_77.241px] mask-size-[32px_32px] ml-[-20.414px] mt-[-77.241px] size-[187.034px]"
        data-name="AdobeStock_481724704_Preview"
        style={{
          backgroundImage: `url('${imgAdobeStock481724704Preview}')`,
          maskImage: `url('${imgAdobeStock481724704Preview1Vfg13}')`,
        }}
      />
    </div>
  );
}

function MaskGroup6() {
  return (
    <div
      className="grid-cols-[max-content] grid-rows-[max-content] inline-grid mr-[-10px] order-3 place-items-start relative shrink-0"
      data-name="Mask group"
    >
      <div
        className="[grid-area:1_/_1] bg-center bg-cover bg-no-repeat mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[20.414px_113.778px] mask-size-[32px_32px] ml-[-20.414px] mt-[-113.778px] size-[187.034px]"
        data-name="AdobeStock_481724704_Preview"
        style={{
          backgroundImage: `url('${imgAdobeStock481724704Preview}')`,
          maskImage: `url('${imgAdobeStock481724704Preview1Vfg13}')`,
        }}
      />
    </div>
  );
}

function MaskGroup7() {
  return (
    <div
      className="grid-cols-[max-content] grid-rows-[max-content] inline-grid mr-[-10px] order-2 place-items-start relative shrink-0"
      data-name="Mask group"
    >
      <div
        className="[grid-area:1_/_1] bg-center bg-cover bg-no-repeat mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[20.414px_40.889px] mask-size-[32px_32px] ml-[-20.414px] mt-[-40.889px] size-[187.034px]"
        data-name="AdobeStock_481724704_Preview"
        style={{
          backgroundImage: `url('${imgAdobeStock481724704Preview}')`,
          maskImage: `url('${imgAdobeStock481724704Preview1Vfg13}')`,
        }}
      />
    </div>
  );
}

function MaskGroup8() {
  return (
    <div
      className="grid-cols-[max-content] grid-rows-[max-content] inline-grid mr-[-10px] order-1 place-items-start relative shrink-0"
      data-name="Mask group"
    >
      <div
        className="[grid-area:1_/_1] bg-center bg-cover bg-no-repeat mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[58px_40.889px] mask-size-[32px_32px] ml-[-58px] mt-[-40.889px] size-[187.034px]"
        data-name="AdobeStock_481724704_Preview"
        style={{
          backgroundImage: `url('${imgAdobeStock481724704Preview}')`,
          maskImage: `url('${imgAdobeStock481724704Preview1Vfg13}')`,
        }}
      />
      <div className="[grid-area:1_/_1] flex h-[39px] items-center justify-center ml-0 mt-[-4px] relative w-[35px]">
        <div className="flex-none rotate-[180deg] scale-y-[-100%]">
          <div
            className="bg-[rgba(0,0,0,0.4)] h-[39px] mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[0px_4px] mask-size-[32px_32px] w-[35px]"
            style={{ maskImage: `url('${imgAdobeStock481724704Preview1Vfg13}')` }}
          />
        </div>
      </div>
      <div
        className="[grid-area:1_/_1] font-['Roboto:Medium',_sans-serif] font-medium leading-[0] mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[-11px_-2px] mask-size-[32px_32px] ml-[21px] mt-0.5 relative text-[#ffffff] text-[16px] text-nowrap text-right translate-x-[-100%]"
        style={{
          fontVariationSettings: "'wdth' 100",
          maskImage: `url('${imgAdobeStock481724704Preview1Vfg13}')`,
        }}
      >
        <p className="block leading-[27px] whitespace-pre">2</p>
      </div>
    </div>
  );
}

function Frame227() {
  return (
    <div className="box-border content-stretch flex flex-row-reverse h-8 items-center justify-start leading-[0] pl-0 pr-2.5 py-0 relative shrink-0">
      <MaskGroup5 />
      <MaskGroup6 />
      <MaskGroup7 />
      <MaskGroup8 />
    </div>
  );
}

function Plus3() {
  return (
    <div className="relative shrink-0 size-5" data-name="plus-02">
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 20 20"
      >
        <g id="plus-02">
          <path
            d="M10 5L10 15M15 10L5 10"
            id="Icon"
            stroke="var(--stroke-0, white)"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </g>
      </svg>
    </div>
  );
}

function Chips3() {
  return (
    <div
      className="bg-[#393131] box-border content-stretch flex flex-row gap-px h-8 items-center justify-center px-3 py-2 relative rounded-lg shrink-0"
      data-name="Chips"
    >
      <div
        aria-hidden="true"
        className="absolute border border-[#393131] border-solid inset-0 pointer-events-none rounded-lg"
      />
      <Plus3 />
      <div
        className="font-['Roboto:Medium',_sans-serif] font-medium leading-[0] relative shrink-0 text-[#ffffff] text-[16px] text-nowrap text-right"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p className="block leading-[27px] whitespace-pre">{`Add `}</p>
      </div>
    </div>
  );
}

function Frame210() {
  return (
    <div className="absolute box-border content-stretch flex flex-row items-center justify-between left-[5px] p-0 top-60 w-[230px]">
      <Frame227 />
      <Chips3 />
    </div>
  );
}

function RockClimbing() {
  return (
    <div
      className="w-[280px] bg-center bg-cover bg-no-repeat box-border content-stretch flex flex-col gap-2.5 h-64 items-center justify-end p-0 relative rounded-[58px] shadow-[0px_0px_27px_0px_rgba(0,0,0,0.1)] shrink-0"
      data-name="rock climbing"
      style={{ backgroundImage: `url('${imgRockClimbing}')` }}
    >
      <Frame240 />
      <Chips2 />
      <Frame210 />
    </div>
  );
}

function Frame751() {
  return (
    <div className="relative shrink-0 w-full">
      <div className="flex flex-row items-center justify-center relative size-full">
        <div className="box-border content-stretch flex flex-row items-center justify-center px-2 py-0 relative w-full">
          <div
            className="basis-0 font-['Roboto:Medium',_sans-serif] font-medium grow leading-[0] min-h-px min-w-px relative shrink-0 text-[#ffffff] text-[21px] text-left"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            <p className="block leading-[24px]">Kitchen Renos</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Frame228() {
  return (
    <div className="box-border content-stretch flex flex-row gap-2.5 items-center justify-center px-2 py-[3px] relative rounded-2xl shrink-0">
      <div
        className="font-['Roboto:Regular',_sans-serif] font-normal leading-[0] relative shrink-0 text-[#ffffff] text-[16px] text-center text-nowrap"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p className="block leading-[19.2px] whitespace-pre">
          Mar 9 - Apr 18/25
        </p>
      </div>
    </div>
  );
}

function Frame752() {
  return (
    <div className="box-border content-stretch flex flex-col gap-1 items-start justify-start p-0 relative shrink-0 w-[228px]">
      <Frame751 />
      <Frame228 />
    </div>
  );
}

function Frame241() {
  return (
    <div className="bg-gradient-to-b from-50% from-[#00000000] h-[280px] relative rounded-[58px] shrink-0 to-[#39313199] to-[95.673%] w-full">
      <div className="flex flex-row items-end justify-center relative size-full">
        <div className="box-border content-stretch flex flex-row gap-[11px] items-end justify-center px-8 py-6 relative w-full">
          <Frame752 />
        </div>
      </div>
    </div>
  );
}

function Chips4() {
  return (
    <div
      className="absolute bg-[rgba(0,0,0,0.6)] box-border content-stretch flex flex-row gap-0.5 h-8 items-center justify-center left-[22px] px-[9px] py-2 rounded-lg top-[22px] w-[42px]"
      data-name="Chips"
    >
      <div
        aria-hidden="true"
        className="absolute border border-[#393131] border-solid inset-0 pointer-events-none rounded-lg"
      />
      <div className="font-['Inter:Medium',_sans-serif] font-medium leading-[0] not-italic relative shrink-0 text-[#ffffff] text-[15px] text-left text-nowrap">
        <p className="block leading-[26.2px] whitespace-pre">98</p>
      </div>
    </div>
  );
}

function Plus4() {
  return (
    <div className="relative shrink-0 size-5" data-name="plus-02">
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 20 20"
      >
        <g id="plus-02">
          <path
            d="M10 5L10 15M15 10L5 10"
            id="Icon"
            stroke="var(--stroke-0, white)"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </g>
      </svg>
    </div>
  );
}

function Chips5() {
  return (
    <div
      className="bg-[#393131] box-border content-stretch flex flex-row gap-px h-8 items-center justify-center px-3 py-2 relative rounded-lg shrink-0"
      data-name="Chips"
    >
      <div
        aria-hidden="true"
        className="absolute border border-[#393131] border-solid inset-0 pointer-events-none rounded-lg"
      />
      <Plus4 />
      <div
        className="font-['Roboto:Medium',_sans-serif] font-medium leading-[0] relative shrink-0 text-[#ffffff] text-[16px] text-nowrap text-right"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p className="block leading-[27px] whitespace-pre">{`Add `}</p>
      </div>
    </div>
  );
}

function Frame211() {
  return (
    <div className="box-border content-stretch flex flex-row gap-[11px] items-center justify-end p-0 relative shrink-0 w-full">
      <Chips5 />
    </div>
  );
}

function Frame753() {
  return (
    <div className="absolute box-border content-stretch flex flex-col gap-2.5 items-end justify-start left-[5px] p-0 top-60 w-[235px]">
      <Frame211 />
    </div>
  );
}

function KtichenRenovation() {
  return (
    <div
      className="w-[280px] bg-center bg-cover bg-no-repeat box-border content-stretch flex flex-col gap-2.5 h-64 items-center justify-end p-0 relative rounded-[58px] shadow-[0px_0px_27px_0px_rgba(0,0,0,0.1)] shrink-0"
      data-name="ktichen renovation"
      style={{ backgroundImage: `url('${imgKtichenRenovation}')` }}
    >
      <Frame241 />
      <Chips4 />
      <Frame753 />
    </div>
  );
}

function Frame755() {
  return (
    <div className="relative shrink-0 w-full">
      <div className="flex flex-row items-center justify-center relative size-full">
        <div className="box-border content-stretch flex flex-row items-center justify-center px-2 py-0 relative w-full">
          <div
            className="basis-0 font-['Roboto:Medium',_sans-serif] font-medium grow leading-[0] min-h-px min-w-px relative shrink-0 text-[#ffffff] text-[21px] text-left"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            <p className="block leading-[24px]">Beautiful Landscapes</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Frame229() {
  return (
    <div className="box-border content-stretch flex flex-row gap-2.5 items-center justify-center px-2 py-[3px] relative rounded-2xl shrink-0">
      <div
        className="font-['Roboto:Regular',_sans-serif] font-normal leading-[0] relative shrink-0 text-[#ffffff] text-[16px] text-center text-nowrap"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p className="block leading-[19.2px] whitespace-pre">{`2004 - 2024 `}</p>
      </div>
    </div>
  );
}

function MaskGroup13() {
  return (
    <div
      className="grid-cols-[max-content] grid-rows-[max-content] inline-grid place-items-start relative shrink-0"
      data-name="Mask group"
    >
      <div
        className="[grid-area:1_/_1] bg-center bg-cover bg-no-repeat mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[0.64px_0.96px] mask-size-[32px_32px] ml-[-0.64px] mt-[-0.96px] size-[33.92px]"
        data-name="female face upclose"
        style={{
          backgroundImage: `url('${imgFemaleFaceUpclose}')`,
          maskImage: `url('${imgAdobeStock481724704Preview1}')`,
        }}
      />
    </div>
  );
}

function Frame230() {
  return (
    <div className="absolute box-border content-stretch flex flex-row gap-1 h-8 items-center justify-center leading-[0] left-0 px-2 py-px rounded-2xl top-[-34px]">
      <MaskGroup13 />
      <div
        className="font-['Roboto:Medium',_sans-serif] font-medium relative shrink-0 text-[#ffffff] text-[18px] text-left text-nowrap"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p className="block leading-[19.2px] whitespace-pre">Emily Arlington</p>
      </div>
    </div>
  );
}

function Frame756() {
  return (
    <div className="box-border content-stretch flex flex-col gap-1 items-start justify-start p-0 relative shrink-0 w-[228px]">
      <Frame755 />
      <Frame229 />
      <Frame230 />
    </div>
  );
}

function Frame242() {
  return (
    <div className="bg-gradient-to-b from-50% from-[#00000000] h-[280px] relative rounded-[58px] shrink-0 to-[#39313199] to-[95.673%] w-full">
      <div className="flex flex-row items-end justify-center relative size-full">
        <div className="box-border content-stretch flex flex-row gap-[11px] items-end justify-center px-8 py-6 relative w-full">
          <Frame756 />
        </div>
      </div>
    </div>
  );
}

function Chips6() {
  return (
    <div
      className="absolute bg-[rgba(0,0,0,0.6)] box-border content-stretch flex flex-row gap-0.5 h-8 items-center justify-center left-[30px] px-[9px] py-2 rounded-lg top-[30px] w-[42px]"
      data-name="Chips"
    >
      <div
        aria-hidden="true"
        className="absolute border border-[#393131] border-solid inset-0 pointer-events-none rounded-lg"
      />
      <div className="font-['Inter:Medium',_sans-serif] font-medium leading-[0] not-italic relative shrink-0 text-[#ffffff] text-[15px] text-left text-nowrap">
        <p className="block leading-[26.2px] whitespace-pre">{`78 `}</p>
      </div>
    </div>
  );
}

function MaskGroup14() {
  return (
    <div
      className="grid-cols-[max-content] grid-rows-[max-content] inline-grid mr-[-10px] order-4 place-items-start relative shrink-0"
      data-name="Mask group"
    >
      <div
        className="[grid-area:1_/_1] bg-center bg-cover bg-no-repeat mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[20.414px_77.241px] mask-size-[32px_32px] ml-[-20.414px] mt-[-77.241px] size-[187.034px]"
        data-name="AdobeStock_481724704_Preview"
        style={{
          backgroundImage: `url('${imgAdobeStock481724704Preview}')`,
          maskImage: `url('${imgAdobeStock481724704Preview1}')`,
        }}
      />
    </div>
  );
}

function MaskGroup15() {
  return (
    <div
      className="grid-cols-[max-content] grid-rows-[max-content] inline-grid mr-[-10px] order-3 place-items-start relative shrink-0"
      data-name="Mask group"
    >
      <div
        className="[grid-area:1_/_1] bg-center bg-cover bg-no-repeat mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[20.414px_113.778px] mask-size-[32px_32px] ml-[-20.414px] mt-[-113.778px] size-[187.034px]"
        data-name="AdobeStock_481724704_Preview"
        style={{
          backgroundImage: `url('${imgAdobeStock481724704Preview}')`,
          maskImage: `url('${imgAdobeStock481724704Preview1}')`,
        }}
      />
    </div>
  );
}

function MaskGroup16() {
  return (
    <div
      className="grid-cols-[max-content] grid-rows-[max-content] inline-grid mr-[-10px] order-2 place-items-start relative shrink-0"
      data-name="Mask group"
    >
      <div
        className="[grid-area:1_/_1] bg-center bg-cover bg-no-repeat mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[20.414px_40.889px] mask-size-[32px_32px] ml-[-20.414px] mt-[-40.889px] size-[187.034px]"
        data-name="AdobeStock_481724704_Preview"
        style={{
          backgroundImage: `url('${imgAdobeStock481724704Preview}')`,
          maskImage: `url('${imgAdobeStock481724704Preview1}')`,
        }}
      />
    </div>
  );
}

function MaskGroup17() {
  return (
    <div
      className="grid-cols-[max-content] grid-rows-[max-content] inline-grid mr-[-10px] order-1 place-items-start relative shrink-0"
      data-name="Mask group"
    >
      <div
        className="[grid-area:1_/_1] bg-center bg-cover bg-no-repeat mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[58px_40.889px] mask-size-[32px_32px] ml-[-58px] mt-[-40.889px] size-[187.034px]"
        data-name="AdobeStock_481724704_Preview"
        style={{
          backgroundImage: `url('${imgAdobeStock481724704Preview}')`,
          maskImage: `url('${imgAdobeStock481724704Preview1}')`,
        }}
      />
      <div className="[grid-area:1_/_1] flex h-[39px] items-center justify-center ml-0 mt-[-4px] relative w-[35px]">
        <div className="flex-none rotate-[180deg] scale-y-[-100%]">
          <div
            className="bg-[rgba(0,0,0,0.4)] h-[39px] mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[0px_4px] mask-size-[32px_32px] w-[35px]"
            style={{ maskImage: `url('${imgAdobeStock481724704Preview1}')` }}
          />
        </div>
      </div>
      <div
        className="[grid-area:1_/_1] font-['Roboto:Medium',_sans-serif] font-medium leading-[0] mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[-11px_-2px] mask-size-[32px_32px] ml-[21px] mt-0.5 relative text-[#ffffff] text-[16px] text-nowrap text-right translate-x-[-100%]"
        style={{
          fontVariationSettings: "'wdth' 100",
          maskImage: `url('${imgAdobeStock481724704Preview1}')`,
        }}
      >
        <p className="block leading-[27px] whitespace-pre">2</p>
      </div>
    </div>
  );
}

function Frame231() {
  return (
    <div className="box-border content-stretch flex flex-row-reverse h-8 items-center justify-start leading-[0] pl-0 pr-2.5 py-0 relative shrink-0">
      <MaskGroup14 />
      <MaskGroup15 />
      <MaskGroup16 />
      <MaskGroup17 />
    </div>
  );
}

function Plus5() {
  return (
    <div className="relative shrink-0 size-5" data-name="plus-02">
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 20 20"
      >
        <g id="plus-02">
          <path
            d="M10 5L10 15M15 10L5 10"
            id="Icon"
            stroke="var(--stroke-0, white)"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </g>
      </svg>
    </div>
  );
}

function Chips7() {
  return (
    <div
      className="bg-[#393131] box-border content-stretch flex flex-row gap-px h-8 items-center justify-center px-3 py-2 relative rounded-lg shrink-0"
      data-name="Chips"
    >
      <div
        aria-hidden="true"
        className="absolute border border-[#393131] border-solid inset-0 pointer-events-none rounded-lg"
      />
      <Plus5 />
      <div
        className="font-['Roboto:Medium',_sans-serif] font-medium leading-[0] relative shrink-0 text-[#ffffff] text-[16px] text-nowrap text-right"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p className="block leading-[27px] whitespace-pre">{`Add `}</p>
      </div>
    </div>
  );
}

function Frame212() {
  return (
    <div className="absolute box-border content-stretch flex flex-row items-center justify-between left-[5px] p-0 top-60 w-[230px]">
      <Frame231 />
      <Chips7 />
    </div>
  );
}

function GrandmaAndGrandpaAtAPicknic() {
  return (
    <div
      className="w-[280px] bg-center bg-cover bg-no-repeat box-border content-stretch flex flex-col gap-2.5 h-64 items-center justify-end p-0 relative rounded-[58px] shadow-[0px_0px_27px_0px_rgba(0,0,0,0.1)] shrink-0"
      data-name="grandma and grandpa at a picknic"
      style={{ backgroundImage: `url('${imgGrandmaAndGrandpaAtAPicknic}')` }}
    >
      <Frame242 />
      <Chips6 />
      <Frame212 />
    </div>
  );
}

export default function Frame754() {
  return (
    <div className="box-border content-stretch flex flex-row gap-[15px] items-start justify-start p-0 relative w-full">
      {/* Memory cards removed */}
    </div>
  );
}