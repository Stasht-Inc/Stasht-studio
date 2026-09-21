import svgPaths from "./svg-1btcobknyh";
import imgScreenShot20220908At1221 from "figma:asset/0822519a6cee3f1405b3ac4a0def88ec339f84b7.png";
import imgFemaleAvatar from "figma:asset/4028506cbe6fbc605e7fd310ec471c44bcf1a98a.png";
import imgScreenShot20220908At1223 from "figma:asset/2173ec8a28f05bbf6247338e719309b47354a6d2.png";
import imgScreenShot20220908At1224 from "figma:asset/109bc15fd9f8edb23ff98ebd500d1d42c5232c55.png";
import imgScreenShot20220908At1225 from "figma:asset/48b372f79e3ed7e62f7d1bc352c337b89240b669.png";
import imgScreenShot20220908At1226 from "figma:asset/c6fc758822ebb09be2c6cfbc49a42ef3ef935c53.png";
import { imgScreenShot20220908At1222, imgFemaleAvatar1 } from "./svg-xvu23";

function ImageLg() {
  return (
    <div
      className="h-[303.712px] relative rounded-[32px] shrink-0 w-full"
      data-name="Image - Lg"
    >
      <div
        className="absolute bg-center bg-cover bg-no-repeat inset-[-7.69%_-5.63%_-23.5%_-5.63%] mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[22.388px_23.362px] mask-size-[398px_303.713px]"
        data-name="Screen Shot 2022-09-08 at 1.22 1"
        style={{
          backgroundImage: `url('${imgScreenShot20220908At1221}')`,
          maskImage: `url('${imgScreenShot20220908At1222}')`,
        }}
      />
    </div>
  );
}

function MaskGroup() {
  return (
    <div
      className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0"
      data-name="Mask group"
    >
      <div
        className="[grid-area:1_/_1] bg-center bg-cover bg-no-repeat mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[0.86px_1.29px] mask-size-[43px_43px] ml-[-0.86px] mt-[-1.29px] size-[45.58px]"
        data-name="Female avatar"
        style={{
          backgroundImage: `url('${imgFemaleAvatar}')`,
          maskImage: `url('${imgFemaleAvatar1}')`,
        }}
      />
    </div>
  );
}

function Frame193() {
  return (
    <div className="box-border content-stretch flex flex-row items-center justify-center p-0 relative shrink-0 size-[43px]">
      <MaskGroup />
    </div>
  );
}

function Frame17() {
  return (
    <div className="box-border content-stretch flex flex-col h-[17px] items-start justify-start p-0 relative shrink-0 w-full">
      <div
        className="font-['Roboto:Medium',_sans-serif] font-medium leading-[0] relative shrink-0 text-[#393131] text-[16px] text-left w-[233px]"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p className="block leading-[19.2px]">PedalHeads</p>
      </div>
    </div>
  );
}

function Frame23() {
  return (
    <div className="box-border content-stretch flex flex-col gap-0.5 h-[43px] items-start justify-center p-0 relative shrink-0 w-[215px]">
      <Frame17 />
      <div
        className="font-['Roboto:Italic',_sans-serif] font-normal italic leading-[0] relative shrink-0 text-[#858484] text-[14px] text-left w-full"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p className="block leading-[19.2px]">Sayulita, Mexico</p>
      </div>
    </div>
  );
}

function Frame165() {
  return (
    <div className="box-border content-stretch flex flex-row gap-2 items-center justify-start p-0 relative shrink-0">
      <Frame193 />
      <Frame23 />
    </div>
  );
}

function MessageSquare() {
  return (
    <div className="relative shrink-0 size-4" data-name="message-square">
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 16 16"
      >
        <g id="message-square">
          <path
            d={svgPaths.p166f9580}
            id="Icon"
            stroke="var(--stroke-0, black)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </g>
      </svg>
    </div>
  );
}

function Frame190() {
  return (
    <div className="box-border content-stretch flex flex-row gap-px items-center justify-end p-0 relative shrink-0">
      <MessageSquare />
      <div
        className="flex flex-col font-['Roboto:Regular',_sans-serif] font-normal justify-center leading-[0] relative shrink-0 text-[#000000] text-[19px] text-nowrap text-right"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p className="block leading-[28px] whitespace-pre">07</p>
      </div>
    </div>
  );
}

