/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: DisclosureChevron.tsx
 *
 * Description:
 * Shared animated chevron atom for disclosure-style UI.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

type DisclosureChevronProps = {
  open: boolean;
  size?: number;
  rotationDegrees?: 90 | 180;
  className?: string;
};

export default function DisclosureChevron({
  open,
  size = 20,
  rotationDegrees = 180,
  className = "",
}: DisclosureChevronProps) {
  const rotationClass = open
    ? rotationDegrees === 90
      ? "rotate-90"
      : "rotate-180"
    : "rotate-0";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transform transition-transform duration-300 ease-out ${rotationClass} ${className}`}
      aria-hidden="true"
    >
      <path
        d="M5 7.5L10 12.5L15 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
