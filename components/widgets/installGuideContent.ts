// Wording for the Contact Us widget install guide (components/widgets/InstallGuide.tsx).
// Steps are plain strings; **double asterisks** mark menu names / buttons to show in bold.

export type PlatformId =
  | 'wordpress' | 'shopify' | 'wix' | 'squarespace' | 'webflow' | 'gtm' | 'html' | 'managed';

export interface InstallPlatform {
  id: PlatformId;
  label: string;
  note?: string; // plan requirements or other gotchas, shown above the steps
  steps: string[];
}

export const INSTALL_PLATFORMS: InstallPlatform[] = [
  {
    id: 'wordpress',
    label: 'WordPress',
    note: 'Needs a site where you can install plugins (most self-hosted WordPress sites, or a WordPress.com plan that allows plugins).',
    steps: [
      'Log in to your WordPress dashboard (usually yourwebsite.com/wp-admin).',
      'Go to **Plugins → Add New Plugin**, search for **WPCode**, then click **Install Now** and **Activate** on "WPCode – Insert Headers and Footers".',
      'In the left menu, go to **Code Snippets → Header & Footer**.',
      'Paste your install code into the **Footer** box.',
      'Click **Save Changes**.',
      'If you use a caching plugin, clear its cache.',
    ],
  },
  {
    id: 'shopify',
    label: 'Shopify',
    note: 'If you switch themes later, add the code to the new theme too.',
    steps: [
      'From your Shopify admin, go to **Online Store → Themes**.',
      'Next to your current theme, click the **⋯** button, then **Edit code**.',
      'In the **Layout** folder, open **theme.liquid**.',
      'Find **</body>** near the bottom of the file (press Ctrl+F, or Cmd+F on a Mac, and search for it).',
      'Paste your install code on a new line just above **</body>**.',
      'Click **Save**.',
    ],
  },
  {
    id: 'wix',
    label: 'Wix',
    note: 'Wix only allows custom code on sites with a paid (Premium) plan and a connected domain.',
    steps: [
      'Open your site\'s dashboard and go to **Settings**.',
      'Scroll down to **Advanced** and click **Custom Code**.',
      'Click **+ Add Custom Code**.',
      'Paste your install code into the box and name it, for example "Stasht chat".',
      'Under **Add Code to Pages**, choose **All pages**.',
      'Under **Place Code in**, choose **Body - end**, then click **Apply**.',
    ],
  },
  {
    id: 'squarespace',
    label: 'Squarespace',
    note: 'Code Injection is only available on some Squarespace plans. If you can\'t find it, your plan may need upgrading.',
    steps: [
      'In your Squarespace dashboard, open **Code Injection**. It\'s under **Settings → Advanced → Code Injection** (on newer dashboards: **Website → Website Tools → Code Injection**).',
      'Paste your install code into the **Footer** box.',
      'Click **Save**.',
    ],
  },
  {
    id: 'webflow',
    label: 'Webflow',
    note: 'Custom code needs a paid Webflow site plan.',
    steps: [
      'Open your project and go to **Site settings**.',
      'Open the **Custom code** tab.',
      'Paste your install code into **Footer code** (the box for code "before </body> tag").',
      'Click **Save changes**.',
      '**Publish** your site. Custom code only appears on the published site.',
    ],
  },
  {
    id: 'gtm',
    label: 'Google Tag Manager',
    note: 'Use this if your website already has Google Tag Manager set up.',
    steps: [
      'In Google Tag Manager, open your website\'s container and go to **Tags → New**.',
      'Name the tag "Stasht chat widget", click **Tag Configuration** and choose **Custom HTML**.',
      'Paste your install code into the HTML box.',
      'Click **Triggering** and choose **All Pages**.',
      'Click **Save**, then **Submit** and **Publish**.',
    ],
  },
  {
    id: 'html',
    label: 'HTML / other',
    steps: [
      'Open your website\'s shared footer or layout template if it has one. Otherwise, open each page\'s HTML file.',
      'Find the closing **</body>** tag near the bottom.',
      'Paste your install code on a new line just above it.',
      'Save, then upload or publish the changes to your website.',
    ],
  },
  {
    id: 'managed',
    label: 'Someone else manages my site',
    steps: [
      'Click **Email my web developer** below. It opens your email with the code and instructions ready to send.',
      'Dealer website platforms and agencies (whoever built your site) usually add code like this for you when you ask.',
      'Once they confirm it\'s added, check it\'s working using the steps at the bottom of this page.',
    ],
  },
];

export interface InstallContext {
  snippet: string;
  domain: string | null; // first allowed domain, if any
  platformLabel: string | null; // chosen platform, if any (not "Someone else manages my site")
  corner: 'bottom-right' | 'bottom-left';
}

const cornerText = (c: InstallContext['corner']) => (c === 'bottom-left' ? 'bottom-left' : 'bottom-right');

/** Prompt to paste into ChatGPT, Claude, Gemini, Copilot, etc. */
export function aiAssistantPrompt(ctx: InstallContext): string {
  const site = ctx.domain || 'my website';
  const builtWith = ctx.platformLabel || "I'm not sure. Please help me find out, then continue";
  const where = ctx.platformLabel ? `in ${ctx.platformLabel}` : 'on my website';
  return [
    "I need to add a chat widget to my website. I'm not technical, so please give me simple, numbered, click-by-click steps.",
    '',
    `My website: ${site}`,
    `My website is built with: ${builtWith}`,
    '',
    'The widget company gave me this one line of code:',
    '',
    ctx.snippet,
    '',
    'What needs to happen:',
    '- This exact line needs to be on every page of my website, just before the closing </body> tag. A site-wide "footer code" or "custom code" setting is ideal.',
    '- The code must not be changed in any way.',
    '- The site may need to be saved or published afterwards.',
    '',
    'Please:',
    `1. Tell me exactly where to click ${where} to add site-wide footer code, and tell me if my plan needs to support custom code.`,
    `2. Tell me how to check it worked: when I open my website and refresh, a chat bubble should appear in the ${cornerText(ctx.corner)} corner within a few seconds.`,
    '3. If you can edit my website\'s code or files directly, add the line for me just before </body> in the shared layout or on every page.',
  ].join('\n');
}

export function developerEmailSubject(): string {
  return 'Please add our chat widget to the website';
}

/** Email body for whoever manages the customer's website. */
export function developerEmailBody(ctx: InstallContext): string {
  const site = ctx.domain ? ` (${ctx.domain})` : '';
  return [
    'Hi,',
    '',
    `Could you please add our Contact Us chat widget to our website${site}?`,
    '',
    'It is one line of code. Please paste it exactly as-is on every page, just before the closing </body> tag. A site-wide footer or custom-code setting, or the shared layout template, is ideal:',
    '',
    ctx.snippet,
    '',
    `Once it is live, a chat bubble should appear in the ${cornerText(ctx.corner)} corner of every page. The script loads asynchronously (in the background).`,
    '',
    'Please let me know once it has been added. Thank you!',
  ].join('\n');
}