function Frame164() {
  return (
    <div className="box-border content-stretch flex flex-row items-center justify-between p-0 relative shrink-0 w-full">
      <Frame165 />
      <Frame190 />
    </div>
  );
}

function Frame748() {
  return (
    <div className="box-border content-stretch flex flex-col gap-2 items-start justify-start p-0 relative shrink-0 w-full">
      <div className="font-['Inter:Italic',_sans-serif] font-normal italic leading-[0] relative shrink-0 text-[#6c60ff] text-[0px] text-left w-full">
        <p className="text-[14px]">
          <span
            className="font-['Roboto:Italic',_sans-serif] italic leading-[19.2px] text-[#625a5a]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Feb 12, 2024
          </span>
          <span
            className="font-['Roboto:Italic',_sans-serif] italic leading-[19.2px]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {" "}
          </span>
          <span
            className="font-['Roboto:Italic',_sans-serif] italic leading-[19.2px] text-[#625a5a]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            •
          </span>
          <span
            className="font-['Roboto:Italic',_sans-serif] italic leading-[19.2px] text-[#393131]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {" "}
          </span>
          <span
            className="font-['Roboto:Regular',_sans-serif] leading-[23.2px] text-[#393131]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Back to school season has us reminiscing about the good vibes at
            camp this summer! Wishing all kiddos a great start to the school
            year. Thank you for making this summer such a memorable one!
          </span>
        </p>
      </div>
    </div>
  );
}

function Frame167() {
  return (
    <div className="bg-[#ffffff] relative rounded-bl-[32px] rounded-br-[32px] shrink-0 w-full">
      <div className="relative size-full">
        <div className="box-border content-stretch flex flex-col gap-2 items-start justify-start p-[16px] relative w-full">
          <Frame164 />
          <Frame748 />
        </div>
      </div>
    </div>
  );
}

function CardPost() {
  return (
    <div
      className="bg-[#ffffff] box-border content-stretch flex flex-col gap-2 items-center justify-start p-0 relative rounded-[32px] shadow-[6px_6px_54px_0px_rgba(0,0,0,0.05)] shrink-0 w-[398px]"
      data-name="Card/Post"
    >
      <ImageLg />
      <Frame167 />
    </div>
  );
}

function Card() {
  return (
    <div className="bg-[#ffffff] relative shrink-0 w-full" data-name="Card">
      <div className="relative size-full">
        <div className="box-border content-stretch flex flex-row gap-2.5 items-start justify-start p-[16px] relative w-full">
          <CardPost />
        </div>
      </div>
    </div>
  );
}

function ImageLg1() {
  return (
    <div
      className="h-[303.712px] relative rounded-[32px] shrink-0 w-full"
      data-name="Image - Lg"
    >
      <div
        className="absolute bg-center bg-cover bg-no-repeat inset-[-7.69%_-5.63%_-23.5%_-5.63%] mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[22.388px_23.362px] mask-size-[398px_303.713px]"
        data-name="Screen Shot 2022-09-08 at 1.22 1"
        style={{
          backgroundImage: `url('${imgScreenShot20220908At1223}')`,
          maskImage: `url('${imgScreenShot20220908At1222}')`,
        }}
      />
    </div>
  );
}

function MaskGroup1() {
  return (
    <div
      className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0"
      data-name="Mask group"
    >
      <div
        className="[grid-area:1_/_1] bg-center bg-cover bg-no-repeat mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[0.86px_1.29px] mask-size-[43px_43px] ml-[-0.86px] mt-[-1.29px] size-[45.58px]"
        data-name="Female avatar"
        style={{
          backgroundImage: `url('${imgFemaleAvatar}')`,
          maskImage: `url('${imgFemaleAvatar1}')`,
        }}
      />
    </div>
  );
}

function Frame194() {
  return (
    <div className="box-border content-stretch flex flex-row items-center justify-center p-0 relative shrink-0 size-[43px]">
      <MaskGroup1 />
    </div>
  );
}

