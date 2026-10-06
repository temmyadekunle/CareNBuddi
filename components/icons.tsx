import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </Base>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3.5 10.6 12 3.8l8.5 6.8" />
      <path d="M5.5 9.6V20h13V9.6" />
      <path d="M9.8 20v-5.4h4.4V20" />
    </Base>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="11" cy="11" r="6.4" />
      <path d="m20 20-3.6-3.6" />
    </Base>
  );
}

export function StethoscopeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 3v5a4 4 0 0 0 8 0V3" />
      <path d="M6 3H4.5M14 3h1.5" />
      <path d="M10 12v2.5a4.5 4.5 0 0 0 9 0V13" />
      <circle cx="19" cy="11" r="1.8" />
    </Base>
  );
}

export function HeartPulseIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 20.3C7.4 16.4 3.6 13.4 3.6 9.9 3.6 7.5 5.5 5.6 7.9 5.6c1.7 0 3.1.9 4.1 2.3 1-1.4 2.4-2.3 4.1-2.3 2.4 0 4.3 1.9 4.3 4.3 0 3.5-3.8 6.5-8.4 10.4Z" />
      <path d="M3.8 12.4h3.4l1.5-2.6 2.6 5 1.7-2.4h3.1" />
    </Base>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <path d="M8 13h2M14 13h2M8 17h2" />
    </Base>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="8" r="3.8" />
      <path d="M4.6 20.2c.6-3.9 3.7-6 7.4-6s6.8 2.1 7.4 6" />
    </Base>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.2 1.5 5.2H5S6.5 14 6.5 10Z" />
      <path d="M10.2 18.4a2 2 0 0 0 3.6 0" />
    </Base>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m9 5 7 7-7 7" />
    </Base>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m15 5-7 7 7 7" />
    </Base>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m5 9 7 7 7-7" />
    </Base>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </Base>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 21s6.5-5.6 6.5-10.4a6.5 6.5 0 1 0-13 0C5.5 15.4 12 21 12 21Z" />
      <circle cx="12" cy="10.4" r="2.4" />
    </Base>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8L12 4Z" />
    </Base>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.6V12l3 1.8" />
    </Base>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6.2 4h2.6l1.3 3.4-1.7 1.2a11 11 0 0 0 5 5l1.2-1.7L18 13.4V16a2 2 0 0 1-2.2 2A13.6 13.6 0 0 1 4.2 6.2 2 2 0 0 1 6.2 4Z" />
    </Base>
  );
}

export function MessageIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M20 12.4c0 3.9-3.6 7-8 7-1 0-2-.2-2.9-.5L4.5 20.5l1.3-3.4A6.6 6.6 0 0 1 4 12.4c0-3.9 3.6-7 8-7s8 3.1 8 7Z" />
    </Base>
  );
}

export function PillIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3.2" y="8.6" width="17.6" height="6.8" rx="3.4" transform="rotate(-45 12 12)" />
      <path d="M8.6 8.6 15.4 15.4" />
    </Base>
  );
}

export function SyringeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m14.5 4.5 5 5M16.8 2.2l5 5-2.3 2.3-5-5 2.3-2.3Z" />
      <path d="m13.6 8.4-8 8a2.4 2.4 0 0 0 0 3.4l.2.2a2.4 2.4 0 0 0 3.4 0l8-8" />
      <path d="m9.4 12.6 2.2 2.2" />
    </Base>
  );
}

export function FileTextIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-5.5-5.5Z" />
      <path d="M13.5 3.5V9H19M8.5 13h7M8.5 16.5h5" />
    </Base>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3.5 19 6v6c0 4-3 7.2-7 8.5-4-1.3-7-4.5-7-8.5V6l7-2.5Z" />
      <path d="m9 12 2.2 2.2L15.4 10" />
    </Base>
  );
}

export function HelpIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M9.6 9.6a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.4v.4" />
      <path d="M12 16.8h.01" />
    </Base>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1v-.3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" />
    </Base>
  );
}

export function LogOutIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M14.5 4.5h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3" />
      <path d="M10 8.5 6.5 12 10 15.5M6.8 12H16" />
    </Base>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m5 12.8 4.2 4.2L19 7" />
    </Base>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Base>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 4.2 21 19.5H3L12 4.2Z" />
      <path d="M12 10v4M12 16.6h.01" />
    </Base>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 19.5h16" />
      <path d="M7 19.5V13M12 19.5V6.5M17 19.5v-4.5" />
    </Base>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="2" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="2" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="2" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2" />
    </Base>
  );
}

