// シンプルな inline SVG アイコン群（stroke は currentColor を継承）
import type { ReactNode } from "react";

type IconProps = { className?: string };

function base(props: IconProps, children: ReactNode) {
  return (
    <svg
      className={props.className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const PlusIcon = (p: IconProps) =>
  base(p, <path d="M12 5v14M5 12h14" />);

export const CheckIcon = (p: IconProps) => base(p, <path d="M20 6 9 17l-5-5" />);

export const TrashIcon = (p: IconProps) =>
  base(
    p,
    <>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6M14 11v6" />
    </>
  );

export const EditIcon = (p: IconProps) =>
  base(
    p,
    <>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
    </>
  );

export const ChevronIcon = (p: IconProps) => base(p, <path d="m9 18 6-6-6-6" />);

export const XIcon = (p: IconProps) =>
  base(p, <path d="M18 6 6 18M6 6l12 12" />);

export const FolderIcon = (p: IconProps) =>
  base(
    p,
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
  );

export const InboxIcon = (p: IconProps) =>
  base(
    p,
    <>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
    </>
  );

export const ListIcon = (p: IconProps) =>
  base(
    p,
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </>
  );

export const SettingsIcon = (p: IconProps) =>
  base(
    p,
    <>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
      <path d="M1 14h6M9 8h6M17 16h6" />
    </>
  );

export const CloudIcon = (p: IconProps) =>
  base(
    p,
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
  );