function Frame18() {
  return (
    <div className="box-border content-stretch flex flex-col h-[17px] items-start justify-start p-0 relative shrink-0 w-full">
      <div
        className="font-['Roboto:Medium',_sans-serif] font-medium leading-[0] relative shrink-0 text-[#393131] text-[16px] text-left w-[233px]"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p className="block leading-[19.2px]">PedalHeads</p>
      </div>
    </div>
  );
}

function Frame24() {
  return (
    <div className="box-border content-stretch flex flex-col gap-0.5 h-[43px] items-start justify-center p-0 relative shrink-0 w-[215px]">
      <Frame18 />
      <div
        className="font-['Roboto:Italic',_sans-serif] font-normal italic leading-[0] relative shrink-0 text-[#858484] text-[14px] text-left w-full"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p className="block leading-[19.2px]">Sayulita, Mexico</p>
      </div>
    </div>
  );
}

function Frame166() {
  return (
    <div className="box-border content-stretch flex flex-row gap-2 items-center justify-start p-0 relative shrink-0">
      <Frame194 />
      <Frame24 />
    </div>
  );
}

function MessageSquare1() {
  return (
    <div className="relative shrink-0 size-4" data-name="message-square">
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 16 16"
      >
        <g id="message-square">
          <path
            d={svgPaths.p166f9580}
            id="Icon"
            stroke="var(--stroke-0, black)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </g>
      </svg>
    </div>
  );
}

function Frame191() {
  return (
    <div className="box-border content-stretch flex flex-row gap-px items-center justify-end p-0 relative shrink-0">
      <MessageSquare1 />
      <div
        className="flex flex-col font-['Roboto:Regular',_sans-serif] font-normal justify-center leading-[0] relative shrink-0 text-[#000000] text-[19px] text-nowrap text-right"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p className="block leading-[28px] whitespace-pre">11</p>
      </div>
    </div>
  );
}

function Frame168() {
  return (
    <div className="box-border content-stretch flex flex-row items-center justify-between p-0 relative shrink-0 w-full">
      <Frame166 />
      <Frame191 />
    </div>
  );
}

function Frame749() {
  return (
    <div className="box-border content-stretch flex flex-col gap-2 items-start justify-start p-0 relative shrink-0 w-full">
      <div className="font-['Inter:Italic',_sans-serif] font-normal italic leading-[0] relative shrink-0 text-[#6c60ff] text-[0px] text-left w-full">
        <p className="text-[14px]">
          <span
            className="font-['Roboto:Italic',_sans-serif] italic leading-[19.2px] text-[#625a5a]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Feb 12, 2024
          </span>
          <span
            className="font-['Roboto:Italic',_sans-serif] italic leading-[19.2px]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {" "}
          </span>
          <span
            className="font-['Roboto:Italic',_sans-serif] italic leading-[19.2px] text-[#625a5a]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            •
          </span>
          <span
            className="font-['Roboto:Italic',_sans-serif] italic leading-[19.2px] text-[#393131]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {" "}
          </span>
          <span
            className="font-['Roboto:Regular',_sans-serif] leading-[23.2px] text-[#393131]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {`❓What age should my child learn to ride? `}
            <br />
            {`❓What bike size is right for my child? `}
            <br />
            {`❓How do I properly fit a bike helmet? `}
            <br />
            <br aria-hidden="true" />
            Those are some questions we dive into on our “Guide to Teach Your
            Kid How To Ride a Bike” blog. Link in bio to learn more.
          </span>
        </p>
      </div>
    </div>
  );
}

function Frame169() {
  return (
    <div className="bg-[#ffffff] relative rounded-bl-[32px] rounded-br-[32px] shrink-0 w-full">
      <div className="relative size-full">
        <div className="box-border content-stretch flex flex-col gap-2 items-start justify-start p-[16px] relative w-full">
          <Frame168 />
          <Frame749 />
        </div>
      </div>
    </div>
  );
}