export function EmergencyIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3.5c3.4 0 6 2.5 6 5.6 0 4-3.4 6-4.4 6.9l-.2.2h-2.8l-.2-.2C9.4 15.1 6 13.1 6 9.1c0-3.1 2.6-5.6 6-5.6Z" />
      <path d="M12 7.6v4M12 14.2h.01" />
      <path d="M6.5 21h11" />
    </Base>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H9l-5 4v-13.5Z" />
      <path d="M8.5 9h7M8.5 12.5h4.5" />
    </Base>
  );
}

export function WalletIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3.5" y="6" width="17" height="12.5" rx="3" />
      <path d="M3.5 9.5h17M16 14h1.5" />
    </Base>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3.5 8.5h3l1.5-2.5h8l1.5 2.5h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-18a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13.5" r="3.2" />
    </Base>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M20 11a8 8 0 0 0-13.7-5.3L4 8" />
      <path d="M4 4v4h4" />
      <path d="M4 13a8 8 0 0 0 13.7 5.3L20 16" />
      <path d="M20 20v-4h-4" />
    </Base>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m14.5 6.5 3 3" />
    </Base>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4.5 7h15M9.5 7V5.2a1.2 1.2 0 0 1 1.2-1.2h2.6a1.2 1.2 0 0 1 1.2 1.2V7" />
      <path d="M6.5 7l.8 11.8a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
      <path d="M10.5 11v5M13.5 11v5" />
    </Base>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 5.5A2 2 0 0 1 6 3.5h13v14H6a2 2 0 0 0-2 2v-14Z" />
      <path d="M4 19.5a2 2 0 0 1 2-2h13v3H6a2 2 0 0 1-2-2Z" />
    </Base>
  );
}

export function ActivityIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3 12.5h4l2.2-6.8 4.2 12 2.1-5.2H21" />
    </Base>
  );
}

export function LanguageIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M3.6 12h16.8M12 3.6c2.2 2.4 3.3 5.3 3.3 8.4s-1.1 6-3.3 8.4c-2.2-2.4-3.3-5.3-3.3-8.4S9.8 6 12 3.6Z" />
    </Base>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="4.5" y="10" width="15" height="10" rx="3" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </Base>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 20.3C7.4 16.4 3.6 13.4 3.6 9.9 3.6 7.5 5.5 5.6 7.9 5.6c1.7 0 3.1.9 4.1 2.3 1-1.4 2.4-2.3 4.1-2.3 2.4 0 4.3 1.9 4.3 4.3 0 3.5-3.8 6.5-8.4 10.4Z" />
    </Base>
  );
}

export function GoogleIcon(props: IconProps) {
  return (
    <Base {...props} fill="currentColor" stroke="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </Base>
  );
}

export function AppleIcon(props: IconProps) {
  return (
    <Base {...props} fill="currentColor" stroke="none">
      <path d="M19.8 9.8c0 .4-.1.8-.3 1.2l-.5.5c-.2.2-.5.3-.8.3h-1.3v3.7h1.3c.3 0 .6.1.8.3l.5.5c.2.2.3.6.3 1 0 .5-.2.9-.4 1.3l-.5.5c-.2.2-.5.3-.8.3h-3.5c-.3 0-.6-.1-.8-.3l-.5-.5c-.2-.2-.3-.6-.3-1 0-.5.1-1 .3-1.3l.5-.5c.2-.2.5-.3.8-.3h1.3v-3.7h-1.3c-.3 0-.6-.1-.8-.3l-.5-.5c-.2-.2-.3-.6-.3-1 0-.5.1-1 .3-1.3l.5-.5c.2-.2.5-.3.8-.3h3.5c.3 0 .6.1.8.3l.5.5c.2.2.3.6.3 1zm-9.8 13.3c-3.1 0-5.6-2.5-5.6-5.6s2.5-5.6 5.6-5.6 5.6 2.5 5.6 5.6-2.5 5.6-5.6 5.6zm0-10.1c-2.5 0-4.5 2-4.5 4.5s2 4.5 4.5 4.5 4.5-2 4.5-4.5-2-4.5-4.5-4.5z" />
    </Base>
  );
}