function CardPost1() {
  return (
    <div
      className="bg-[#ffffff] box-border content-stretch flex flex-col gap-2 items-center justify-start p-0 relative rounded-[32px] shadow-[6px_6px_54px_0px_rgba(0,0,0,0.05)] shrink-0 w-[398px]"
      data-name="Card/Post"
    >
      <ImageLg1 />
      <Frame169 />
    </div>
  );
}

function Card1() {
  return (
    <div className="bg-[#ffffff] relative shrink-0 w-full" data-name="Card">
      <div className="relative size-full">
        <div className="box-border content-stretch flex flex-row gap-2.5 items-start justify-start p-[16px] relative w-full">
          <CardPost1 />
        </div>
      </div>
    </div>
  );
}

function ImageLg2() {
  return (
    <div
      className="h-[303.712px] relative rounded-[32px] shrink-0 w-full"
      data-name="Image - Lg"
    >
      <div
        className="absolute bg-center bg-cover bg-no-repeat inset-[-7.69%_-5.63%_-23.5%_-5.63%] mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[22.388px_23.362px] mask-size-[398px_303.712px]"
        data-name="Screen Shot 2022-09-08 at 1.22 1"
        style={{
          backgroundImage: `url('${imgScreenShot20220908At1224}')`,
          maskImage: `url('${imgScreenShot20220908At1222}')`,
        }}
      />
    </div>
  );
}

function MaskGroup2() {
  return (
    <div
      className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0"
      data-name="Mask group"
    >
      <div
        className="[grid-area:1_/_1] bg-center bg-cover bg-no-repeat mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[0.86px_1.29px] mask-size-[43px_43px] ml-[-0.86px] mt-[-1.29px] size-[45.58px]"
        data-name="Female avatar"
        style={{
          backgroundImage: `url('${imgFemaleAvatar}')`,
          maskImage: `url('${imgFemaleAvatar1}')`,
        }}
      />
    </div>
  );
}

function Frame195() {
  return (
    <div className="box-border content-stretch flex flex-row items-center justify-center p-0 relative shrink-0 size-[43px]">
      <MaskGroup2 />
    </div>
  );
}

function Frame19() {
  return (
    <div className="box-border content-stretch flex flex-col h-[17px] items-start justify-start p-0 relative shrink-0 w-full">
      <div
        className="font-['Roboto:Medium',_sans-serif] font-medium leading-[0] relative shrink-0 text-[#393131] text-[16px] text-left w-[233px]"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p className="block leading-[19.2px]">Laurie Matheson</p>
      </div>
    </div>
  );
}

function Frame25() {
  return (
    <div className="box-border content-stretch flex flex-col gap-0.5 h-[43px] items-start justify-center p-0 relative shrink-0 w-[215px]">
      <Frame19 />
      <div
        className="font-['Roboto:Italic',_sans-serif] font-normal italic leading-[0] relative shrink-0 text-[#858484] text-[14px] text-left w-full"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p className="block leading-[19.2px]">Sayulita, Mexico</p>
      </div>
    </div>
  );
}

function Frame170() {
  return (
    <div className="box-border content-stretch flex flex-row gap-2 items-center justify-start p-0 relative shrink-0">
      <Frame195 />
      <Frame25 />
    </div>
  );
}

function MessageSquare2() {
  return (
    <div className="relative shrink-0 size-4" data-name="message-square">
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 16 16"
      >
        <g id="message-square">
          <path
            d={svgPaths.p166f9580}
            id="Icon"
            stroke="var(--stroke-0, black)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </g>
      </svg>
    </div>
  );
}

function Frame192() {
  return (
    <div className="box-border content-stretch flex flex-row gap-px items-center justify-end p-0 relative shrink-0">
      <MessageSquare2 />
      <div
        className="flex flex-col font-['Roboto:Regular',_sans-serif] font-normal justify-center leading-[0] relative shrink-0 text-[#000000] text-[19px] text-nowrap text-right"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p className="block leading-[28px] whitespace-pre">19</p>
      </div>
    </div>
  );
}

function Frame171() {
  return (
    <div className="box-border content-stretch flex flex-row items-center justify-between p-0 relative shrink-0 w-full">
      <Frame170 />
      <Frame192 />
    </div>
  );
}

function Frame750() {
  return (
    <div className="box-border content-stretch flex flex-col gap-2 items-start justify-start p-0 relative shrink-0 w-full">
      <div className="font-['Inter:Italic',_sans-serif] font-normal italic leading-[0] relative shrink-0 text-[#6c60ff] text-[0px] text-left w-full">
        <p className="text-[14px]">
          <span
            className="font-['Roboto:Italic',_sans-serif] italic leading-[19.2px] text-[#625a5a]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Feb 12, 2024
          </span>
          <span
            className="font-['Roboto:Italic',_sans-serif] italic leading-[19.2px]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {" "}
          </span>
          <span
            className="font-['Roboto:Italic',_sans-serif] italic leading-[19.2px] text-[#625a5a]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            •
          </span>
          <span
            className="font-['Roboto:Italic',_sans-serif] italic leading-[19.2px] text-[#393131]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {" "}
          </span>
          <span
            className="font-['Roboto:Regular',_sans-serif] leading-[23.2px] text-[#393131]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >{`We discovered `}</span>
          <a
            className="[text-decoration-line:underline] [text-decoration-skip-ink:none] [text-decoration-style:solid] [text-underline-position:from-font] cursor-pointer font-['Roboto:Regular',_sans-serif] leading-[23.2px] text-[#393131]"
            href="https://www.instagram.com/pedalheads/"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            <span
              className="[text-decoration-line:underline] [text-decoration-skip-ink:none] [text-decoration-style:solid] [text-underline-position:from-font]"
              href="https://www.instagram.com/pedalheads/"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              @pedalheads
            </span>
          </a>
          <span
            className="font-['Roboto:Regular',_sans-serif] leading-[23.2px] text-[#393131]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >{` last summer and I was quite literally dumbfounded when I picked my daughter up after the first day of camp and saw that her training wheels had been removed. She learned how to ride a 2-wheeler in less than 3 hours!`}</span>
        </p>
      </div>
    </div>
  );
}

function Frame172() {
  return (
    <div className="bg-[#ffffff] relative rounded-bl-[32px] rounded-br-[32px] shrink-0 w-full">
      <div className="relative size-full">
        <div className="box-border content-stretch flex flex-col gap-2 items-start justify-start p-[16px] relative w-full">
          <Frame171 />
          <Frame750 />
        </div>
      </div>
    </div>
  );
}

function CardPost2() {
  return (
    <div
      className="bg-[#ffffff] box-border content-stretch flex flex-col gap-2 items-center justify-start p-0 relative rounded-[32px] shadow-[6px_6px_54px_0px_rgba(0,0,0,0.05)] shrink-0 w-[398px]"
      data-name="Card/Post"
    >
      <ImageLg2 />
      <Frame172 />
    </div>
  );
}

function Card2() {
  return (
    <div className="bg-[#ffffff] relative shrink-0 w-full" data-name="Card">
      <div
        aria-hidden="true"
        className="absolute border-[0px_0px_0px_1px] border-[rgba(217,218,255,0.56)] border-solid inset-0 pointer-events-none"
      />
      <div className="relative size-full">
        <div className="box-border content-stretch flex flex-row gap-2.5 items-start justify-start p-[16px] relative w-full">
          <CardPost2 />
        </div>
      </div>
    </div>
  );
}

function ImageLg3() {
  return (
    <div
      className="h-[303.712px] relative rounded-[32px] shrink-0 w-full"
      data-name="Image - Lg"
    >
      <div
        className="absolute bg-center bg-cover bg-no-repeat inset-[-7.69%_-5.63%_-23.5%_-5.63%] mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[22.388px_23.362px] mask-size-[398px_303.712px]"
        data-name="Screen Shot 2022-09-08 at 1.22 1"
        style={{
          backgroundImage: `url('${imgScreenShot20220908At1225}')`,
          maskImage: `url('${imgScreenShot20220908At1222}')`,
        }}
      />
    </div>
  );
}

function MaskGroup3() {
  return (
    <div
      className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0"
      data-name="Mask group"
    >
      <div
        className="[grid-area:1_/_1] bg-center bg-cover bg-no-repeat mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[0.86px_1.29px] mask-size-[43px_43px] ml-[-0.86px] mt-[-1.29px] size-[45.58px]"
        data-name="Female avatar"
        style={{
          backgroundImage: `url('${imgFemaleAvatar}')`,
          maskImage: `url('${imgFemaleAvatar1}')`,
        }}
      />
    </div>
  );
}

function Frame196() {
  return (
    <div className="box-border content-stretch flex flex-row items-center justify-center p-0 relative shrink-0 size-[43px]">
      <MaskGroup3 />
    </div>
  );
}

function Frame20() {
  return (
    <div className="box-border content-stretch flex flex-col h-[17px] items-start justify-start p-0 relative shrink-0 w-full">
      <div
        className="font-['Roboto:Medium',_sans-serif] font-medium leading-[0] relative shrink-0 text-[#393131] text-[16px] text-left w-[233px]"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p className="block leading-[19.2px]">PedalHeads</p>
      </div>
    </div>
  );
}

function Frame26() {
  return (
    <div className="box-border content-stretch flex flex-col gap-0.5 h-[43px] items-start justify-center p-0 relative shrink-0 w-[215px]">
      <Frame20 />
      <div
        className="font-['Roboto:Italic',_sans-serif] font-normal italic leading-[0] relative shrink-0 text-[#858484] text-[14px] text-left w-full"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p className="block leading-[19.2px]">Sayulita, Mexico</p>
      </div>
    </div>
  );
}

function Frame173() {
  return (
    <div className="box-border content-stretch flex flex-row gap-2 items-center justify-start p-0 relative shrink-0">
      <Frame196 />
      <Frame26 />
    </div>
  );
}

function MessageSquare3() {
  return (
    <div className="relative shrink-0 size-4" data-name="message-square">
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 16 16"
      >
        <g id="message-square">
          <path
            d={svgPaths.p166f9580}
            id="Icon"
            stroke="var(--stroke-0, black)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </g>
      </svg>
    </div>
  );
}

function Frame197() {
  return (
    <div className="box-border content-stretch flex flex-row gap-px items-center justify-end p-0 relative shrink-0">
      <MessageSquare3 />
      <div
        className="flex flex-col font-['Roboto:Regular',_sans-serif] font-normal justify-center leading-[0] relative shrink-0 text-[#000000] text-[19px] text-nowrap text-right"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p className="block leading-[28px] whitespace-pre">07</p>
      </div>
    </div>
  );
}

function Frame174() {
  return (
    <div className="box-border content-stretch flex flex-row items-center justify-between p-0 relative shrink-0 w-full">
      <Frame173 />
      <Frame197 />
    </div>
  );
}

function Frame751() {
  return (
    <div className="box-border content-stretch flex flex-col gap-2 items-start justify-start p-0 relative shrink-0 w-full">
      <div className="font-['Inter:Italic',_sans-serif] font-normal italic leading-[0] relative shrink-0 text-[#6c60ff] text-[0px] text-left w-full">
        <p className="text-[14px]">
          <span
            className="font-['Roboto:Italic',_sans-serif] italic leading-[19.2px] text-[#625a5a]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Feb 12, 2024
          </span>
          <span
            className="font-['Roboto:Italic',_sans-serif] italic leading-[19.2px]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {" "}
          </span>
          <span
            className="font-['Roboto:Italic',_sans-serif] italic leading-[19.2px] text-[#625a5a]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            •
          </span>
          <span
            className="font-['Roboto:Italic',_sans-serif] italic leading-[19.2px] text-[#393131]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {" "}
          </span>
          <span
            className="font-['Roboto:Regular',_sans-serif] leading-[23.2px] text-[#393131]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >{`If you are looking for a camp for your kiddo this summer or next, be sure to check out `}</span>
          <a
            className="[text-decoration-line:underline] [text-decoration-skip-ink:none] [text-decoration-style:solid] [text-underline-position:from-font] cursor-pointer font-['Roboto:Regular',_sans-serif] leading-[23.2px] text-[#393131]"
            href="https://www.instagram.com/pedalheads/"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            <span
              className="[text-decoration-line:underline] [text-decoration-skip-ink:none] [text-decoration-style:solid] [text-underline-position:from-font]"
              href="https://www.instagram.com/pedalheads/"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              @pedalheads
            </span>
          </a>
          <span
            className="font-['Roboto:Regular',_sans-serif] leading-[23.2px] text-[#393131]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {` bike camp! 🚲`}
            <br />
            <br aria-hidden="true" />
            It was a big milestone in our house - my son attending his first
            half day camp! The confidence that my kid gained on his bike is
            unmatched! The instructors were all so kind and welcoming. Everyday,
            he was asking if he was going back to camp! Highly recommend this
            camp for your little one!
          </span>
        </p>
      </div>
    </div>
  );
}

function Frame175() {
  return (
    <div className="bg-[#ffffff] relative rounded-bl-[32px] rounded-br-[32px] shrink-0 w-full">
      <div className="relative size-full">
        <div className="box-border content-stretch flex flex-col gap-2 items-start justify-start p-[16px] relative w-full">
          <Frame174 />
          <Frame751 />
        </div>
      </div>
    </div>
  );
}

function CardPost3() {
  return (
    <div
      className="bg-[#ffffff] box-border content-stretch flex flex-col gap-2 items-center justify-start p-0 relative rounded-[32px] shadow-[6px_6px_54px_0px_rgba(0,0,0,0.05)] shrink-0 w-[398px]"
      data-name="Card/Post"
    >
      <ImageLg3 />
      <Frame175 />
    </div>
  );
}

function Card3() {
  return (
    <div className="bg-[#ffffff] relative shrink-0 w-full" data-name="Card">
      <div
        aria-hidden="true"
        className="absolute border-[0px_0px_0px_1px] border-[rgba(217,218,255,0.56)] border-solid inset-0 pointer-events-none"
      />
      <div className="relative size-full">
        <div className="box-border content-stretch flex flex-row gap-2.5 items-start justify-start p-[16px] relative w-full">
          <CardPost3 />
        </div>
      </div>
    </div>
  );
}

function ImageLg4() {
  return (
    <div
      className="h-[303.712px] relative rounded-[32px] shrink-0 w-full"
      data-name="Image - Lg"
    >
      <div
        className="absolute bg-center bg-cover bg-no-repeat inset-[-7.69%_-5.63%_-23.5%_-5.63%] mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[22.388px_23.362px] mask-size-[398px_303.712px]"
        data-name="Screen Shot 2022-09-08 at 1.22 1"
        style={{
          backgroundImage: `url('${imgScreenShot20220908At1226}')`,
          maskImage: `url('${imgScreenShot20220908At1222}')`,
        }}
      />
    </div>
  );
}

function MaskGroup4() {
  return (
    <div
      className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0"
      data-name="Mask group"
    >
      <div
        className="[grid-area:1_/_1] bg-center bg-cover bg-no-repeat mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[0.86px_1.29px] mask-size-[43px_43px] ml-[-0.86px] mt-[-1.29px] size-[45.58px]"
        data-name="Female avatar"
        style={{
          backgroundImage: `url('${imgFemaleAvatar}')`,
          maskImage: `url('${imgFemaleAvatar1}')`,
        }}
      />
    </div>
  );
}

function Frame198() {
  return (
    <div className="box-border content-stretch flex flex-row items-center justify-center p-0 relative shrink-0 size-[43px]">
      <MaskGroup4 />
    </div>
  );
}

function Frame21() {
  return (
    <div className="box-border content-stretch flex flex-col h-[17px] items-start justify-start p-0 relative shrink-0 w-full">
      <div
        className="font-['Roboto:Medium',_sans-serif] font-medium leading-[0] relative shrink-0 text-[#393131] text-[16px] text-left w-[233px]"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p className="block leading-[19.2px]">PedalHeads</p>
      </div>
    </div>
  );
}

function Frame27() {
  return (
    <div className="box-border content-stretch flex flex-col gap-0.5 h-[43px] items-start justify-center p-0 relative shrink-0 w-[215px]">
      <Frame21 />
      <div
        className="font-['Roboto:Italic',_sans-serif] font-normal italic leading-[0] relative shrink-0 text-[#858484] text-[14px] text-left w-full"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p className="block leading-[19.2px]">Sayulita, Mexico</p>
      </div>
    </div>
  );
}

function Frame176() {
  return (
    <div className="box-border content-stretch flex flex-row gap-2 items-center justify-start p-0 relative shrink-0">
      <Frame198 />
      <Frame27 />
    </div>
  );
}

function MessageSquare4() {
  return (
    <div className="relative shrink-0 size-4" data-name="message-square">
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 16 16"
      >
        <g id="message-square">
          <path
            d={svgPaths.p166f9580}
            id="Icon"
            stroke="var(--stroke-0, black)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </g>
      </svg>
    </div>
  );
}

function Frame199() {
  return (
    <div className="box-border content-stretch flex flex-row gap-px items-center justify-end p-0 relative shrink-0">
      <MessageSquare4 />
      <div
        className="flex flex-col font-['Roboto:Regular',_sans-serif] font-normal justify-center leading-[0] relative shrink-0 text-[#000000] text-[19px] text-nowrap text-right"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p className="block leading-[28px] whitespace-pre">07</p>
      </div>
    </div>
  );
}

function Frame177() {
  return (
    <div className="box-border content-stretch flex flex-row items-center justify-between p-0 relative shrink-0 w-full">
      <Frame176 />
      <Frame199 />
    </div>
  );
}

function Frame752() {
  return (
    <div className="box-border content-stretch flex flex-col gap-2 items-start justify-start p-0 relative shrink-0 w-full">
      <div className="font-['Inter:Italic',_sans-serif] font-normal italic leading-[0] relative shrink-0 text-[#6c60ff] text-[0px] text-left w-full">
        <p className="text-[14px]">
          <span
            className="font-['Roboto:Italic',_sans-serif] italic leading-[19.2px] text-[#625a5a]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Feb 12, 2024
          </span>
          <span
            className="font-['Roboto:Italic',_sans-serif] italic leading-[19.2px]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {" "}
          </span>
          <span
            className="font-['Roboto:Italic',_sans-serif] italic leading-[19.2px] text-[#625a5a]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            •
          </span>
          <span
            className="font-['Roboto:Italic',_sans-serif] italic leading-[19.2px] text-[#393131]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {" "}
          </span>
          <span
            className="font-['Roboto:Regular',_sans-serif] leading-[23.2px] text-[#393131]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Back to school season has us reminiscing about the good vibes at
            camp this summer! Wishing all kiddos a great start to the school
            year. Thank you for making this summer such a memorable one!
          </span>
        </p>
      </div>
    </div>
  );
}

function Frame178() {
  return (
    <div className="bg-[#ffffff] relative rounded-bl-[32px] rounded-br-[32px] shrink-0 w-full">
      <div className="relative size-full">
        <div className="box-border content-stretch flex flex-col gap-2 items-start justify-start p-[16px] relative w-full">
          <Frame177 />
          <Frame752 />
        </div>
      </div>
    </div>
  );
}

function CardPost4() {
  return (
    <div
      className="bg-[#ffffff] box-border content-stretch flex flex-col gap-2 items-center justify-start p-0 relative rounded-[32px] shadow-[6px_6px_54px_0px_rgba(0,0,0,0.05)] shrink-0 w-[398px]"
      data-name="Card/Post"
    >
      <ImageLg4 />
      <Frame178 />
    </div>
  );
}

function Card4() {
  return (
    <div className="bg-[#ffffff] relative shrink-0 w-full" data-name="Card">
      <div
        aria-hidden="true"
        className="absolute border-[0px_0px_0px_1px] border-[rgba(217,218,255,0.56)] border-solid inset-0 pointer-events-none"
      />
      <div className="relative size-full">
        <div className="box-border content-stretch flex flex-row gap-2.5 items-start justify-start p-[16px] relative w-full">
          <CardPost4 />
        </div>
      </div>
    </div>
  );
}

export default function Frame209() {
  return (
    <div className="bg-[#ffffff] box-border content-stretch flex flex-col items-start justify-start p-0 relative size-full">
      <Card />
      <Card1 />
      <Card2 />
      <Card3 />
      <Card4 />
    </div>
  );
}